//! Esquema deducido de una muestra de documentos: cada campo (con su ruta, `a.b.c`), los tipos en
//! que aparece y en cuántos documentos está. Lógica pura.

use std::collections::BTreeMap;

use mongodb::bson::{Bson, Document};
use serde::Serialize;

/// Profundidad hasta la que se describen los subdocumentos.
const MAX_DEPTH: usize = 4;

#[derive(Debug, Default, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldSummary {
    pub field: String,
    pub types: Vec<&'static str>,
    /// Documentos de la muestra en los que aparece.
    pub present_in: usize,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchemaSummary {
    pub sampled: usize,
    pub fields: Vec<FieldSummary>,
}

/// Nombre del tipo BSON como lo escribe el shell.
pub fn type_name(value: &Bson) -> &'static str {
    match value {
        Bson::Double(_) => "Double",
        Bson::String(_) => "String",
        Bson::Array(_) => "Array",
        Bson::Document(_) => "Object",
        Bson::Boolean(_) => "Boolean",
        Bson::Null | Bson::Undefined => "Null",
        Bson::RegularExpression(_) => "RegExp",
        Bson::JavaScriptCode(_) | Bson::JavaScriptCodeWithScope(_) => "Code",
        Bson::Int32(_) => "Int32",
        Bson::Int64(_) => "Int64",
        Bson::Timestamp(_) => "Timestamp",
        Bson::Binary(_) => "Binary",
        Bson::ObjectId(_) => "ObjectId",
        Bson::DateTime(_) => "Date",
        Bson::Symbol(_) => "Symbol",
        Bson::Decimal128(_) => "Decimal128",
        Bson::MaxKey => "MaxKey",
        Bson::MinKey => "MinKey",
        Bson::DbPointer(_) => "DBPointer",
    }
}

fn visit(doc: &Document, prefix: &str, depth: usize, seen: &mut BTreeMap<String, FieldSummary>) {
    for (key, value) in doc {
        let path = if prefix.is_empty() { key.clone() } else { format!("{prefix}.{key}") };
        let entry = seen.entry(path.clone()).or_insert_with(|| FieldSummary { field: path.clone(), ..Default::default() });
        entry.present_in += 1;
        let name = type_name(value);
        if !entry.types.contains(&name) {
            entry.types.push(name);
        }
        if let Bson::Document(inner) = value
            && depth < MAX_DEPTH
        {
            visit(inner, &path, depth + 1, seen);
        }
    }
}

/// Los campos de `sample`, en orden alfabético de ruta.
pub fn infer(sample: &[Document]) -> SchemaSummary {
    let mut seen = BTreeMap::new();
    for doc in sample {
        visit(doc, "", 1, &mut seen);
    }
    SchemaSummary { sampled: sample.len(), fields: seen.into_values().collect() }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    #[test]
    fn counts_presence_and_mixed_types_of_nested_fields() {
        let sample = [
            doc! { "_id": 1, "name": "a", "address": { "city": "Lima" } },
            doc! { "_id": 2_i64, "address": { "city": "Quito", "zip": 1 } },
        ];
        let schema = infer(&sample);
        assert_eq!(schema.sampled, 2);
        let field = |path: &str| schema.fields.iter().find(|f| f.field == path).unwrap();
        assert_eq!(field("_id").types, ["Int32", "Int64"]);
        assert_eq!(field("name").present_in, 1);
        assert_eq!(field("address").types, ["Object"]);
        assert_eq!(field("address.city").present_in, 2);
        assert_eq!(field("address.zip").present_in, 1);
    }

    #[test]
    fn stops_describing_below_the_maximum_depth() {
        let deep = doc! { "a": { "b": { "c": { "d": { "e": 1 } } } } };
        let fields: Vec<String> = infer(&[deep]).fields.into_iter().map(|f| f.field).collect();
        assert_eq!(fields, ["a", "a.b", "a.b.c", "a.b.c.d"]);
    }
}
