//! Prueba contra un MongoDB real en `LIVE_URI`, con la base de datos desechable `LIVE_DB`.
//! No corre por defecto: `cargo test live -- --ignored`.

use std::rc::Rc;
use std::time::Duration;

use mongodb::Client;
use mongodb::bson::{Bson, doc};
use tokio::runtime::Handle;

use super::{prints, value};
use crate::shell::bridge::MongoBridge;
use crate::shell::engine::EngineLimits;
use crate::shell::native::MongoNatives;
use crate::shell::outcome::{ScriptErrorKind, ScriptOutcome, ScriptResult};
use crate::shell::runtime::ShellRuntime;

const LIVE_URI: &str = "mongodb://127.0.0.1:27017";
const LIVE_DB: &str = "robo3b_test";
const OTHER_DB: &str = "robo3b_test_otra";
const SHUTDOWN_TIMEOUT: Duration = Duration::from_secs(5);

fn spawn(client: &Client) -> ShellRuntime {
    let client = client.clone();
    let handle = Handle::current();
    ShellRuntime::spawn(EngineLimits::default(), handle.clone(), move |watchdog| {
        Rc::new(MongoNatives::new(client, handle, watchdog)) as Rc<dyn MongoBridge>
    })
    .expect("runtime")
}

async fn run_ok(shell: &ShellRuntime, code: &str) -> ScriptOutcome {
    let outcome = shell
        .run(LIVE_DB.into(), code.into())
        .await
        .expect("respuesta");
    assert_eq!(outcome.error, None, "script: {code}");
    outcome
}

fn single_cursor(outcome: &ScriptOutcome) -> (Option<u32>, Vec<Bson>, bool) {
    match &outcome.results[..] {
        [
            ScriptResult::Cursor {
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

    let (stuck, _) = tokio::join!(shell.run(LIVE_DB.into(), "while (true) {}".into()), async {
        tokio::time::sleep(Duration::from_millis(200)).await;
        shell.cancel();
    });
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
