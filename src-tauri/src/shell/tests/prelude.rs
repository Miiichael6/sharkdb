use std::rc::Rc;

use mongodb::bson::{Bson, doc};

use super::fake_bridge::FakeBridge;
use super::{outputs, prints, test_limits, value};
use crate::shell::outcome::{ScriptOutcome, ScriptOutput};
use crate::shell::session::{FIRST_BATCH_SIZE, ShellSession};
use crate::shell::watchdog::Watchdog;

pub(super) const DB: &str = "test";

pub(super) fn session() -> (ShellSession, Rc<FakeBridge>) {
    let bridge = FakeBridge::shared();
    let watchdog = Watchdog::new(Default::default());
    let session = ShellSession::new(test_limits(), watchdog, bridge.clone()).expect("sesión");
    (session, bridge)
}

pub(super) fn run_ok(session: &mut ShellSession, code: &str) -> ScriptOutcome {
    let outcome = session.run(DB, code, None);
    assert_eq!(outcome.error, None, "script: {code}");
    outcome
}

/// Primera llamada que recibió el servidor falso, como documento.
pub(super) fn first_call(session: &mut ShellSession) -> mongodb::bson::Document {
    let calls = value(&run_ok(session, "__calls")).expect("llamadas");
    calls.as_array().expect("array")[0]
        .as_document()
        .expect("llamada")
        .clone()
}

#[test]
fn cursor_modifiers_reach_find_as_options() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        "db.getCollection('x').find({ a: 1 }).sort({ _id: -1 }).skip(2).limit(5).toArray()",
    );
    let find = first_call(&mut session);
    assert_eq!(find.get_str("db"), Ok(DB));
    assert_eq!(find.get_str("coll"), Ok("x"));
    assert_eq!(find.get_document("filter"), Ok(&doc! { "a": 1 }));
    assert_eq!(
        find.get_document("options"),
        Ok(&doc! { "sort": { "_id": -1 }, "skip": 2, "limit": 5 })
    );
}

