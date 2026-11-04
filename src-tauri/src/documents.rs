// Saving an edited document only while it is still as the editor read it (no lost updates).
use mongodb::Client;
use mongodb::bson::{Bson, Document, doc};
use serde_json::Value;
use tauri::State;

use crate::mongo::{Sessions, command_from_json, describe, reply_to_json, writable_session};

const ID_FIELD: &str = "_id";
const NO_ID: &str = "El documento no tiene _id";

/// Index of an array-index key ("0", "2024"; not "01" or "-1"), which a JS object lists first.
fn array_index(key: &str) -> Option<u32> {
    key.parse::<u32>().ok().filter(|n| *n != u32::MAX && n.to_string() == key)
}

/// `doc` with its fields as a JS object lists them, at every level: array-index keys first, in
/// ascending order, then the rest in their own order.
fn in_js_order(doc: &Document) -> Document {
    let mut fields: Vec<(&String, &Bson)> = doc.iter().collect();
    // Stable: the other keys keep their order.
    fields.sort_by_key(|(key, _)| array_index(key).map_or((1, 0), |n| (0, n)));
    fields.into_iter().map(|(key, value)| (key.clone(), value_in_js_order(value))).collect()
}

fn value_in_js_order(value: &Bson) -> Bson {
    match value {
        Bson::Document(doc) => Bson::Document(in_js_order(doc)),
        Bson::Array(items) => Bson::Array(items.iter().map(value_in_js_order).collect()),
        other => other.clone(),
    }
}

fn bytes(doc: &Document) -> Vec<u8> {
    let mut bytes = Vec::new();
    doc.to_writer(&mut bytes).expect("writing BSON to memory");
    bytes
}

/// Whether `stored` is still the document the editor read as `read`: same fields, types and values,
/// in the same order except for the one a JS object can't keep (array-index keys go first).
fn same_as_read(stored: &Document, read: &Document) -> bool {
    bytes(&in_js_order(stored)) == bytes(&in_js_order(read))
}

/// `update` replacing `stored` with `replacement` only while the server still has it field by field,
/// in its order. As field lists (`$objectToArray`): comparing `$$ROOT` itself fails on MongoDB 4.2
/// ("FieldPath::tail() called on single element path").
fn update_unchanged(coll: &str, stored: Document, replacement: Document) -> Document {
    let id = stored.get(ID_FIELD).cloned().unwrap_or(Bson::Null);
    let filter = doc! {
        ID_FIELD: id,
        "$expr": { "$eq": [{ "$objectToArray": "$$ROOT" }, { "$objectToArray": { "$literal": stored } }] },
    };
    doc! { "update": coll, "updates": [{ "q": filter, "u": replacement, "upsert": false }] }
}

/// Replaces `read` with `replacement` while the server still stores `read`; replies like `update`
/// (`n: 0` when it changed or is gone). The editor's copy went through a JS object, which reorders
/// integer-like keys, so it can't be the filter itself: the stored document, compared with it first,
/// is.
async fn replace_unchanged_in(
    client: &Client,
    db: &str,
    coll: &str,
    read: Document,
    replacement: Document,
) -> Result<Document, String> {
    let id = read.get(ID_FIELD).ok_or(NO_ID)?.clone();
    let database = client.database(db);
    let stored = database
        .collection::<Document>(coll)
        .find_one(doc! { ID_FIELD: id }, None)
        .await
        .map_err(describe)?;
    let Some(stored) = stored.filter(|stored| same_as_read(stored, &read)) else {
        return Ok(doc! { "n": 0, "ok": 1.0 });
    };
    database.run_command(update_unchanged(coll, stored, replacement), None).await.map_err(describe)
}

