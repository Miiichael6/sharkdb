//! Herramientas del servidor MCP: su descripción para `tools/list` y la traducción de cada llamada
//! al comando de MongoDB que la responde. Lógica pura: no toca sesiones ni servidores.
//!
//! Los argumentos llegan en JSON extendido (`{"$oid": "…"}`, `{"$date": "…"}`), como los escribe
//! cualquier cliente MongoDB.

use mongodb::bson::{Bson, Document, doc};
use serde_json::{Map, Value, json};

/// Documentos que devuelve `find` si no se pide otro número, y el máximo que se acepta.
pub const DEFAULT_LIMIT: i64 = 20;
pub const MAX_LIMIT: i64 = 200;
/// Documentos que se muestrean para deducir el esquema de una colección.
pub const DEFAULT_SAMPLE: i64 = 100;
pub const MAX_SAMPLE: i64 = 1000;
const ADMIN_DB: &str = "admin";

/// Qué parte de la respuesta del servidor le interesa al agente.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Reply {
    Databases,
    Collections,
    Documents,
    Count,
    Write,
    Schema,
}

/// Lo que hay que hacer para responder una llamada.
#[derive(Debug, PartialEq)]
pub enum ToolCall {
    ListConnections,
    /// `command` sobre la base `db` de la conexión `connection` (su nombre o su id).
    Command { connection: String, db: String, command: Document, reply: Reply },
}

pub mod names {
    pub const LIST_CONNECTIONS: &str = "list_connections";
    pub const LIST_DATABASES: &str = "list_databases";
    pub const LIST_COLLECTIONS: &str = "list_collections";
    pub const FIND: &str = "find";
    pub const AGGREGATE: &str = "aggregate";
    pub const COUNT: &str = "count";
    pub const COLLECTION_SCHEMA: &str = "collection_schema";
    pub const INSERT: &str = "insert";
    pub const UPDATE: &str = "update";
    pub const DELETE: &str = "delete";
}
use names::*;

/// Argumentos que comparten las herramientas, por nivel: conexión, base, colección.
fn scope_properties(level: usize) -> Map<String, Value> {
    let all = [
        ("connection", "Nombre de la conexión, tal como lo devuelve list_connections"),
        ("database", "Nombre de la base de datos"),
        ("collection", "Nombre de la colección"),
    ];
    all[..level].iter().map(|(name, about)| (name.to_string(), json!({ "type": "string", "description": about }))).collect()
}

fn tool(name: &str, description: &str, level: usize, extra: Value, required_extra: &[&str]) -> Value {
    let mut properties = scope_properties(level);
    if let Value::Object(extra) = extra {
        properties.extend(extra);
    }
    let required: Vec<&str> = ["connection", "database", "collection"][..level].iter().copied().chain(required_extra.iter().copied()).collect();
    json!({
        "name": name,
        "description": description,
        "inputSchema": { "type": "object", "properties": properties, "required": required },
    })
}

const FILTER: &str = "Filtro de MongoDB en JSON extendido, p. ej. {\"status\": \"A\", \"_id\": {\"$oid\": \"…\"}}";

