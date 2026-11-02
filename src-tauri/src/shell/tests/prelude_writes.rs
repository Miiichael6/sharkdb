//! Escrituras del prelude contra el servidor falso: lotes por número de operaciones y por
//! tamaño, errores con su índice global y los bulk del shell clásico.

use mongodb::bson::{Bson, Document, doc};

use super::prelude::{DB, run_ok, session};
use super::{outputs, value};
use crate::shell::outcome::{ScriptError, ScriptOutput};
use crate::shell::session::ShellSession;

/// Tamaño de los documentos grandes de los tests: 17 caben en un comando de 16 MB.
const ONE_MB_DOC: &str = "({ s: 'x'.repeat(1024 * 1024) })";

fn run_err(session: &mut ShellSession, code: &str) -> ScriptError {
    session
        .run(DB, code, None)
        .error
        .expect("se esperaba un error")
}

/// Cada comando de escritura de escritura que recibió el servidor: nombre y operaciones enviadas.
fn write_batches(session: &mut ShellSession) -> Bson {
    let code = "__calls.filter(c => c.op === 'runCommand').map(c => {
        const [name] = Object.keys(c.command);
        const ops = c.command.documents ?? c.command.updates ?? c.command.deletes;
        return name + ':' + ops.length;
    })";
    value(&run_ok(session, code)).expect("lotes")
}

fn batches(list: &[&str]) -> Bson {
    Bson::Array(list.iter().map(|b| Bson::String((*b).into())).collect())
}

/// Resultado de la (única) escritura que muestra el script.
fn write_result(session: &mut ShellSession, code: &str) -> Document {
    let outcome = run_ok(session, code);
    outputs(&outcome)
        .into_iter()
        .find_map(|output| match output {
            ScriptOutput::Write {
                value: Bson::Document(result),
            } => Some(result.clone()),
            _ => None,
        })
        .unwrap_or_else(|| panic!("se esperaba una escritura: {:?}", outcome.results))
}

#[test]
fn insert_many_splits_at_max_write_batch_size() {
    let (mut session, _) = session();
    let result = write_result(
        &mut session,
        "db.x.insertMany(Array.from({ length: 150001 }, (_, i) => ({ _id: i })))",
    );
    assert_eq!(result.get_array("insertedIds").map(Vec::len), Ok(150_001));
    assert_eq!(
        write_batches(&mut session),
        batches(&["insert:100000", "insert:50001"])
    );
}

#[test]
fn insert_many_splits_at_sixteen_megabytes() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        &format!("db.x.insertMany(Array.from({{ length: 20 }}, () => {ONE_MB_DOC}))"),
    );
    assert_eq!(
        write_batches(&mut session),
        batches(&["insert:15", "insert:5"])
    );
}

#[test]
fn ordered_error_in_a_later_batch_has_its_global_index_and_stops() {
    let (mut session, _) = session();
    let code = format!(
        "var docs = Array.from({{ length: 40 }}, () => {ONE_MB_DOC}); docs[17].fail = 1;
         db.x.insertMany(docs)"
    );
    let error = run_err(&mut session, &code);
    assert!(error.message.starts_with("BulkWriteError: "), "{error:?}");
    assert!(error.message.contains("operación 17"), "{error:?}");
    assert!(
        error.message.contains("1 con error, 17 aplicadas"),
        "{error:?}"
    );
    assert_eq!(
        write_batches(&mut session),
        batches(&["insert:15", "insert:15"])
    );
}

#[test]
fn unordered_insert_applies_the_rest_and_reports_every_error() {
    let (mut session, _) = session();
    let error = run_err(
        &mut session,
        "db.x.insertMany([{ a: 1 }, { fail: 1 }, { a: 2 }, { fail: 2 }], { ordered: false })",
    );
    assert!(error.message.contains("operación 1"), "{error:?}");
    assert!(
        error.message.contains("2 con error, 2 aplicadas"),
        "{error:?}"
    );
}

#[test]
fn single_write_error_keeps_the_classic_message() {
    let (mut session, _) = session();
    let error = run_err(&mut session, "db.x.insertOne({ fail: 1 })");
    assert!(error.message.starts_with("WriteError: "), "{error:?}");
    assert!(error.message.ends_with("(código 11000)"), "{error:?}");
}

