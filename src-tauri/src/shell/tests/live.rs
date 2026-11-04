//! Prueba contra un MongoDB real en `LIVE_URI`, con bases de datos desechables: una por test,
//! para que puedan correr en paralelo.
//! No corre por defecto: `cargo test live -- --ignored`.

use std::rc::Rc;
use std::time::Duration;

use mongodb::Client;
use mongodb::bson::{Bson, doc};
use tokio::runtime::Handle;

use super::{outputs, prints, value};
use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};
use crate::shell::bridge::MongoBridge;
use crate::shell::engine::EngineLimits;
use crate::shell::native::MongoNatives;
use crate::shell::outcome::{ScriptErrorKind, ScriptOutcome, ScriptOutput};
use crate::shell::runtime::ShellRuntime;
use crate::shell::session::RunOptions;

pub(super) const LIVE_URI: &str = "mongodb://127.0.0.1:27017";
const LIVE_DB: &str = "robo3b_test";
const OTHER_DB: &str = "robo3b_test_otra";
const SAFE_DB: &str = "robo3b_test_safe";
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

pub(super) fn spawn(client: &Client) -> ShellRuntime {
    spawn_with(client, SafeMode::default())
}

fn spawn_with(client: &Client, safe_mode: SafeMode) -> ShellRuntime {
    let client = client.clone();
    let handle = Handle::current();
    ShellRuntime::spawn(EngineLimits::default(), handle.clone(), move |watchdog| {
        Rc::new(MongoNatives::new(client, safe_mode, handle, watchdog)) as Rc<dyn MongoBridge>
    })
    .expect("runtime")
}

async fn run_ok(shell: &ShellRuntime, code: &str) -> ScriptOutcome {
    run_ok_in(shell, LIVE_DB, code).await
}

pub(super) async fn run_ok_in(shell: &ShellRuntime, db: &str, code: &str) -> ScriptOutcome {
    let outcome = shell
        .run(db.into(), code.into(), None, RunOptions::default())
        .await
        .expect("respuesta");
    assert_eq!(outcome.error, None, "script: {code}");
    outcome
}

fn single_cursor(outcome: &ScriptOutcome) -> (Option<u32>, Vec<Bson>, bool) {
    match &outputs(outcome)[..] {
        [
            ScriptOutput::Cursor {
                cursor_id,
                documents,
                exhausted,
                ..
            },
        ] => (*cursor_id, documents.clone(), *exhausted),
        other => panic!("se esperaba un cursor: {other:?}"),
    }
}

fn ids(documents: &[Bson]) -> Vec<i32> {
    documents
        .iter()
        .map(|d| d.as_document().unwrap().get_i32("_id").unwrap())
        .collect()
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_shell_against_local_mongo() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);

    run_ok(
        &shell,
        "db.dropDatabase();\n\
         db.x.insertMany(Array.from({ length: 120 }, (_, i) => ({ _id: NumberInt(i) })))",
    )
    .await;

    let sorted = run_ok(
        &shell,
        "db.getCollection('x').find({}).sort({_id:-1}).limit(5)",
    )
    .await;
    let (cursor, documents, exhausted) = single_cursor(&sorted);
    assert_eq!((cursor, exhausted), (None, true));
    assert_eq!(ids(&documents), [119, 118, 117, 116, 115]);
    let query_ms = sorted.query_ms.expect("tiempo de consulta");
    assert!(query_ms <= sorted.elapsed_ms);
    assert_eq!(run_ok(&shell, "1 + 1").await.query_ms, None);
    // Antes de 7.0 el servidor falla con NamespaceNotFound y `drop()` da `false`; desde 7.0, `true`.
    let dropped = run_ok(&shell, "db.no_existe.drop() === parseInt(db.version()) >= 7").await;
    assert_eq!(value(&dropped), Some(Bson::Boolean(true)));

    let each = run_ok(
        &shell,
        "var n = 0; db.x.find().forEach(d => n++); print('total', n)",
    )
    .await;
    assert_eq!(prints(&each), ["total 120"]);

    let same_script = run_ok(
        &shell,
        "db.x.insertOne({ _id: NumberInt(1000) });\ndb.x.findOne({ _id: 1000 })",
    )
    .await;
    assert_eq!(
        value(&same_script),
        Some(Bson::Document(doc! { "_id": 1000 }))
    );

    let other = run_ok(&shell, &format!("use {OTHER_DB}; db.y.count()")).await;
    assert_eq!(prints(&other), [format!("switched to db {OTHER_DB}")]);
    assert_eq!(value(&other), Some(Bson::Int32(0)));

    // Un find grande llega por lotes: 50 con el script y el resto al pedirlos.
    let (cursor, first, exhausted) = single_cursor(&run_ok(&shell, "db.x.find()").await);
    assert_eq!((first.len(), exhausted), (50, false));
    let cursor = cursor.expect("cursor abierto");
    let second = shell.next_batch(cursor, 50).await.unwrap();
    assert_eq!((second.documents.len(), second.exhausted), (50, false));
    let last = shell.next_batch(cursor, 50).await.unwrap();
    assert_eq!((last.documents.len(), last.exhausted), (21, true));
    assert!(
        shell.next_batch(cursor, 50).await.is_err(),
        "el cursor agotado se cierra"
    );

    let (stuck, _) = tokio::join!(
        shell.run(
            LIVE_DB.into(),
            "while (true) {}".into(),
            None,
            RunOptions::default()
        ),
        async {
            tokio::time::sleep(Duration::from_millis(200)).await;
            shell.cancel();
        }
    );
    assert_eq!(
        stuck.unwrap().error.map(|e| e.kind),
        Some(ScriptErrorKind::Cancelled)
    );
    assert_eq!(
        value(&run_ok(&shell, "db.x.count()").await),
        Some(Bson::Int32(121))
    );

    // Soltar el shell (lo que hace desconectar) cierra su cursor abierto; si no, `shutdown`
    // se quedaría esperando.
    let (open, _, _) = single_cursor(&run_ok(&shell, "db.x.find().batchSize(2)").await);
    assert!(open.is_some());
    drop(shell);
    client.database(LIVE_DB).drop(None).await.unwrap();
    tokio::time::timeout(SHUTDOWN_TIMEOUT, client.shutdown())
        .await
        .expect("shutdown no espera a cursores del shell");
}