/// `original` and `replacement` in canonical Extended JSON, as the editor has them.
#[tauri::command]
pub async fn replace_unchanged(
    sessions: State<'_, Sessions>,
    id: String,
    db: String,
    coll: String,
    original: Value,
    replacement: Value,
) -> Result<Value, String> {
    let client = writable_session(&sessions, &id).await?;
    let reply = replace_unchanged_in(&client, &db, &coll, command_from_json(original)?, command_from_json(replacement)?).await?;
    Ok(reply_to_json(reply))
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::oid::ObjectId;

    fn keys(doc: &Document) -> Vec<&str> {
        doc.keys().map(String::as_str).collect()
    }

    #[test]
    fn js_order_lists_array_index_keys_first_at_every_level() {
        let doc = doc! { "b": 1, "2024": 1, "a": { "10": 1, "x": 1, "9": 1 }, "01": 1, "2023": [{ "1": 1, "0": 1 }], "-1": 1, "4294967295": 1, "4294967294": 1 };
        let ordered = in_js_order(&doc);
        assert_eq!(keys(&ordered), ["2023", "2024", "4294967294", "b", "a", "01", "-1", "4294967295"]);
        assert_eq!(keys(ordered.get_document("a").unwrap()), ["9", "10", "x"]);
        let item = ordered.get_array("2023").unwrap()[0].as_document().unwrap();
        assert_eq!(keys(item), ["0", "1"]);
    }

    #[test]
    fn a_document_read_through_js_is_the_same_as_stored() {
        let stored = doc! { "_id": 1, "2024": 1, "2023": 2, "nested": { "b": 1, "10": 2, "9": 3 } };
        assert!(same_as_read(&stored, &in_js_order(&stored)));
    }

    #[test]
    fn any_other_difference_is_a_change() {
        let stored = doc! { "_id": 1, "a": 1, "b": 2 };
        assert!(!same_as_read(&stored, &doc! { "_id": 1, "b": 2, "a": 1 }), "named fields reordered");
        assert!(!same_as_read(&stored, &doc! { "_id": 1, "a": 1, "b": 3 }), "value");
        assert!(!same_as_read(&stored, &doc! { "_id": 1, "a": 1_i64, "b": 2 }), "type");
        assert!(!same_as_read(&stored, &doc! { "_id": 1, "a": 1 }), "field removed");
    }

    #[test]
    fn update_filters_on_the_stored_document_in_its_order() {
        let id = ObjectId::new();
        let stored = doc! { "_id": id, "2024": 1, "2023": 2 };
        let command = update_unchanged("x", stored.clone(), doc! { "_id": id, "n": 1 });
        assert_eq!(
            command,
            doc! { "update": "x", "updates": [{
                "q": { "_id": id, "$expr": { "$eq": [{ "$objectToArray": "$$ROOT" }, { "$objectToArray": { "$literal": stored } }] } },
                "u": { "_id": id, "n": 1 }, "upsert": false,
            }] }
        );
    }
}

#[cfg(test)]
mod live_tests {
    use super::*;
    use mongodb::bson::oid::ObjectId;

    /// Lo que tiene el editor: el documento como Extended JSON canónico, pasado por un objeto de JS.
    fn as_the_editor_has_it(doc: &Document) -> Document {
        command_from_json(Bson::Document(in_js_order(doc)).into_canonical_extjson()).unwrap()
    }

    /// Un documento con claves numéricas en orden no ascendente (también anidadas) y valores de
    /// cualquier tipo se guarda, y deja de guardarse en cuanto otro proceso lo modifica. Con el filtro
    /// armado desde la copia del editor (lo que se hacía antes) no coincidía nunca.
    #[tokio::test]
    #[ignore = "necesita MongoDB en 127.0.0.1:27017"]
    async fn live_saves_documents_with_numeric_keys_only_while_unchanged() {
        use mongodb::bson::{Binary, DateTime, Decimal128, Regex, spec::BinarySubtype};
        let client = Client::with_uri_str("mongodb://127.0.0.1:27017").await.unwrap();
        let db = client.database("robo3b_test_replace_unchanged");
        db.drop(None).await.unwrap();
        let docs = db.collection::<Document>("x");
        let original = doc! {
            "_id": ObjectId::new(), "2024": 1, "2023": 2, "nested": { "x": 1, "10": 2, "9": 3, "list": [1, "x", { "deep": true }] },
            "int": 1, "long": 2_i64, "double": 1.5, "decimal": "0.1".parse::<Decimal128>().unwrap(),
            "date": DateTime::from_millis(1_700_000_000_123), "text": "á", "null": Bson::Null,
            "regex": Regex { pattern: "a/b".into(), options: "im".into() },
            "bin": Binary { subtype: BinarySubtype::Generic, bytes: vec![1, 2] },
        };
        docs.insert_one(original, None).await.unwrap();
        let read = as_the_editor_has_it(&docs.find_one(None, None).await.unwrap().unwrap());

        // Antes: el filtro con la copia del editor no coincide con lo guardado.
        let old = update_unchanged("x", read.clone(), read.clone());
        assert_eq!(db.run_command(old, None).await.unwrap().get_i32("n"), Ok(0));

        let mut edited = read.clone();
        edited.insert("text", "editado");
        let reply = replace_unchanged_in(&client, db.name(), "x", read.clone(), edited.clone()).await.unwrap();
        assert_eq!(reply.get_i32("n"), Ok(1));
        assert_eq!(docs.find_one(None, None).await.unwrap().unwrap().get_str("text"), Ok("editado"));

        // Otro proceso lo cambia: guardar desde lo leído ya no coincide.
        let read = as_the_editor_has_it(&docs.find_one(None, None).await.unwrap().unwrap());
        docs.update_one(doc! {}, doc! { "$set": { "nested.10": 99 } }, None).await.unwrap();
        let reply = replace_unchanged_in(&client, db.name(), "x", read.clone(), edited.clone()).await.unwrap();
        assert_eq!(reply.get_i32("n"), Ok(0));

        // Y si ya no existe, tampoco.
        docs.delete_one(doc! {}, None).await.unwrap();
        let reply = replace_unchanged_in(&client, db.name(), "x", read, edited).await.unwrap();
        assert_eq!(reply.get_i32("n"), Ok(0));
        db.drop(None).await.unwrap();
    }

