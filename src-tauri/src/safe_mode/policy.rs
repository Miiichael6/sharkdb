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
    "deleteindexes", // alias histórico de dropIndexes
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
    // índices de Atlas Search
    "createsearchindexes",
    "updatesearchindex",
    "dropsearchindex",
    // operaciones, sesiones y transacciones ajenas: matarlas interrumpe sus escrituras
    "killop",
    "killcursors",
    "killsessions",
    "killallsessions",
    "killallsessionsbypattern",
    "aborttransaction",
    "committransaction",
    "dropconnections",
    // configuración y estado del servidor
    "shutdown",
    "fsync",
    "fsyncunlock",
    "setparameter",
    "setclusterparameter",
    "setfeaturecompatibilityversion",
    "setdefaultrwconcern",
    "setuserwriteblockmode",
    "setindexcommitquorum",
    "logrotate",
    "rotatecertificates",
    "plancacheclear",
    "plancacheclearfilters",
    "plancachesetfilter",
    "setquerysettings",
    "removequerysettings",
    "configurequeryanalyzer",
    "setchangestreamstate",
    "appendoplognote",
    "setprofilinglevel",
    "autocompact",
    "setfreemonitoring",
    // Queryable Encryption: compactan o limpian las colecciones de metadatos
    "compactstructuredencryptiondata",
    "cleanupstructuredencryptiondata",
    // replica set
    "replsetinitiate",
    "replsetreconfig",
    "replsetstepdown",
    "replsetfreeze",
    "replsetmaintenance",
    "replsetsyncfrom",
    "replsetresizeoplog",
    "replsetabortprimarycatchup",
    // sharding
    "addshard",
    "removeshard",
    "enablesharding",
    "shardcollection",
    "unshardcollection",
    "reshardcollection",
    "commitreshardcollection",
    "abortreshardcollection",
    "refinecollectionshardkey",
    "movechunk",
    "moverange",
    "moveprimary",
    "movecollection",
    "abortmovecollection",
    "abortunshardcollection",
    "split",
    "mergechunks",
    "mergeallchunksonshard",
    "clearjumboflag",
    "cleanuporphaned",
    "balancerstart",
    "balancerstop",
    "configurecollectionbalancing",
    "setallowmigrations",
    "addshardtozone",
    "removeshardfromzone",
    "updatezonekeyrange",
    "transitiontodedicatedconfigserver",
    "transitionfromdedicatedconfigserver",
    // ejecución de código arbitrario en el servidor
    "eval",
    "$eval",
];

/// Etapas de agregación que escriben su resultado en una colección.
const WRITE_STAGES: &[&str] = &["$out", "$merge"];

const AGGREGATE: &str = "aggregate";
const MAP_REDUCE: &str = "mapreduce";
const EXPLAIN: &str = "explain";
const PROFILE: &str = "profile";
const VALIDATE: &str = "validate";

/// Opciones de `profile` que se aplican aunque el nivel sea -1 (solo consultar).
const PROFILE_SETTINGS: &[&str] = &["slowms", "samplerate", "filter"];

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
        // Se juzga por lo que explica: así no hay que fiarse de qué verbosidades ejecutan.
        EXPLAIN => command.get_document(EXPLAIN).is_ok_and(is_write_command),
        PROFILE => changes_profiling(command),
        // Sin `repair` solo comprueba la colección.
        VALIDATE => command.iter().any(|(key, value)| key.eq_ignore_ascii_case("repair") && is_truthy(value)),
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

/// `profile: -1` solo devuelve la configuración; otro nivel, o cambiar `slowms`, `sampleRate` o
/// `filter`, la modifica.
fn changes_profiling(command: &Document) -> bool {
    let level = command.iter().next().and_then(|(_, level)| number(level));
    level != Some(-1.0)
        || command
            .keys()
            .any(|key| PROFILE_SETTINGS.contains(&key.to_lowercase().as_str()))
}

fn number(value: &Bson) -> Option<f64> {
    match value {
        Bson::Int32(n) => Some(f64::from(*n)),
        Bson::Int64(n) => Some(*n as f64),
        Bson::Double(n) => Some(*n),
        _ => None,
    }
}