/// Con safe mode toda escritura del script se rechaza antes de llegar al servidor; las lecturas
/// siguen funcionando y apagarlo surte efecto en el mismo shell.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_safe_mode_rejects_writes() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let safe_mode = SafeMode::new(false);
    let shell = spawn_with(&client, safe_mode.clone());
    run_ok_in(
        &shell,
        SAFE_DB,
        "db.dropDatabase(); db.x.insertOne({ _id: 1 })",
    )
    .await;

    safe_mode.set(true);
    for write in [
        "db.x.insertOne({ _id: 2 })",
        "db.x.deleteMany({})",
        "db.x.drop()",
        "db.x.aggregate([{ $out: 'y' }]).toArray()",
        "db.x.createIndex({ a: 1 })",
        "db.x.insertMany([{}, {}], { ordered: false })",
        "db.x.initializeUnorderedBulkOp().insert({}).execute()",
        "db.x.bulkWrite([{ deleteMany: { filter: {} } }])",
        "db.x.renameCollection('z')",
        "db.x.dropIndexes()",
        "db.createUser({ user: 'u', pwd: 'p', roles: [] })",
        "db.grantRolesToUser('u', ['read'])",
        "db.killOp(1)",
        "db.runCommand({ deleteIndexes: 'x', index: '*' })",
        "db.adminCommand({ updateZoneKeyRange: 'a.x', min: { k: 0 }, max: { k: 10 }, zone: null })",
        "db.adminCommand({ addShardToZone: 'shard0', zone: 'z' })",
        "db.adminCommand({ setQuerySettings: { find: 'x', filter: {}, $db: 'a' }, settings: {} })",
        "db.adminCommand({ setChangeStreamState: 1, enabled: false })",
        "db.adminCommand({ appendOplogNote: 1, data: {} })",
    ] {
        let outcome = shell
            .run(SAFE_DB.into(), write.into(), None, RunOptions::default())
            .await
            .unwrap();
        let error = outcome.error.expect(write);
        assert!(
            error.message.contains(SAFE_MODE_ERROR),
            "{write}: {}",
            error.message
        );
        assert_eq!(error.kind, ScriptErrorKind::ReadOnly, "{write}");
    }
    assert_eq!(
        value(&run_ok_in(&shell, SAFE_DB, "db.x.count()").await),
        Some(Bson::Int32(1))
    );
    run_ok_in(
        &shell,
        SAFE_DB,
        "db.x.find().toArray(); db.x.aggregate([{ $match: {} }]).toArray()",
    )
    .await;

    safe_mode.set(false);
    run_ok_in(&shell, SAFE_DB, "db.x.insertOne({ _id: 2 })").await;
    drop(shell);
    client.database(SAFE_DB).drop(None).await.unwrap();
}

