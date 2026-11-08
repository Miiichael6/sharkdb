//! De la respuesta del servidor MongoDB, lo que se le devuelve al agente. Lógica pura.

use mongodb::bson::{Bson, Document};
use serde_json::{Value, json};

use super::schema;
use super::tools::Reply;
use crate::mongo::reply_to_json;

/// Texto máximo que se devuelve por llamada: lo que pase de aquí se corta y se avisa.
pub const MAX_REPLY_CHARS: usize = 60_000;

fn first_batch(reply: &Document) -> Vec<Document> {
    reply
        .get_document("cursor")
        .and_then(|c| c.get_array("firstBatch"))
        .map(|batch| batch.iter().filter_map(Bson::as_document).cloned().collect())
        .unwrap_or_default()
}

fn names(items: impl IntoIterator<Item = Document>) -> Value {
    items.into_iter().filter_map(|d| d.get_str("name").ok().map(str::to_string)).collect()
}

/// La parte de `reply` que interesa según `shape`, en JSON extendido relajado.
pub fn shape(shape: Reply, reply: Document) -> Value {
    match shape {
        Reply::Databases => {
            let dbs = reply.get_array("databases").map(|a| a.iter().filter_map(Bson::as_document).cloned().collect::<Vec<_>>());
            names(dbs.unwrap_or_default())
        }
        Reply::Collections => first_batch(&reply)
            .into_iter()
            .map(|c| json!({ "name": c.get_str("name").unwrap_or("?"), "type": c.get_str("type").unwrap_or("collection") }))
            .collect(),
        Reply::Documents => first_batch(&reply).into_iter().map(reply_to_json).collect(),
        Reply::Count => json!({ "count": reply.get("n").cloned().map(Bson::into_relaxed_extjson) }),
        Reply::Write => {
            let mut summary = reply;
            summary.remove("ok");
            reply_to_json(summary)
        }
        Reply::Schema => serde_json::to_value(schema::infer(&first_batch(&reply))).unwrap_or(Value::Null),
    }
}

/// `text` cortado a `max` caracteres, con `notice` al final si se cortó.
pub fn truncate(text: String, max: usize, notice: &str) -> String {
    if text.chars().count() <= max {
        return text;
    }
    let cut: String = text.chars().take(max).collect();
    format!("{cut}\n… {notice}")
}

/// `value` como texto para el agente, cortado a `MAX_REPLY_CHARS`.
pub fn to_text(value: &Value) -> String {
    let text = serde_json::to_string_pretty(value).unwrap_or_default();
    let notice = format!("(respuesta cortada a {MAX_REPLY_CHARS} caracteres: pide menos documentos o usa projection)");
    truncate(text, MAX_REPLY_CHARS, &notice)
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    fn cursor(batch: Vec<Document>) -> Document {
        doc! { "cursor": { "firstBatch": batch, "id": 0_i64 }, "ok": 1.0 }
    }

    #[test]
    fn databases_and_collections_are_reduced_to_their_names() {
        let dbs = doc! { "databases": [{ "name": "a" }, { "name": "b" }], "ok": 1.0 };
        assert_eq!(shape(Reply::Databases, dbs), json!(["a", "b"]));
        let colls = cursor(vec![doc! { "name": "orders", "type": "collection" }, doc! { "name": "v", "type": "view" }]);
        assert_eq!(shape(Reply::Collections, colls)[1], json!({ "name": "v", "type": "view" }));
    }

    #[test]
    fn documents_count_and_writes_keep_what_the_agent_needs() {
        assert_eq!(shape(Reply::Documents, cursor(vec![doc! { "a": 1 }])), json!([{ "a": 1 }]));
        assert_eq!(shape(Reply::Count, doc! { "n": 7, "ok": 1.0 }), json!({ "count": 7 }));
        assert_eq!(shape(Reply::Write, doc! { "n": 2, "nModified": 1, "ok": 1.0 }), json!({ "n": 2, "nModified": 1 }));
        assert_eq!(shape(Reply::Schema, cursor(vec![doc! { "a": 1 }]))["sampled"], 1);
    }

    #[test]
    fn long_replies_are_cut_with_a_notice() {
        let long = Value::String("x".repeat(MAX_REPLY_CHARS * 2));
        let text = to_text(&long);
        assert!(text.contains("respuesta cortada"));
        assert!(text.chars().count() < MAX_REPLY_CHARS + 200);
    }
}