#[test]
fn final_cursor_returns_first_batch_and_stays_open() {
    let (mut session, bridge) = session();
    let outcome = run_ok(&mut session, "db.x.find({})");
    let [
        ScriptOutput::Cursor {
            ns,
            cursor_id,
            documents,
            exhausted,
            editable,
        },
    ] = &outputs(&outcome)[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!(ns, "test.x");
    assert_eq!(documents.len(), FIRST_BATCH_SIZE);
    assert!(!exhausted);
    assert!(editable);
    assert_eq!(*bridge.retained.borrow(), vec![cursor_id.expect("id")]);

    let outcome = run_ok(&mut session, "db.x.find({}).limit(3)");
    let [
        ScriptOutput::Cursor {
            cursor_id,
            documents,
            exhausted,
            ..
        },
    ] = &outputs(&outcome)[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!((documents.len(), *exhausted, *cursor_id), (3, true, None));
    assert!(bridge.retained.borrow().is_empty());
}

#[test]
fn projected_or_aggregate_cursor_is_not_editable() {
    let (mut session, _) = session();
    let editable = |session: &mut _, script| match &outputs(&run_ok(session, script))[..] {
        [ScriptOutput::Cursor { editable, .. }] => *editable,
        other => panic!("se esperaba un cursor: {other:?}"),
    };
    assert!(!editable(&mut session, "db.x.find({}, { a: 1 })"));
    assert!(!editable(&mut session, "db.x.find({}).projection({ a: 0 })"));
    assert!(editable(&mut session, "db.x.find({}, {})"));
    assert!(!editable(&mut session, "db.x.aggregate([])"));
}

/// Ids `_id` del cursor que deja la última sentencia.
fn cursor_ids(outcome: &ScriptOutcome) -> Vec<i32> {
    let [.., ScriptOutput::Cursor { documents, .. }] = &outputs(outcome)[..] else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    documents
        .iter()
        .map(|d| d.as_document().unwrap().get_i32("_id").unwrap())
        .collect()
}

#[test]
fn final_cursor_opens_asking_only_for_the_page() {
    let (mut page, _) = session();
    run_ok(&mut page, "db.x.find({})");
    let find = first_call(&mut page);
    assert_eq!(
        find.get_document("options"),
        Ok(&doc! { "batchSize": FIRST_BATCH_SIZE as i32 })
    );

    // Un lote menor que la página se sube a la página: la respuesta la trae entera.
    let (mut small, _) = session();
    run_ok(&mut small, "db.x.find({}).batchSize(7)");
    let find = first_call(&mut small);
    assert_eq!(
        find.get_document("options"),
        Ok(&doc! { "batchSize": FIRST_BATCH_SIZE as i32 })
    );

    let (mut large, _) = session();
    run_ok(&mut large, "db.x.find({}).batchSize(500)");
    let find = first_call(&mut large);
    assert_eq!(
        find.get_document("options"),
        Ok(&doc! { "batchSize": 500 })
    );
}

#[test]
fn final_cursor_keeps_what_the_script_already_read() {
    let (mut session, _) = session();
    let outcome = run_ok(&mut session, "var c = db.x.find({}); c.next(); c");
    assert_eq!(cursor_ids(&outcome), (1..100).collect::<Vec<_>>());

    let outcome = run_ok(&mut session, "c.next()._id");
    assert_eq!(value(&outcome), Some(Bson::Int32(100)));
}

#[test]
fn final_cursor_drained_outside_js_is_exhausted_for_the_script() {
    let (mut session, _) = session();
    let outcome = run_ok(&mut session, "var c = db.x.find({}).limit(3); c");
    assert_eq!(cursor_ids(&outcome), [0, 1, 2]);

    let outcome = run_ok(&mut session, "c.hasNext()");
    assert_eq!(value(&outcome), Some(Bson::Boolean(false)));
}

#[test]
fn each_find_leaves_its_own_open_cursor() {
    let (mut session, bridge) = session();
    let outcome = run_ok(
        &mut session,
        "db.getCollection('a').find({})
db.b.find({})

db.c.find({})",
    );
    let cursors: Vec<_> = outcome
        .results
        .iter()
        .filter_map(|result| match &result.output {
            ScriptOutput::Cursor { ns, cursor_id, .. } => Some((result.line, ns.as_str(), *cursor_id)),
            _ => None,
        })
        .collect();
    let summary: Vec<_> = cursors.iter().map(|(line, ns, _)| (*line, *ns)).collect();
    assert_eq!(summary, [(1, "test.a"), (2, "test.b"), (4, "test.c")]);
    let ids: Vec<_> = cursors.iter().map(|(_, _, id)| id.expect("abierto")).collect();
    assert_eq!(*bridge.retained.borrow(), ids);
}

#[test]
fn for_each_and_print_read_the_whole_cursor() {
    let (mut session, _) = session();
    let outcome = run_ok(
        &mut session,
        "var n = 0; db.x.find().forEach(d => n++); print('total', n);\n\
         db.x.find().limit(2).forEach(d => print(d._id))",
    );
    assert_eq!(prints(&outcome), ["total 120", "0", "1"]);
}

#[test]
fn use_switches_db_for_the_rest_of_the_script() {
    let (mut session, _) = session();
    let outcome = run_ok(&mut session, "use otra; db.y.count()");
    assert_eq!(prints(&outcome), ["switched to db otra"]);
    assert_eq!(value(&outcome), Some(Bson::Int32(1)));
    let count = first_call(&mut session);
    assert_eq!(count.get_str("db"), Ok("otra"));
    assert_eq!(
        count.get_document("command"),
        Ok(&doc! { "count": "y", "query": {} })
    );

    // Cada ejecución empieza en la base de datos de la pestaña.
    assert_eq!(
        value(&run_ok(&mut session, "db.getName()")),
        Some(Bson::String(DB.into()))
    );
}

#[test]
fn insert_one_sends_insert_command_and_returns_write_result() {
    let (mut session, _) = session();
    let outcome = run_ok(&mut session, "db.x.insertOne({ _id: 7, a: 'b' })");
    let [ScriptOutput::Write { value }] = &outputs(&outcome)[..] else {
        panic!("se esperaba una escritura: {:?}", outcome.results);
    };
    assert_eq!(
        value,
        &Bson::Document(doc! { "acknowledged": true, "insertedId": 7 })
    );
    assert_eq!(
        first_call(&mut session).get_document("command"),
        Ok(&doc! { "insert": "x", "documents": [{ "_id": 7, "a": "b" }], "ordered": true })
    );
}

#[test]
fn cursors_left_open_by_the_script_are_closed_unless_returned() {
    let (mut session, bridge) = session();
    run_ok(&mut session, "var c = db.x.find(); c.next(); 1");
    assert!(bridge.retained.borrow().is_empty());
}

#[test]
fn get_shard_version_asks_admin_for_the_namespace() {
    let (mut session, _) = session();
    run_ok(&mut session, "db.getCollection('x').getShardVersion()");
    let call = first_call(&mut session);
    assert_eq!(call.get_str("db"), Ok("admin"));
    assert_eq!(call.get_document("command"), Ok(&doc! { "getShardVersion": "test.x" }));
}

#[test]
fn get_shard_distribution_fails_on_an_unsharded_collection() {
    let (mut session, _) = session();
    let outcome = session.run(DB, "db.getCollection('x').getShardDistribution()", None);
    let error = outcome.error.expect("se esperaba un error");
    assert!(
        error.message.contains("test.x no está fragmentada"),
        "{error:?}"
    );
}