const MENU_DB: &str = "robo3b_test_menu";

/// Lo que abre el menú de una colección: las plantillas de actualizar/eliminar corren tal cual,
/// el `$out` de "Duplicar colección" copia en la misma BD y la distribución de shards da un error
/// claro en un servidor sin sharding.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_collection_menu_scripts() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        MENU_DB,
        "db.dropDatabase(); db.x.insertMany([{ _id: 1, key: 'value' }, { _id: 2, key: 'value' }])",
    )
    .await;

    // Plantillas de `src/features/shell/domain/menuScripts.ts`.
    let update = r#"db.getCollection('x').update(
    // query
    {
        "key" : "value"
    },
    // update
    {
        "$set" : { "key" : "value" }
    },
    // options
    {
        "multi" : false,  // update only one document
        "upsert" : false  // insert a new document, if no existing document match the query
    }
);"#;
    let remove = r#"db.getCollection('x').remove(
    // query
    {
        "key" : "value"
    },
    // justOne
    true
);"#;
    run_ok_in(&shell, MENU_DB, update).await;
    run_ok_in(&shell, MENU_DB, remove).await;
    assert_eq!(
        value(&run_ok_in(&shell, MENU_DB, "db.x.count()").await),
        Some(Bson::Int32(1))
    );

    run_ok_in(
        &shell,
        MENU_DB,
        "db.x.aggregate([{ $match: {} }, { $out: 'x_copy' }]).toArray()",
    )
    .await;
    assert_eq!(
        value(&run_ok_in(&shell, MENU_DB, "db.x_copy.count()").await),
        Some(Bson::Int32(1))
    );

    // Ver índices y Ver log.
    run_ok_in(&shell, MENU_DB, "db.getCollection('x').getIndexes()").await;
    run_ok_in(&shell, MENU_DB, "db.adminCommand({ getLog: 'global' })").await;

    // Un mongod sin sharding responde igual, con `inShardedMode: false`.
    run_ok_in(&shell, MENU_DB, "db.getCollection('x').getShardVersion()").await;
    let outcome = shell
        .run(
            MENU_DB.into(),
            "db.x.getShardDistribution()".into(),
            None,
            RunOptions::default(),
        )
        .await
        .unwrap();
    assert!(
        outcome
            .error
            .unwrap()
            .message
            .contains("no está fragmentada")
    );

    drop(shell);
    client.database(MENU_DB).drop(None).await.unwrap();
}

const PARALLEL_DB: &str = "robo3b_test_paralelo";

/// Los cursores de varias sentencias se consultan a la vez, pero el script se ve como si se
/// hubieran esperado uno a uno: resultados en orden, escrituras detrás de las consultas previas y
/// nada después de una consulta que falla.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_parallel_queries_keep_script_order() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        PARALLEL_DB,
        "db.dropDatabase(); db.x.insertMany([1, 2, 3].map((i) => ({ _id: NumberInt(i) })))",
    )
    .await;

    let three = run_ok_in(
        &shell,
        PARALLEL_DB,
        "db.x.find({ _id: 1 })\ndb.x.find({ _id: 2 })\ndb.x.aggregate([{ $match: { _id: 3 } }])",
    )
    .await;
    let found: Vec<_> = three
        .results
        .iter()
        .map(|result| match &result.output {
            ScriptOutput::Cursor { documents, .. } => (result.line, ids(documents)),
            other => panic!("se esperaba un cursor: {other:?}"),
        })
        .collect();
    assert_eq!(found, [(1, vec![1]), (2, vec![2]), (3, vec![3])]);

    let before_write = run_ok_in(
        &shell,
        PARALLEL_DB,
        "db.x.find()\ndb.x.insertOne({ _id: NumberInt(4) })",
    )
    .await;
    let ScriptOutput::Cursor { documents, .. } = &before_write.results[0].output else {
        panic!("se esperaba un cursor");
    };
    assert_eq!(ids(documents), [1, 2, 3]);

    // Con lotes pequeños, la página que se muestra se lee entera antes de borrar.
    let before_delete = run_ok_in(
        &shell,
        PARALLEL_DB,
        "db.y.insertMany(Array.from({ length: 30 }, (_, i) => ({ _id: NumberInt(i) })))\n\
         db.y.find().batchSize(5)\n\
         db.y.deleteMany({})",
    )
    .await;
    let shown = before_delete
        .results
        .iter()
        .find_map(|result| match &result.output {
            ScriptOutput::Cursor { documents, .. } => Some(documents.len()),
            _ => None,
        });
    assert_eq!(shown, Some(30));

    let failed = shell
        .run(
            PARALLEL_DB.into(),
            "db.x.find({ $nope: 1 })\ndb.x.insertOne({ _id: NumberInt(5) })".into(),
            None,
            RunOptions::default(),
        )
        .await
        .unwrap();
    let error = failed.error.expect("el find falla");
    assert_eq!(error.line, Some(1));
    assert!(failed.results.is_empty());
    assert_eq!(
        value(&run_ok_in(&shell, PARALLEL_DB, "db.x.count()").await),
        Some(Bson::Int32(4)),
        "la escritura de después no se hizo"
    );

    drop(shell);
    client.database(PARALLEL_DB).drop(None).await.unwrap();
}

