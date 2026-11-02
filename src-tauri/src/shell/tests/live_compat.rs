//! Compatibilidad con scripts de Robo 3T contra el MongoDB local de `live.rs`: escrituras que
//! no caben en un comando, los bulk del shell clásico y sus atajos.
//! No corre por defecto: `cargo test live -- --ignored`.

use mongodb::Client;
use mongodb::bson::{Bson, Document, doc};

use super::live::{LIVE_URI, run_ok_in, spawn};
use super::{outputs, prints, value};
use crate::shell::outcome::{ScriptOutcome, ScriptOutput};
use crate::shell::session::RunOptions;

const LARGE_DB: &str = "robo3b_test_lotes";
const BULK_DB: &str = "robo3b_test_bulk";
const SHORTCUTS_DB: &str = "robo3b_test_atajos";
/// Más que `maxWriteBatchSize` (100 000) documentos.
const MANY_DOCS: i32 = 150_000;
/// Documentos de 1 MB: 20 suman más que los 16 MB de un comando.
const LARGE_DOCS: i32 = 20;

fn last_write(outcome: &ScriptOutcome) -> Document {
    outputs(outcome)
        .into_iter()
        .rev()
        .find_map(|output| match output {
            ScriptOutput::Write {
                value: Bson::Document(result),
            } => Some(result.clone()),
            _ => None,
        })
        .unwrap_or_else(|| panic!("se esperaba una escritura: {:?}", outcome.results))
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_writes_larger_than_one_command() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);

    let many = run_ok_in(
        &shell,
        LARGE_DB,
        &format!("db.dropDatabase(); db.x.insertMany(Array.from({{ length: {MANY_DOCS} }}, (_, i) => ({{ _id: i }})))"),
    )
    .await;
    assert_eq!(
        last_write(&many).get_array("insertedIds").map(Vec::len),
        Ok(MANY_DOCS as usize)
    );
    let large = format!(
        "db.y.insertMany(Array.from({{ length: {LARGE_DOCS} }}, () => ({{ s: 'x'.repeat(1024 * 1024) }})))"
    );
    run_ok_in(&shell, LARGE_DB, &large).await;

    let counts = run_ok_in(
        &shell,
        LARGE_DB,
        "[db.x.count(), db.y.count(), db.y.dataSize() > 16 * 1024 * 1024]",
    )
    .await;
    assert_eq!(
        value(&counts),
        Some(Bson::Array(vec![
            Bson::Double(MANY_DOCS.into()),
            Bson::Double(LARGE_DOCS.into()),
            Bson::Boolean(true)
        ]))
    );

    // `insert` y `remove` masivos también van por lotes.
    let removed = run_ok_in(&shell, LARGE_DB, "db.x.remove({})").await;
    assert_eq!(
        last_write(&removed).get_f64("deletedCount"),
        Ok(MANY_DOCS.into())
    );

    drop(shell);
    client.database(LARGE_DB).drop(None).await.unwrap();
}

/// Los contadores son los que da Robo 3T con el mismo script.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_bulk_counters_match_the_classic_shell() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    let reset = "db.dropDatabase(); db.x.insertMany([{ _id: 1, a: 1 }, { _id: 2, a: 2 }])";

    for kind in ["Ordered", "Unordered"] {
        run_ok_in(&shell, BULK_DB, reset).await;
        let script = format!(
            "var bulk = db.x.initialize{kind}BulkOp();
             bulk.insert({{ _id: 3 }});
             bulk.find({{ a: 1 }}).updateOne({{ $set: {{ b: 1 }} }});
             bulk.find({{ a: 9 }}).upsert().updateOne({{ $set: {{ b: 2 }} }});
             bulk.find({{ a: 2 }}).removeOne();
             bulk.find({{ _id: 1 }}).updateOne({{ $set: {{ b: 1 }} }});
             bulk.execute()"
        );
        let result = last_write(&run_ok_in(&shell, BULK_DB, &script).await);
        let counters: Vec<_> = [
            "nInserted",
            "nUpserted",
            "nMatched",
            "nModified",
            "nRemoved",
        ]
        .map(|field| result.get_f64(field).unwrap_or(-1.0))
        .into();
        assert_eq!(counters, [1.0, 1.0, 2.0, 1.0, 1.0], "{kind}");
    }

    run_ok_in(&shell, BULK_DB, reset).await;
    let ordered = shell
        .run(
            BULK_DB.into(),
            "db.x.insertMany([{ _id: 5 }, { _id: 1 }, { _id: 6 }])".into(),
            None,
            RunOptions::default(),
        )
        .await
        .unwrap();
    assert!(
        ordered
            .error
            .unwrap()
            .message
            .contains("1 con error, 1 aplicadas")
    );
    let unordered = shell
        .run(
            BULK_DB.into(),
            "db.x.insertMany([{ _id: 7 }, { _id: 1 }, { _id: 8 }], { ordered: false })".into(),
            None,
            RunOptions::default(),
        )
        .await
        .unwrap();
    assert!(unordered.error.unwrap().message.contains("operación 1"));
    assert_eq!(
        value(&run_ok_in(&shell, BULK_DB, "db.x.count()").await),
        Some(Bson::Double(5.0))
    );

    let result = last_write(
        &run_ok_in(
            &shell,
            BULK_DB,
            "db.x.bulkWrite([
                { insertOne: { document: { _id: 20 } } },
                { updateMany: { filter: {}, update: { $set: { c: 1 } } } },
                { deleteOne: { filter: { _id: 20 } } },
            ])",
        )
        .await,
    );
    assert_eq!(
        (
            result.get_f64("insertedCount"),
            result.get_f64("matchedCount"),
            result.get_f64("deletedCount")
        ),
        (Ok(1.0), Ok(6.0), Ok(1.0))
    );

    drop(shell);
    client.database(BULK_DB).drop(None).await.unwrap();
}

