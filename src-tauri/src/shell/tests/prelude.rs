use std::rc::Rc;

use mongodb::bson::{Bson, doc};

use super::fake_bridge::FakeBridge;
use super::{prints, test_limits, value};
use crate::shell::outcome::{ScriptOutcome, ScriptResult};
use crate::shell::session::{FIRST_BATCH_SIZE, ShellSession};
use crate::shell::watchdog::Watchdog;

const DB: &str = "test";

fn session() -> (ShellSession, Rc<FakeBridge>) {
    let bridge = FakeBridge::shared();
    let watchdog = Watchdog::new(Default::default());
    let session = ShellSession::new(test_limits(), watchdog, bridge.clone()).expect("sesión");
    (session, bridge)
}

fn run_ok(session: &mut ShellSession, code: &str) -> ScriptOutcome {
    let outcome = session.run(DB, code);
    assert_eq!(outcome.error, None, "script: {code}");
    outcome
}

/// Primera llamada que recibió el servidor falso, como documento.
fn first_call(session: &mut ShellSession) -> mongodb::bson::Document {
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
    assert_eq!(find.get_document("filter"), Ok(&doc! { "a": 1.0 }));
    assert_eq!(
        find.get_document("options"),
        Ok(&doc! { "sort": { "_id": -1.0 }, "skip": 2.0, "limit": 5.0 })
    );
}

#[test]
fn final_cursor_returns_first_batch_and_stays_open() {
    let (mut session, bridge) = session();
    let outcome = run_ok(&mut session, "db.x.find({})");
    let [
        ScriptResult::Cursor {
            ns,
            cursor_id,
            documents,
            exhausted,
        },
    ] = &outcome.results[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!(ns, "test.x");
    assert_eq!(documents.len(), FIRST_BATCH_SIZE);
    assert!(!exhausted);
    assert_eq!(*bridge.retained.borrow(), vec![cursor_id.expect("id")]);

    let outcome = run_ok(&mut session, "db.x.find({}).limit(3)");
    let [
        ScriptResult::Cursor {
            cursor_id,
            documents,
            exhausted,
            ..
        },
    ] = &outcome.results[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!((documents.len(), *exhausted, *cursor_id), (3, true, None));
    assert!(bridge.retained.borrow().is_empty());
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
    assert_eq!(value(&outcome), Some(Bson::Double(1.0)));
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
    let [ScriptResult::Write { value }] = &outcome.results[..] else {
        panic!("se esperaba una escritura: {:?}", outcome.results);
    };
    assert_eq!(
        value,
        &Bson::Document(doc! { "acknowledged": true, "insertedId": 7.0 })
    );
    assert_eq!(
        first_call(&mut session).get_document("command"),
        Ok(&doc! { "insert": "x", "documents": [{ "_id": 7.0, "a": "b" }] })
    );
}

#[test]
fn cursors_left_open_by_the_script_are_closed_unless_returned() {
    let (mut session, bridge) = session();
    run_ok(&mut session, "var c = db.x.find(); c.next(); 1");
    assert!(bridge.retained.borrow().is_empty());
}