const CUT_DB: &str = "robo3b_test_cut";

/// Cancelar una escritura lenta la detiene también en el servidor: no sigue modificando
/// documentos después de que el shell diga que se canceló.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_cancelled_write_stops_on_the_server() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        CUT_DB,
        "db.dropDatabase(); db.x.insertMany(Array.from({ length: 100 }, (_, i) => ({ _id: i })))",
    )
    .await;

    let (cut, _) = tokio::join!(
        shell.run(
            CUT_DB.into(),
            "db.x.updateMany({ $where: 'sleep(50) || true' }, { $set: { touched: true } })".into(),
            None,
            RunOptions::default()
        ),
        async {
            tokio::time::sleep(Duration::from_millis(500)).await;
            shell.cancel();
        }
    );
    let error = cut.unwrap().error.expect("cancelado");
    assert_eq!(error.kind, ScriptErrorKind::Cancelled);
    assert!(
        error.message.contains("se detuvo en el servidor"),
        "{}",
        error.message
    );

    let touched = || async {
        let outcome = run_ok_in(&shell, CUT_DB, "db.x.count({ touched: true })").await;
        value(&outcome)
    };
    let after_cut = touched().await;
    tokio::time::sleep(Duration::from_millis(1000)).await;
    assert_eq!(touched().await, after_cut, "la escritura siguió en el servidor");
    assert_ne!(after_cut, Some(Bson::Int32(100)));

    drop(shell);
    client.database(CUT_DB).drop(None).await.unwrap();
}

const WRITE_PIPELINE_DB: &str = "robo3b_test_write_pipeline";

/// Como en Robo 3T: un aggregate con `$out`/`$merge` escribe al llamarlo, aunque se guarde en una
/// variable, vaya en un bucle o llegue cuando ya no caben más resultados.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_write_pipeline_runs_when_called() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        WRITE_PIPELINE_DB,
        "db.dropDatabase(); db.v.insertMany([{ m: 1, n: 2 }, { m: 1, n: 3 }, { m: 2, n: 5 }])",
    )
    .await;
    let count = |coll: &str| format!("db.{coll}.countDocuments({{}})");

    run_ok_in(
        &shell,
        WRITE_PIPELINE_DB,
        "var r = db.v.aggregate([{ $match: {} }, { $out: 'copia' }]); 1",
    )
    .await;
    assert_eq!(
        value(&run_ok_in(&shell, WRITE_PIPELINE_DB, &count("copia")).await),
        Some(Bson::Int32(3))
    );

    // Cada vuelta escribe antes de la siguiente, y el find de después ya ve lo escrito.
    let looped = run_ok_in(
        &shell,
        WRITE_PIPELINE_DB,
        "for (const m of [1, 2]) {
           db.v.aggregate([{ $match: { m } }, { $group: { _id: '$m', total: { $sum: '$n' } } },
                           { $merge: { into: 'resumen' } }]);
         }
         db.resumen.find().sort({ _id: 1 }).toArray()",
    )
    .await;
    assert_eq!(
        value(&looped),
        Some(Bson::Array(vec![
            Bson::Document(doc! { "_id": 1, "total": 5 }),
            Bson::Document(doc! { "_id": 2, "total": 5 }),
        ]))
    );

    // Pasado el límite de resultados la sentencia ya no se muestra, pero escribe igual.
    run_ok_in(
        &shell,
        WRITE_PIPELINE_DB,
        &format!(
            "{}db.v.aggregate([{{ $out: 'tarde' }}])",
            "1;\n".repeat(110)
        ),
    )
    .await;
    assert_eq!(
        value(&run_ok_in(&shell, WRITE_PIPELINE_DB, &count("tarde")).await),
        Some(Bson::Int32(3))
    );

    drop(shell);
    client.database(WRITE_PIPELINE_DB).drop(None).await.unwrap();
}