/// Descripción de cada herramienta, como la pide `tools/list`.
pub fn specs() -> Vec<Value> {
    vec![
        tool(LIST_CONNECTIONS, "Conexiones de SharkDB que el usuario ha expuesto, con su safe mode (solo lectura)", 0, json!({}), &[]),
        tool(LIST_DATABASES, "Bases de datos de una conexión", 1, json!({}), &[]),
        tool(LIST_COLLECTIONS, "Colecciones y vistas de una base de datos", 2, json!({}), &[]),
        tool(
            FIND,
            &format!("Busca documentos (máximo {MAX_LIMIT} por llamada; usa skip para paginar)"),
            3,
            json!({
                "filter": { "type": "object", "description": FILTER },
                "projection": { "type": "object" },
                "sort": { "type": "object" },
                "limit": { "type": "integer", "description": format!("Por defecto {DEFAULT_LIMIT}") },
                "skip": { "type": "integer" },
            }),
            &[],
        ),
        tool(
            AGGREGATE,
            &format!("Ejecuta una agregación; devuelve como mucho {MAX_LIMIT} documentos. $out y $merge escriben"),
            3,
            json!({ "pipeline": { "type": "array", "items": { "type": "object" } } }),
            &["pipeline"],
        ),
        tool(COUNT, "Cuenta los documentos que cumplen un filtro", 3, json!({ "filter": { "type": "object", "description": FILTER } }), &[]),
        tool(
            COLLECTION_SCHEMA,
            "Deduce los campos de una colección y sus tipos a partir de una muestra de documentos",
            3,
            json!({ "sampleSize": { "type": "integer", "description": format!("Por defecto {DEFAULT_SAMPLE}") } }),
            &[],
        ),
        tool(
            INSERT,
            "Inserta documentos (escritura: se rechaza con safe mode activo)",
            3,
            json!({ "documents": { "type": "array", "items": { "type": "object" } } }),
            &["documents"],
        ),
        tool(
            UPDATE,
            "Actualiza documentos (escritura: se rechaza con safe mode activo)",
            3,
            json!({
                "filter": { "type": "object", "description": FILTER },
                "update": { "description": "Operadores de actualización ({\"$set\": …}) o pipeline" },
                "many": { "type": "boolean", "description": "Todos los que cumplen el filtro; por defecto solo el primero" },
                "upsert": { "type": "boolean" },
            }),
            &["filter", "update"],
        ),
        tool(
            DELETE,
            "Borra documentos (escritura: se rechaza con safe mode activo). El filtro no puede estar vacío",
            3,
            json!({
                "filter": { "type": "object", "description": FILTER },
                "many": { "type": "boolean", "description": "Todos los que cumplen el filtro; por defecto solo el primero" },
            }),
            &["filter"],
        ),
    ]
}

/// Argumentos de una llamada, con los mensajes de error que entiende el agente.
struct Args<'a>(&'a Map<String, Value>);

impl Args<'_> {
    fn text(&self, name: &str) -> Result<String, String> {
        match self.0.get(name) {
            Some(Value::String(s)) if !s.is_empty() => Ok(s.clone()),
            _ => Err(format!("Falta el argumento `{name}` (texto)")),
        }
    }

    fn bson(&self, name: &str) -> Result<Option<Bson>, String> {
        self.0
            .get(name)
            .filter(|v| !v.is_null())
            .map(|v| Bson::try_from(v.clone()).map_err(|e| format!("`{name}` no es JSON extendido válido: {e}")))
            .transpose()
    }

    fn document(&self, name: &str) -> Result<Option<Document>, String> {
        match self.bson(name)? {
            None => Ok(None),
            Some(Bson::Document(d)) => Ok(Some(d)),
            Some(_) => Err(format!("`{name}` debe ser un objeto")),
        }
    }

    fn document_or_empty(&self, name: &str) -> Result<Document, String> {
        Ok(self.document(name)?.unwrap_or_default())
    }

    fn documents(&self, name: &str) -> Result<Vec<Bson>, String> {
        match self.bson(name)? {
            Some(Bson::Array(items)) if items.iter().all(|i| matches!(i, Bson::Document(_))) => Ok(items),
            _ => Err(format!("`{name}` debe ser una lista de objetos")),
        }
    }

    fn int(&self, name: &str, default: i64, max: i64) -> Result<i64, String> {
        match self.0.get(name) {
            None | Some(Value::Null) => Ok(default),
            Some(v) => v
                .as_i64()
                .filter(|n| *n >= 0)
                .map(|n| n.min(max))
                .ok_or_else(|| format!("`{name}` debe ser un entero no negativo")),
        }
    }

    fn flag(&self, name: &str) -> bool {
        self.0.get(name).and_then(Value::as_bool).unwrap_or(false)
    }
}