/// Como lo interpreta el servidor: `true` o un número distinto de 0.
fn is_truthy(value: &Bson) -> bool {
    match value {
        Bson::Boolean(b) => *b,
        Bson::Null | Bson::Undefined => false,
        other => number(other).is_none_or(|n| n != 0.0),
    }
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
            doc! { "explain": { "find": "x", "filter": {} }, "verbosity": "executionStats" },
            doc! { "serverStatus": 1 },
            doc! { "getParameter": 1, "notablescan": 1 },
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
            doc! { "shutdown": 1 },
            doc! { "fsync": 1, "lock": true },
            doc! { "replSetStepDown": 60 },
            doc! { "setFeatureCompatibilityVersion": "7.0" },
            doc! { "setParameter": 1, "notablescan": true },
            doc! { "killAllSessions": [] },
            doc! { "abortTransaction": 1 },
            doc! { "shardCollection": "a.x", "key": { "_id": 1 } },
            doc! { "dropSearchIndex": "x", "name": "s" },
            doc! { "planCacheClear": "x" },
            doc! { "dropConnections": 1, "hostAndPort": [] },
            doc! { "setDefaultRWConcern": 1 },
            doc! { "cleanupOrphaned": "a.x" },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn zones_query_settings_and_cluster_transitions_are_writes() {
        for command in [
            doc! { "deleteIndexes": "x", "index": "*" },
            doc! { "deleteindexes": "x", "index": "a_1" },
            doc! { "addShardToZone": "shard0", "zone": "z" },
            doc! { "removeShardFromZone": "shard0", "zone": "z" },
            doc! { "updateZoneKeyRange": "a.x", "min": { "k": 0 }, "max": { "k": 10 }, "zone": null },
            doc! { "setQuerySettings": { "find": "x", "filter": {}, "$db": "a" }, "settings": {} },
            doc! { "removeQuerySettings": "hash" },
            doc! { "configureQueryAnalyzer": "a.x", "mode": "full", "samplesPerSecond": 1 },
            doc! { "transitionToDedicatedConfigServer": 1 },
            doc! { "transitionFromDedicatedConfigServer": 1 },
            doc! { "abortMoveCollection": "a.x" },
            doc! { "abortUnshardCollection": "a.x" },
            doc! { "setChangeStreamState": 1, "enabled": false },
            doc! { "appendOplogNote": 1, "data": {} },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn profiling_monitoring_and_encryption_maintenance_are_writes() {
        for command in [
            doc! { "setProfilingLevel": 2 },
            doc! { "autoCompact": true },
            doc! { "setFreeMonitoring": 1, "action": "enable" },
            doc! { "compactStructuredEncryptionData": "x", "compactionTokens": {} },
            doc! { "cleanupStructuredEncryptionData": "x", "cleanupTokens": {} },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn profile_is_a_write_unless_it_only_reads_the_settings() {
        for command in [
            doc! { "profile": 2 },
            doc! { "profile": 1, "slowms": 50 },
            doc! { "profile": 0 },
            doc! { "profile": -1, "slowms": 50 },
            doc! { "profile": -1, "sampleRate": 0.5 },
            doc! { "profile": -1, "filter": { "op": "query" } },
            doc! { "profile": "2" },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
        for command in [
            doc! { "profile": -1 },
            doc! { "profile": -1_i64 },
            doc! { "profile": -1.0, "comment": "x" },
        ] {
            assert!(!is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn validate_is_a_write_only_when_it_repairs() {
        for command in [
            doc! { "validate": "x", "repair": true },
            doc! { "validate": "x", "repair": 1 },
        ] {
            assert!(is_write_command(&command), "{command}");
        }
        for command in [
            doc! { "validate": "x" },
            doc! { "validate": "x", "full": true },
            doc! { "validate": "x", "repair": false },
            doc! { "validate": "x", "repair": 0 },
        ] {
            assert!(!is_write_command(&command), "{command}");
        }
    }

    #[test]
    fn explaining_a_new_write_command_is_a_write() {
        let command = doc! { "explain": { "deleteIndexes": "x", "index": "*" } };
        assert!(is_write_command(&command));
    }

    #[test]
    fn the_list_is_in_lowercase() {
        for name in WRITE_COMMANDS {
            assert_eq!(*name, name.to_lowercase());
        }
    }

    #[test]
    fn explain_is_judged_by_the_command_it_explains() {
        for inner in [
            doc! { "update": "x", "updates": [{ "q": {}, "u": { "$set": { "a": 1 } } }] },
            doc! { "delete": "x", "deletes": [{ "q": {}, "limit": 0 }] },
            doc! { "findAndModify": "x", "remove": true },
            doc! { "aggregate": "x", "pipeline": [{ "$out": "y" }], "cursor": {} },
        ] {
            let command = doc! { "explain": inner, "verbosity": "executionStats" };
            assert!(is_write_command(&command), "{command}");
        }
        assert!(!is_write_command(&doc! { "explain": "x" }));
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