/// Mismas operaciones para el bulk ordenado y el no ordenado.
const BULK_OPERATIONS: &str = "
    bulk.insert({ a: 1 });
    bulk.insert({ a: 2 });
    bulk.find({ a: 1 }).update({ $set: { b: 1 } });
    bulk.find({ a: 9 }).upsert().updateOne({ $set: { b: 2 } });
    bulk.find({ a: 2 }).removeOne();
    bulk.insert({ a: 3 });
    bulk.execute()";

fn bulk_counters(result: &Document) -> Vec<(&str, Option<&Bson>)> {
    [
        "nInserted",
        "nUpserted",
        "nMatched",
        "nModified",
        "nRemoved",
    ]
    .into_iter()
    .map(|field| (field, result.get(field)))
    .collect()
}

fn expected_counters() -> Vec<(&'static str, Option<&'static Bson>)> {
    const ONE: &Bson = &Bson::Int32(1);
    const THREE: &Bson = &Bson::Int32(3);
    vec![
        ("nInserted", Some(THREE)),
        ("nUpserted", Some(ONE)),
        ("nMatched", Some(ONE)),
        ("nModified", Some(ONE)),
        ("nRemoved", Some(ONE)),
    ]
}

#[test]
fn ordered_bulk_runs_each_run_of_operations_in_order() {
    let (mut session, _) = session();
    let result = write_result(
        &mut session,
        &format!("var bulk = db.x.initializeOrderedBulkOp(); {BULK_OPERATIONS}"),
    );
    assert_eq!(bulk_counters(&result), expected_counters());
    assert_eq!(
        result.get_array("upserted"),
        Ok(&vec![Bson::Document(doc! { "index": 3, "_id": 1 })])
    );
    assert_eq!(
        write_batches(&mut session),
        batches(&["insert:2", "update:2", "delete:1", "insert:1"])
    );
}

#[test]
fn unordered_bulk_groups_by_type() {
    let (mut session, _) = session();
    let result = write_result(
        &mut session,
        &format!("var bulk = db.x.initializeUnorderedBulkOp(); {BULK_OPERATIONS}"),
    );
    assert_eq!(bulk_counters(&result), expected_counters());
    assert_eq!(
        write_batches(&mut session),
        batches(&["insert:3", "update:2", "delete:1"])
    );
}

#[test]
fn bulk_cannot_run_twice() {
    let (mut session, _) = session();
    let error = run_err(
        &mut session,
        "var bulk = db.x.initializeOrderedBulkOp(); bulk.insert({}); bulk.execute(); bulk.execute()",
    );
    assert!(error.message.contains("ya se ejecutó"), "{error:?}");
}

#[test]
fn bulk_write_returns_counts_and_ids_by_operation_index() {
    let (mut session, _) = session();
    let result = write_result(
        &mut session,
        "db.x.bulkWrite([
            { insertOne: { document: { _id: 'a' } } },
            { updateMany: { filter: {}, update: { $set: { b: 1 } } } },
            { replaceOne: { filter: { _id: 'z' }, replacement: { c: 1 }, upsert: true } },
            { deleteOne: { filter: { _id: 'a' } } },
        ])",
    );
    assert_eq!(result.get_i32("insertedCount"), Ok(1));
    assert_eq!(result.get_i32("matchedCount"), Ok(1));
    assert_eq!(result.get_i32("upsertedCount"), Ok(1));
    assert_eq!(result.get_i32("deletedCount"), Ok(1));
    assert_eq!(result.get_document("insertedIds"), Ok(&doc! { "0": "a" }));
    assert_eq!(result.get_document("upsertedIds"), Ok(&doc! { "2": 1 }));
}

#[test]
fn bulk_write_rejects_unknown_operations() {
    let (mut session, _) = session();
    let error = run_err(
        &mut session,
        "db.x.bulkWrite([{ insertOne: { document: {} } }, { upsert: {} }])",
    );
    assert!(error.message.contains("operación 1 no válida"), "{error:?}");
}

