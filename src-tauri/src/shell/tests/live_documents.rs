//! Edición de documentos contra un MongoDB real, por el mismo camino que la interfaz:
//! `eval_document` → Extended JSON canónico → comandos insert / update / delete de `run_command`.
//! No corre por defecto: `cargo test live -- --ignored`.

use mongodb::Client;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{Bson, DateTime, Document, doc};
use serde_json::{Value, json};

use crate::mongo::{command_from_json, reply_to_json};
use crate::shell::document_eval::evaluate;

const LIVE_URI: &str = "mongodb://127.0.0.1:27017";
const LIVE_DB: &str = "robo3b_test_docs";
const COLL: &str = "docs";
const ID: &str = "65a1b2c3d4e5f6a7b8c9d0e1";

/// The document as the frontend receives it from `eval_document`.
fn parsed(text: &str) -> Value {
    let eval = serde_json::to_value(evaluate(text)).unwrap();
    assert_eq!(eval["error"], Value::Null, "texto: {text}");
    eval["document"].clone()
}

/// Runs a command built like `commandDocumentStore` and returns its `n`.
async fn write(client: &Client, command: Value) -> i64 {
    let reply = client
        .database(LIVE_DB)
        .run_command(command_from_json(command).unwrap(), None)
        .await
        .unwrap();
    let reply = reply_to_json(reply);
    assert_eq!(reply.get("writeErrors"), None, "{reply}");
    reply["n"].as_i64().unwrap()
}

async fn stored(client: &Client) -> Option<Document> {
    let coll = client.database(LIVE_DB).collection::<Document>(COLL);
    coll.find_one(doc! {}, None).await.unwrap()
}

#[tokio::test(flavor = "multi_thread")]
#[ignore = "necesita MongoDB en 127.0.0.1:27017"]
async fn live_documents_keep_their_types() {
    let client = Client::with_uri_str(LIVE_URI).await.unwrap();
    client.database(LIVE_DB).drop(None).await.unwrap();
    let id = ObjectId::parse_str(ID).unwrap();
    let filter = json!({ "_id": { "$oid": ID } });

    let inserted = parsed(&format!(
        "{{ _id: ObjectId(\"{ID}\"), at: ISODate(\"2024-01-02T00:00:00Z\"), n: NumberInt(5), big: NumberLong(7), x: 1.5 }}"
    ));
    assert_eq!(write(&client, json!({ "insert": COLL, "documents": [inserted] })).await, 1);
    assert_eq!(
        stored(&client).await.unwrap(),
        doc! { "_id": id, "at": DateTime::from_millis(1_704_153_600_000), "n": 5_i32, "big": 7_i64, "x": 1.5 }
    );

    // The text `formatEditable` shows for that document, edited.
    let edited = parsed(&format!(
        "{{
    \"_id\" : ObjectId(\"{ID}\"),
    \"at\" : ISODate(\"2024-01-03T00:00:00.000Z\"),
    \"n\" : NumberInt(6),
    \"big\" : NumberLong(7),
    \"x\" : 1.5,
    \"tag\" : \"nuevo\"
}}"
    ));
    let update = json!({ "update": COLL, "updates": [{ "q": filter, "u": edited, "upsert": false }] });
    assert_eq!(write(&client, update).await, 1);
    let after = stored(&client).await.unwrap();
    assert_eq!(after.get("_id"), Some(&Bson::ObjectId(id)));
    assert_eq!(after.get("at"), Some(&Bson::DateTime(DateTime::from_millis(1_704_240_000_000))));
    assert_eq!(after.get("n"), Some(&Bson::Int32(6)));
    assert_eq!(after.get("big"), Some(&Bson::Int64(7)));
    assert_eq!(after.get_str("tag"), Ok("nuevo"));

    let delete = json!({ "delete": COLL, "deletes": [{ "q": { "_id": { "$in": [filter["_id"]] } }, "limit": 0 }] });
    assert_eq!(write(&client, delete).await, 1);
    assert_eq!(stored(&client).await, None);

    let invalid = serde_json::to_value(evaluate("{\n  a: 1,\n  b: ,\n}")).unwrap();
    assert_eq!(invalid["document"], Value::Null);
    assert_eq!(invalid["error"]["line"], 3);

    client.database(LIVE_DB).drop(None).await.unwrap();
}
