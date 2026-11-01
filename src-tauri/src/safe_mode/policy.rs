//! Qué comandos de MongoDB escriben. Lógica pura: se clasifica el documento del comando, sin
//! tocar el servidor. Es la lista que aplica el backend; la UI tiene la suya solo para
//! deshabilitar acciones.

use mongodb::bson::{Bson, Document};

/// Comandos que modifican datos, índices, colecciones, bases de datos o usuarios. En minúsculas:
/// el servidor acepta el nombre del comando sin distinguir mayúsculas (`findandmodify`).
const WRITE_COMMANDS: &[&str] = &[
    // documentos
    "insert",
    "update",
    "delete",
    "findandmodify",
    "bulkwrite",
    "applyops",
    // colecciones y bases de datos
    "create",
    "drop",
    "dropdatabase",
    "renamecollection",
    "collmod",
    "converttocapped",
    "clonecollectionascapped",
    "compact",
    "reindex",
    // índices
    "createindexes",
    "dropindexes",
    // usuarios y roles
    "createuser",
    "updateuser",
    "dropuser",
    "dropallusersfromdatabase",
    "grantrolestouser",
    "revokerolesfromuser",
    "createrole",
    "updaterole",
    "droprole",
    "dropallrolesfromdatabase",
    "grantprivilegestorole",
    "revokeprivilegesfromrole",
    "grantrolestorole",
    "revokerolesfromrole",
    // operaciones del servidor: matar una operación ajena interrumpe su escritura
    "killop",
    // ejecución de código arbitrario en el servidor
    "eval",
    "$eval",
];

/// Etapas de agregación que escriben su resultado en una colección.
const WRITE_STAGES: &[&str] = &["$out", "$merge"];

const AGGREGATE: &str = "aggregate";
const MAP_REDUCE: &str = "mapreduce";

/// El nombre del comando es su primera clave.
fn command_name(command: &Document) -> Option<String> {
    command.keys().next().map(|name| name.to_lowercase())
}

/// Si el comando, tal como llegaría al servidor, modifica algo.
pub fn is_write_command(command: &Document) -> bool {
    let Some(name) = command_name(command) else {
        return false;
    };
    match name.as_str() {
        AGGREGATE => command
            .get_array("pipeline")
            .map(|stages| stages.iter().any(is_write_stage))
            .unwrap_or(false),
        MAP_REDUCE => !is_inline_output(command.get("out")),
        _ => WRITE_COMMANDS.contains(&name.as_str()),
    }
}

/// Si una agregación (`collection.aggregate`) escribe: alguna etapa es `$out` o `$merge`.
pub fn is_write_pipeline(pipeline: &[Document]) -> bool {
    pipeline.iter().any(writes_to_collection)
}

fn is_write_stage(stage: &Bson) -> bool {
    stage.as_document().is_some_and(writes_to_collection)
}

fn writes_to_collection(stage: &Document) -> bool {
    stage.keys().any(|key| WRITE_STAGES.contains(&key.as_str()))
}

/// `mapReduce` solo es de lectura con `out: { inline: 1 }`.
fn is_inline_output(out: Option<&Bson>) -> bool {
    matches!(out, Some(Bson::Document(out)) if out.contains_key("inline"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    #[test]
    fn reads_are_allowed() {
        for command in [
            doc! { "find": "x", "filter": {} },
            doc! { "count": "x" },
            doc! { "listCollections": 1 },
            doc! { "listIndexes": "x" },
            doc! { "usersInfo": 1 },
            doc! { "dbStats": 1 },
            doc! { "aggregate": "x", "pipeline": [{ "$match": {} }], "cursor": {} },
            doc! { "mapReduce": "x", "out": { "inline": 1 } },
            doc! {},
        ] {
            assert!(!is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn writes_are_detected_whatever_the_case() {
        for command in [
            doc! { "insert": "x", "documents": [] },
            doc! { "update": "x", "updates": [] },
            doc! { "delete": "x", "deletes": [] },
            doc! { "findandmodify": "x" },
            doc! { "findAndModify": "x" },
            doc! { "drop": "x" },
            doc! { "dropDatabase": 1 },
            doc! { "renameCollection": "a.x", "to": "a.y" },
            doc! { "create": "x" },
            doc! { "createIndexes": "x", "indexes": [] },
            doc! { "dropIndexes": "x", "index": "a_1" },
            doc! { "createUser": "u", "pwd": "p", "roles": [] },
            doc! { "grantRolesToUser": "u", "roles": [] },
            doc! { "killOp": 1, "op": 12 },
            doc! { "mapReduce": "x", "out": "y" },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn aggregations_write_with_out_or_merge() {
        assert!(is_write_command(
            &doc! { "aggregate": "x", "pipeline": [{ "$match": {} }, { "$out": "y" }] }
        ));
        assert!(is_write_command(
            &doc! { "aggregate": "x", "pipeline": [{ "$merge": { "into": "y" } }] }
        ));
        assert!(is_write_pipeline(&[
            doc! { "$group": { "_id": 1 } },
            doc! { "$out": "y" }
        ]));
        assert!(!is_write_pipeline(&[doc! { "$match": { "$out": 1 } }]));
        assert!(!is_write_pipeline(&[]));
    }
}
