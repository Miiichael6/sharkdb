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
    assert_eq!(value(&other), Some(Bson::Double(0.0)));

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
        Some(Bson::Double(121.0))
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
        Some(Bson::Double(1.0))
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
        Some(Bson::Double(1.0))
    );

    run_ok_in(
        &shell,
        MENU_DB,
        "db.x.aggregate([{ $match: {} }, { $out: 'x_copy' }]).toArray()",
    )
    .await;
    assert_eq!(
        value(&run_ok_in(&shell, MENU_DB, "db.x_copy.count()").await),
        Some(Bson::Double(1.0))
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