/// Un script con los atajos del shell clásico corre sin `runCommand` y sin errores.
#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_classic_shortcuts() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    let shell = spawn(&client);
    run_ok_in(
        &shell,
        SHORTCUTS_DB,
        "db.dropDatabase(); db.x.insertMany([{ _id: 1, n: 'b' }, { _id: 2, n: 'A' }, { _id: 3, n: 'c' }])",
    )
    .await;

    let summary = run_ok_in(
        &shell,
        SHORTCUTS_DB,
        "db.x.createIndexes([{ n: 1 }]);
         var keys = db.x.getIndexKeys().length;
         var sizes = db.x.dataSize() > 0 && db.x.storageSize() > 0 && db.x.totalIndexSize() > 0
           && db.x.totalSize() === db.x.storageSize() + db.x.totalIndexSize();
         var sorted = db.x.find().sort({ n: 1 }).collation({ locale: 'es', strength: 1 }).map(d => d.n).join('');
         var plan = db.x.find({ n: 'b' }).explain('executionStats').executionStats.nReturned;
         var planned = db.x.explain().find({ _id: 1 }).finish().queryPlanner.namespace;
         var size = db.x.find().skip(1).limit(1).size();
         var count = db.x.find().skip(1).count();
         var minMax = db.x.find().min({ _id: 2 }).max({ _id: 3 }).hint({ _id: 1 }).itcount();
         var flags = db.x.find().comment('robo').noCursorTimeout().readPref('primary').pretty().itcount();
         // `allowDiskUse` en find pide MongoDB 4.4; en aggregate vale desde antes.
         var onDisk = db.x.aggregate([{ $sort: { n: 1 } }]).allowDiskUse().itcount();
         db.x.dropIndexes();
         db.x.renameCollection('y');
         var valid = db.y.validate().valid;
         var server = [db.stats().db, db.serverStatus().ok, db.isMaster().ismaster, db.hostInfo().ok,
                       Array.isArray(db.currentOp().inprog), db.getMongo().getDBNames().includes('robo3b_test_atajos')];
         var md5 = hex_md5('abc');
         sleep(10);
         ({ keys, sizes, sorted, plan, planned, size, count, minMax, flags, onDisk, capped: db.y.isCapped(),
            remaining: db.y.getIndexKeys().length, valid, server, md5 })",
    )
    .await;
    let expected = doc! {
        "keys": 2.0, "sizes": true, "sorted": "Abc", "plan": 1, "planned": "robo3b_test_atajos.x",
        "size": 1.0, "count": 3.0, "minMax": 1.0, "flags": 3.0, "onDisk": 3.0, "capped": false, "remaining": 1.0,
        "valid": true, "server": [SHORTCUTS_DB, 1.0, true, 1.0, true, true],
        "md5": "900150983cd24fb0d6963f7d28e17f72",
    };
    let [.., ScriptOutput::Value { value: summary }] = &outputs(&summary)[..] else {
        panic!("se esperaba el resumen: {:?}", summary.results);
    };
    assert_eq!(summary, &Bson::Document(expected));

    let users = run_ok_in(
        &shell,
        SHORTCUTS_DB,
        "db.createUser({ user: 'robo3b_u', pwd: 'x', roles: [] });
         db.grantRolesToUser('robo3b_u', ['read']);
         db.revokeRolesFromUser('robo3b_u', ['read']);
         db.updateUser('robo3b_u', { customData: { a: 1 } });
         db.printCollectionStats();
         db.dropUser('robo3b_u')",
    )
    .await;
    assert!(prints(&users)[0].starts_with("Successfully added user: "));
    assert_eq!(value(&users), Some(Bson::Boolean(true)));

    // `it` sigue el último cursor mostrado en la ejecución anterior.
    run_ok_in(
        &shell,
        SHORTCUTS_DB,
        "db.y.insertMany(Array.from({ length: 70 }, (_, i) => ({ i })))",
    )
    .await;
    run_ok_in(&shell, SHORTCUTS_DB, "db.y.find()").await;
    let next = run_ok_in(&shell, SHORTCUTS_DB, "it").await;
    let [
        ScriptOutput::Cursor {
            documents,
            exhausted,
            ..
        },
    ] = &outputs(&next)[..]
    else {
        panic!("se esperaba un cursor: {:?}", next.results);
    };
    assert_eq!((documents.len(), *exhausted), (23, true));

    let not_mongos = shell
        .run(
            SHORTCUTS_DB.into(),
            "sh.status()".into(),
            None,
            RunOptions::default(),
        )
        .await
        .unwrap();
    assert!(
        not_mongos
            .error
            .unwrap()
            .message
            .contains("no es un mongos")
    );

    drop(shell);
    client.database(SHORTCUTS_DB).drop(None).await.unwrap();
}