const CUT_AGGREGATE_DB: &str = "robo3b_test_cut_aggregate";

/// Cancelar una agregación con `$merge` (no muere con su sesión) la mata en el servidor por su
/// `comment`: ya no aparece en `currentOp` después de que el shell diga que se canceló.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_cancelled_write_aggregate_stops_on_the_server() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        CUT_AGGREGATE_DB,
        "db.dropDatabase(); db.x.insertMany(Array.from({ length: 100 }, (_, i) => ({ _id: i })))",
    )
    .await;

    // Trabajo pesado por documento, para que la agregación tarde varios segundos.
    let slow = "{ $gt: [{ $size: { $range: [0, { $add: [2000000, '$_id'] }] } }, 0] }";
    let (cut, _) = tokio::join!(
        shell.run(
            CUT_AGGREGATE_DB.into(),
            format!("db.x.aggregate([{{ $match: {{ $expr: {slow} }} }}, {{ $merge: 'y' }}])"),
            None,
            RunOptions::default()
        ),
        async {
            tokio::time::sleep(Duration::from_millis(500)).await;
            shell.cancel();
        }
    );
    let error = cut.unwrap().error.expect("cancelado");
    assert_eq!(error.kind, ScriptErrorKind::Cancelled, "{}", error.message);
    assert!(
        error.message.contains("se detuvo en el servidor"),
        "{}",
        error.message
    );

    // `killOp` solo la marca: se le da un momento para que lo note y salga de `currentOp`.
    tokio::time::sleep(Duration::from_millis(300)).await;
    let running = run_ok_in(
        &shell,
        CUT_AGGREGATE_DB,
        "db.currentOp({ 'command.aggregate': 'x' }).inprog.length",
    )
    .await;
    assert_eq!(value(&running), Some(Bson::Int32(0)), "la agregación siguió en el servidor");

    drop(shell);
    client.database(CUT_AGGREGATE_DB).drop(None).await.unwrap();
}

const TYPES_DB: &str = "robo3b_test_tipos";

/// Lo que el script ya leyó de un cursor se muestra con los tipos del servidor: de vuelta de JS,
/// un Double entero sería Int32, un Symbol String y un Undefined Null (y guardar la edición los
/// cambiaría en la base de datos).
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_cursor_read_by_the_script_keeps_bson_types() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let database = client.database(TYPES_DB);
    database.drop(None).await.unwrap();
    let typed = |id: i32| {
        doc! {
            "_id": id,
            "precio": Bson::Double(5.0),
            "simbolo": Bson::Symbol("s".into()),
            "nada": Bson::Undefined,
        }
    };
    database
        .collection("pocos")
        .insert_many((1..=3).map(typed), None)
        .await
        .unwrap();
    database
        .collection("muchos")
        .insert_many((0..250).map(typed), None)
        .await
        .unwrap();
    let shell = spawn(&client);
    let assert_typed = |documents: &[Bson], code: &str| {
        for document in documents {
            let document = document.as_document().unwrap();
            assert_eq!(document, &typed(document.get_i32("_id").unwrap()), "{code}");
        }
    };

    // Agotado en el primer lote: `_id` ya es null, el buffer sigue de ese cursor.
    let code = "var c = db.pocos.find().sort({ _id: 1 }); var h = c.hasNext(); c";
    let (_, documents, exhausted) = single_cursor(&run_ok_in(&shell, TYPES_DB, code).await);
    assert_eq!((ids(&documents), exhausted), (vec![1, 2, 3], true));
    assert_typed(&documents, code);

    // Lo que queda tras `next()`: la cola del lote.
    let code = "var c = db.pocos.find().sort({ _id: 1 }); var d = c.next(); c";
    let (_, documents, _) = single_cursor(&run_ok_in(&shell, TYPES_DB, code).await);
    assert_eq!(ids(&documents), vec![2, 3]);
    assert_typed(&documents, code);

    // Cola del segundo lote del script más lo que falta de la página, leído del servidor.
    let code = "var c = db.muchos.find().sort({ _id: 1 }); for (var i = 0; i < 195; i++) c.next(); c";
    let (cursor_id, documents, _) = single_cursor(&run_ok_in(&shell, TYPES_DB, code).await);
    let read = ids(&documents);
    assert!(read.len() > 5 && cursor_id.is_some(), "{read:?}");
    assert_eq!(read, (195..195 + read.len() as i32).collect::<Vec<_>>());
    assert_typed(&documents, code);

    drop(shell);
    database.drop(None).await.unwrap();
}