/// Traduce la llamada `name(arguments)` a lo que hay que ejecutar.
pub fn parse_call(name: &str, arguments: &Value) -> Result<ToolCall, String> {
    let empty = Map::new();
    let args = Args(match arguments {
        Value::Object(map) => map,
        Value::Null => &empty,
        _ => return Err("Los argumentos deben ser un objeto".into()),
    });
    if name == LIST_CONNECTIONS {
        return Ok(ToolCall::ListConnections);
    }
    let connection = args.text("connection")?;
    let on = |db: String, command: Document, reply: Reply| Ok(ToolCall::Command { connection: connection.clone(), db, command, reply });
    if name == LIST_DATABASES {
        return on(ADMIN_DB.into(), doc! { "listDatabases": 1, "nameOnly": true, "authorizedDatabases": true }, Reply::Databases);
    }
    let db = args.text("database")?;
    if name == LIST_COLLECTIONS {
        return on(db, doc! { "listCollections": 1, "nameOnly": true, "authorizedCollections": true }, Reply::Collections);
    }
    let coll = args.text("collection")?;
    let (command, reply) = match name {
        FIND => (find_command(&coll, &args)?, Reply::Documents),
        AGGREGATE => {
            let pipeline = args.documents("pipeline")?;
            (doc! { "aggregate": coll, "pipeline": pipeline, "cursor": { "batchSize": MAX_LIMIT } }, Reply::Documents)
        }
        COUNT => (doc! { "count": coll, "query": args.document_or_empty("filter")? }, Reply::Count),
        COLLECTION_SCHEMA => {
            let size = args.int("sampleSize", DEFAULT_SAMPLE, MAX_SAMPLE)?;
            (doc! { "aggregate": coll, "pipeline": [{ "$sample": { "size": size } }], "cursor": { "batchSize": size } }, Reply::Schema)
        }
        INSERT => (doc! { "insert": coll, "documents": args.documents("documents")? }, Reply::Write),
        UPDATE => (update_command(&coll, &args)?, Reply::Write),
        DELETE => (delete_command(&coll, &args)?, Reply::Write),
        _ => return Err(format!("Herramienta desconocida: {name}")),
    };
    on(db, command, reply)
}

fn find_command(coll: &str, args: &Args) -> Result<Document, String> {
    let mut command = doc! {
        "find": coll,
        "filter": args.document_or_empty("filter")?,
        "limit": args.int("limit", DEFAULT_LIMIT, MAX_LIMIT)?,
        "singleBatch": true,
    };
    for option in ["projection", "sort"] {
        if let Some(value) = args.document(option)? {
            command.insert(option, value);
        }
    }
    let skip = args.int("skip", 0, i64::MAX)?;
    if skip > 0 {
        command.insert("skip", skip);
    }
    Ok(command)
}

fn update_command(coll: &str, args: &Args) -> Result<Document, String> {
    let update = match args.bson("update")? {
        Some(u @ (Bson::Document(_) | Bson::Array(_))) => u,
        _ => return Err("`update` debe ser un objeto con operadores o un pipeline".into()),
    };
    let statement = doc! {
        "q": args.document_or_empty("filter")?,
        "u": update,
        "multi": args.flag("many"),
        "upsert": args.flag("upsert"),
    };
    Ok(doc! { "update": coll, "updates": [statement] })
}