    /// El `update` que arma la edición en línea (`commandDocumentStore.update` + `fieldUpdate`):
    /// cambia solo ese campo y conserva su tipo BSON; si otro proceso cambió el campo no coincide, y
    /// con safe mode activo ni se envía.
    #[tokio::test]
    #[ignore = "necesita MongoDB en 127.0.0.1:27017"]
    async fn live_inline_edit_sets_one_field_keeping_its_type() {
        use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};
        use serde_json::{Value, json};
        let client = Client::with_uri_str("mongodb://127.0.0.1:27017").await.unwrap();
        let db = client.database("robo3b_test_inline_edit");
        db.drop(None).await.unwrap();
        let docs = db.collection::<Document>("x");
        let id = ObjectId::new();
        let original = doc! {
            "_id": id, "EECC": { "RUC": "1", "name": "x" }, "int": 5, "double": 1.5, "flag": true, "tags": ["a", "b"],
        };
        docs.insert_one(original, None).await.unwrap();

        let set = |field: &str, before: Value, after: Value| {
            command_from_json(json!({ "update": "x", "updates": [{
                "q": { "_id": { "$oid": id.to_hex() }, field: before },
                "u": { "$set": { field: after } }, "upsert": false, "multi": false,
            }] }))
            .unwrap()
        };
        let edits = [
            set("EECC.RUC", json!("1"), json!("20100")),
            set("int", json!({ "$numberInt": "5" }), json!({ "$numberInt": "6" })),
            set("double", json!({ "$numberDouble": "1.5" }), json!({ "$numberDouble": "7.0" })),
            set("flag", json!(true), json!(false)),
            set("tags.1", json!("b"), json!("c")),
        ];
        for edit in edits {
            SafeMode::new(false).check_command(&edit).unwrap();
            assert_eq!(db.run_command(edit, None).await.unwrap().get_i32("n"), Ok(1));
        }
        let stored = docs.find_one(None, None).await.unwrap().unwrap();
        assert_eq!(
            stored,
            doc! { "_id": id, "EECC": { "RUC": "20100", "name": "x" }, "int": 6, "double": 7.0, "flag": false, "tags": ["a", "c"] }
        );
        assert!(matches!(stored.get("int"), Some(Bson::Int32(6))));
        assert!(matches!(stored.get("double"), Some(Bson::Double(_))));

        // Otro proceso ya lo cambió: el valor leído no coincide y no se pisa.
        let stale = set("int", json!({ "$numberInt": "5" }), json!({ "$numberInt": "9" }));
        assert_eq!(db.run_command(stale.clone(), None).await.unwrap().get_i32("n"), Ok(0));
        assert_eq!(docs.find_one(None, None).await.unwrap().unwrap().get_i32("int"), Ok(6));

        assert_eq!(SafeMode::new(true).check_command(&stale), Err(SAFE_MODE_ERROR.to_string()));
        db.drop(None).await.unwrap();
    }
}
