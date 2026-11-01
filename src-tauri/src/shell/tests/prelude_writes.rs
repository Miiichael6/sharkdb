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
    const ONE: &Bson = &Bson::Double(1.0);
    const THREE: &Bson = &Bson::Double(3.0);
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
        Ok(&vec![Bson::Document(doc! { "index": 3.0, "_id": 1.0 })])
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
    assert_eq!(result.get_f64("insertedCount"), Ok(1.0));
    assert_eq!(result.get_f64("matchedCount"), Ok(1.0));
    assert_eq!(result.get_f64("upsertedCount"), Ok(1.0));
    assert_eq!(result.get_f64("deletedCount"), Ok(1.0));
    assert_eq!(result.get_document("insertedIds"), Ok(&doc! { "0": "a" }));
    assert_eq!(result.get_document("upsertedIds"), Ok(&doc! { "2": 1.0 }));
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