/// Como mongosh: un update sin operadores `$` o un reemplazo con ellos se rechazan antes de
/// llegar al servidor, en vez de reemplazar el documento entero.
#[test]
fn update_without_operators_or_replacement_with_them_is_rejected() {
    for (code, expected) in [
        ("db.x.updateOne({ _id: 1 }, { status: 'x' })", "updateOne: el update debe usar operadores $"),
        ("db.x.updateMany({}, {})", "updateMany: el update debe usar operadores $"),
        ("db.x.updateOne({ _id: 1 }, { $set: { a: 1 }, b: 2 })", "updateOne: el update debe usar operadores $"),
        ("db.x.findOneAndUpdate({ _id: 1 }, { a: 1 })", "findOneAndUpdate: el update debe usar operadores $"),
        ("db.x.replaceOne({ _id: 1 }, { $set: { a: 1 } })", "replaceOne: el documento de reemplazo no puede usar operadores $"),
        ("db.x.findOneAndReplace({ _id: 1 }, { $set: { a: 1 } })", "findOneAndReplace: el documento de reemplazo"),
        ("db.x.initializeOrderedBulkOp().find({ _id: 1 }).updateOne({ a: 1 })", "updateOne: el update debe usar operadores $"),
        ("db.x.initializeOrderedBulkOp().find({ _id: 1 }).replaceOne({ $set: { a: 1 } })", "replaceOne: el documento de reemplazo"),
        (
            "db.x.bulkWrite([{ updateOne: { filter: { _id: 1 }, update: { a: 1 } } }])",
            "bulkWrite updateOne: el update debe usar operadores $",
        ),
        (
            "db.x.bulkWrite([{ replaceOne: { filter: { _id: 1 }, replacement: { $set: { a: 1 } } } }])",
            "bulkWrite replaceOne: el documento de reemplazo",
        ),
    ] {
        let (mut session, _) = session();
        let error = run_err(&mut session, code);
        assert!(error.message.contains(expected), "{code}: {}", error.message);
        assert_eq!(write_batches(&mut session), batches(&[]), "{code}");
    }
}

#[test]
fn update_with_operators_or_pipeline_and_plain_replacement_are_sent() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        "db.x.updateOne({ _id: 1 }, { $set: { a: 1 }, $inc: { n: 1 } });
         db.x.updateMany({}, [{ $set: { a: 1 } }]);
         db.x.replaceOne({ _id: 1 }, { a: 1 });
         db.x.update({ _id: 1 }, { a: 1 })",
    );
    assert_eq!(
        write_batches(&mut session),
        batches(&["update:1", "update:1", "update:1", "update:1"])
    );
}

/// Como mongosh: borrar sin filtro es un error; vaciar la colección se pide con `{}`.
#[test]
fn delete_without_filter_is_rejected() {
    for code in [
        "db.x.remove()",
        "db.x.deleteOne()",
        "db.x.deleteMany()",
        "db.x.deleteMany(null)",
        "db.x.bulkWrite([{ deleteMany: {} }])",
    ] {
        let (mut session, _) = session();
        let error = run_err(&mut session, code);
        assert!(error.message.contains("falta el filtro"), "{code}: {}", error.message);
        assert_eq!(write_batches(&mut session), batches(&[]), "{code}");
    }
    let (mut session, _) = session();
    run_ok(&mut session, "db.x.remove({}); db.x.deleteMany({})");
    assert_eq!(write_batches(&mut session), batches(&["delete:1", "delete:1"]));
}

/// Comando que recibió el servidor en la primera llamada.
fn first_command(session: &mut ShellSession) -> Document {
    super::prelude::first_call(session)
        .get_document("command")
        .expect("comando")
        .clone()
}

fn first_statement(command: &Document, field: &str) -> Document {
    command.get_array(field).expect("operaciones")[0]
        .as_document()
        .expect("operación")
        .clone()
}

/// Firma del shell clásico: `update(q, u, upsert, multi)`.
#[test]
fn legacy_update_maps_upsert_and_multi_booleans() {
    for (code, upsert, multi) in [
        ("db.x.update({ a: 1 }, { $set: { b: 1 } }, false, true)", false, true),
        ("db.x.update({ a: 1 }, { $set: { b: 1 } }, true)", true, false),
        ("db.x.update({ a: 1 }, { $set: { b: 1 } }, true, true)", true, true),
        ("db.x.update({ a: 1 }, { $set: { b: 1 } }, { upsert: true, multi: true })", true, true),
        ("db.x.update({ a: 1 }, { $set: { b: 1 } })", false, false),
    ] {
        let (mut session, _) = super::prelude::session();
        run_ok(&mut session, code);
        let statement = first_statement(&first_command(&mut session), "updates");
        assert_eq!(statement.get_bool("upsert"), Ok(upsert), "{code}");
        assert_eq!(statement.get_bool("multi"), Ok(multi), "{code}");
    }
}