fn delete_command(coll: &str, args: &Args) -> Result<Document, String> {
    let filter = args.document_or_empty("filter")?;
    if filter.is_empty() {
        return Err("Para borrar hace falta un filtro explícito; un filtro vacío borraría toda la colección".into());
    }
    let limit = if args.flag("many") { 0 } else { 1 };
    Ok(doc! { "delete": coll, "deletes": [{ "q": filter, "limit": limit }] })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::safe_mode::is_write_command;

    fn command(name: &str, args: Value) -> (Document, Reply) {
        match parse_call(name, &args).unwrap() {
            ToolCall::Command { command, reply, .. } => (command, reply),
            other => panic!("{other:?}"),
        }
    }

    /// Los argumentos de una colección de prueba, más `extra`.
    fn scope(extra: Value) -> Value {
        let mut base = json!({ "connection": "local", "database": "shop", "collection": "orders" });
        base.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        base
    }

    #[test]
    fn every_spec_has_a_name_and_an_object_schema() {
        let specs = specs();
        assert_eq!(specs.len(), 10);
        for spec in specs {
            assert!(spec["name"].is_string());
            assert_eq!(spec["inputSchema"]["type"], "object");
        }
    }

    #[test]
    fn find_converts_extended_json_and_caps_the_limit() {
        let (cmd, reply) = command(FIND, scope(json!({ "filter": { "_id": { "$oid": "65a1b2c3d4e5f6a7b8c9d0e1" } }, "limit": 5000, "skip": 10 })));
        assert_eq!(reply, Reply::Documents);
        assert_eq!(cmd.get_str("find").unwrap(), "orders");
        assert!(matches!(cmd.get_document("filter").unwrap().get("_id"), Some(Bson::ObjectId(_))));
        assert_eq!(cmd.get_i64("limit").unwrap(), MAX_LIMIT);
        assert_eq!(cmd.get_i64("skip").unwrap(), 10);
        assert!(!is_write_command(&cmd));
    }

    #[test]
    fn writes_are_write_commands_and_reads_are_not() {
        let insert = command(INSERT, scope(json!({ "documents": [{ "a": 1 }] }))).0;
        let update = command(UPDATE, scope(json!({ "filter": { "a": 1 }, "update": { "$set": { "b": 2 } }, "many": true }))).0;
        let delete = command(DELETE, scope(json!({ "filter": { "a": 1 } }))).0;
        let out = command(AGGREGATE, scope(json!({ "pipeline": [{ "$match": {} }, { "$out": "copy" }] }))).0;
        for write in [&insert, &update, &delete, &out] {
            assert!(is_write_command(write), "{write}");
        }
        assert!(update.get_array("updates").unwrap()[0].as_document().unwrap().get_bool("multi").unwrap());
        assert_eq!(delete.get_array("deletes").unwrap()[0].as_document().unwrap().get_i32("limit").unwrap(), 1);
        let count = command(COUNT, scope(json!({}))).0;
        let schema = command(COLLECTION_SCHEMA, scope(json!({}))).0;
        assert!(!is_write_command(&count) && !is_write_command(&schema));
    }

    #[test]
    fn delete_refuses_an_empty_filter() {
        assert!(parse_call(DELETE, &scope(json!({ "filter": {} }))).is_err());
        assert!(parse_call(DELETE, &scope(json!({}))).is_err());
    }

    #[test]
    fn missing_or_malformed_arguments_are_explained() {
        assert_eq!(parse_call(LIST_DATABASES, &json!({})).unwrap_err(), "Falta el argumento `connection` (texto)");
        assert!(parse_call(FIND, &scope(json!({ "filter": [1] }))).is_err());
        assert!(parse_call(FIND, &scope(json!({ "limit": -1 }))).is_err());
        assert!(parse_call(INSERT, &scope(json!({ "documents": [1] }))).is_err());
        assert!(parse_call("drop_everything", &scope(json!({}))).is_err());
        assert_eq!(parse_call(LIST_CONNECTIONS, &Value::Null).unwrap(), ToolCall::ListConnections);
    }

    #[test]
    fn list_databases_runs_on_admin() {
        match parse_call(LIST_DATABASES, &json!({ "connection": "local" })).unwrap() {
            ToolCall::Command { db, reply, .. } => assert_eq!((db.as_str(), reply), (ADMIN_DB, Reply::Databases)),
            other => panic!("{other:?}"),
        }
    }
}