#[test]
fn delete_options_reach_the_statement() {
    let (mut session, _) = super::prelude::session();
    run_ok(
        &mut session,
        "db.x.deleteMany({ a: 'x' }, { collation: { locale: 'es', strength: 2 }, hint: 'a_1' })",
    );
    let statement = first_statement(&first_command(&mut session), "deletes");
    assert_eq!(statement.get_document("collation").ok(), Some(&doc! { "locale": "es", "strength": 2 }));
    assert_eq!(statement.get_str("hint"), Ok("a_1"));
    assert_eq!(statement.get_i32("limit"), Ok(0));

    let (mut session, _) = super::prelude::session();
    run_ok(&mut session, "db.x.remove({ a: 1 }, { justOne: true, collation: { locale: 'es' } })");
    let statement = first_statement(&first_command(&mut session), "deletes");
    assert_eq!(statement.get_i32("limit"), Ok(1));
    assert!(statement.contains_key("collation"));
    assert!(!statement.contains_key("justOne"));
}

#[test]
fn find_one_and_update_passes_every_option() {
    let (mut session, _) = super::prelude::session();
    run_ok(
        &mut session,
        "db.x.findOneAndUpdate({ _id: 1 }, { $set: { 'a.$[e].v': 1 } }, {
            arrayFilters: [{ 'e.k': 1 }], collation: { locale: 'es' }, hint: '_id_',
            projection: { a: 1 }, sort: { _id: 1 }, upsert: true, returnDocument: 'after',
        })",
    );
    let command = first_command(&mut session);
    for field in ["arrayFilters", "collation", "hint", "fields", "sort", "upsert"] {
        assert!(command.contains_key(field), "{field}: {command}");
    }
    assert_eq!(command.get_bool("new"), Ok(true));
    assert!(!command.contains_key("projection") && !command.contains_key("returnDocument"));

    let (mut session, _) = super::prelude::session();
    run_ok(&mut session, "db.x.findOneAndReplace({ _id: 1 }, { a: 1 }, { returnDocument: 'before' })");
    assert_eq!(first_command(&mut session).get_bool("new"), Ok(false));

    let (mut session, _) = super::prelude::session();
    let error = run_err(&mut session, "db.x.findOneAndUpdate({ _id: 1 }, { $set: { a: 1 } }, { returnDocument: 'new' })");
    assert!(error.message.contains("returnDocument debe ser"), "{error:?}");
}

/// `{ f: undefined }` llegaría como `{ f: null }`, que también coincide con los documentos sin `f`.
#[test]
fn undefined_in_a_write_filter_is_rejected() {
    for code in [
        "var t; db.x.deleteMany({ tenant: t })",
        "db.x.deleteOne({ a: { $in: [1, undefined] } })",
        "db.x.remove({ $or: [{ a: undefined }] })",
        "db.x.updateMany({ tenant: undefined }, { $set: { a: 1 } })",
        "db.x.replaceOne({ tenant: undefined }, { a: 1 })",
        "db.x.update({ tenant: undefined }, { a: 1 })",
        "db.x.findOneAndDelete({ tenant: undefined })",
        "db.x.findOneAndUpdate({ tenant: undefined }, { $set: { a: 1 } })",
        "db.x.findAndModify({ query: { tenant: undefined }, remove: true })",
        "db.x.initializeOrderedBulkOp().find({ tenant: undefined }).remove()",
        "db.x.initializeOrderedBulkOp().find({ tenant: undefined }).updateOne({ $set: { a: 1 } })",
        "db.x.bulkWrite([{ deleteMany: { filter: { tenant: undefined } } }])",
        "db.x.bulkWrite([{ updateOne: { filter: { tenant: undefined }, update: { $set: { a: 1 } } } }])",
    ] {
        let (mut session, _) = super::prelude::session();
        let error = run_err(&mut session, code);
        assert!(error.message.contains("valor undefined"), "{code}: {}", error.message);
        assert_eq!(write_batches(&mut session), batches(&[]), "{code}");
    }
    let (mut session, _) = super::prelude::session();
    run_ok(
        &mut session,
        "db.x.deleteMany({ tenant: null, at: new Date(0), id: ObjectId(), re: /a/ })",
    );
    assert_eq!(write_batches(&mut session), batches(&["delete:1"]));
}
