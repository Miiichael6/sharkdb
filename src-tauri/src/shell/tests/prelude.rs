use std::rc::Rc;

use mongodb::bson::{Bson, doc};

use super::fake_bridge::FakeBridge;
use super::{outputs, prints, test_limits, value};
use crate::shell::outcome::{ScriptOutcome, ScriptOutput, Uneditable};
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
            uneditable,
        },
    ] = &outputs(&outcome)[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!(ns, "test.x");
    assert_eq!(documents.len(), FIRST_BATCH_SIZE);
    assert!(!exhausted);
    assert!(editable);
    assert_eq!(*uneditable, None);
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

#[test]
fn uneditable_cursor_says_why() {
    let (mut session, _) = session();
    let why = |session: &mut _, script| match &outputs(&run_ok(session, script))[..] {
        [ScriptOutput::Cursor { uneditable, .. }] => *uneditable,
        other => panic!("se esperaba un cursor: {other:?}"),
    };
    assert_eq!(why(&mut session, "db.x.find({})"), None);
    assert_eq!(why(&mut session, "db.x.find({}, {})"), None);
    assert_eq!(why(&mut session, "db.x.find({}, { a: 1 })"), Some(Uneditable::Projection));
    assert_eq!(why(&mut session, "db.x.aggregate([])"), Some(Uneditable::Aggregate));
    assert_eq!(why(&mut session, "db.vista.find({})"), Some(Uneditable::ReadOnlyCollection));
    assert_eq!(Uneditable::from_prelude("nope"), None);
}

/// Operaciones (`op`) que recibió el servidor falso, en orden.
fn server_ops(session: &mut ShellSession) -> Vec<String> {
    let ops = value(&run_ok(session, "__calls.map((call) => call.op)")).expect("llamadas");
    ops.as_array()
        .expect("array")
        .iter()
        .map(|op| op.as_str().expect("op").to_owned())
        .collect()
}

#[test]
fn write_pipeline_runs_when_called_even_if_not_read() {
    let (mut assigned, _) = session();
    run_ok(
        &mut assigned,
        "var r = db.x.aggregate([{ $match: {} }, { $merge: 'b' }]); 1",
    );
    assert_eq!(server_ops(&mut assigned), ["aggregate"]);

    let (mut looped, _) = session();
    run_ok(
        &mut looped,
        "for (const m of [1, 2, 3]) db.v.aggregate([{ $match: { m } }, { $merge: { into: 'resumen' } }]); 1",
    );
    assert_eq!(
        server_ops(&mut looped),
        ["aggregate", "aggregate", "aggregate"]
    );

    // Con las etapas sueltas en vez de en un array, como en el shell clásico.
    let (mut spread, _) = session();
    run_ok(
        &mut spread,
        "db.x.aggregate({ $match: {} }, { $out: 'y' }); 1",
    );
    assert_eq!(server_ops(&mut spread), ["aggregate"]);
}

#[test]
fn write_pipeline_runs_in_script_order() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        "var r = db.x.aggregate([{ $out: 'y' }]); db.y.find().toArray(); r.toArray(); 1",
    );
    // Recorrerlo después lee su resultado: no lo vuelve a ejecutar.
    assert_eq!(server_ops(&mut session), ["aggregate", "find"]);
}

#[test]
fn write_pipeline_shown_as_result_runs_once() {
    let (mut session, _) = session();
    let outcome = run_ok(
        &mut session,
        "db.x.aggregate([{ $match: {} }, { $out: 'y' }])",
    );
    assert!(matches!(
        &outputs(&outcome)[..],
        [ScriptOutput::Cursor { .. }]
    ));
    assert_eq!(server_ops(&mut session), ["aggregate"]);
}

#[test]
fn read_pipeline_stays_lazy() {
    let (mut session, _) = session();
    // `$out` dentro de un `$match` es un campo, no una etapa.
    run_ok(
        &mut session,
        "var r = db.x.aggregate([{ $match: { $out: 1 } }]).allowDiskUse().maxTimeMS(5); 1",
    );
    assert!(server_ops(&mut session).is_empty());
}

#[test]
fn write_pipeline_takes_options_in_the_second_argument() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        "db.x.aggregate([{ $out: 'y' }], { allowDiskUse: true }); 1",
    );
    let aggregate = first_call(&mut session);
    assert_eq!(
        aggregate.get_document("options"),
        Ok(&doc! { "allowDiskUse": true })
    );

    let outcome = session.run(DB, "db.x.aggregate([{ $out: 'y' }]).allowDiskUse()", None);
    let error = outcome.error.expect("modificador tras ejecutarse");
    assert!(
        error
            .message
            .contains("allowDiskUse: un aggregate con $out o $merge se ejecuta al llamarlo"),
        "{}",
        error.message
    );
}

#[test]
fn view_or_timeseries_cursor_is_not_editable() {
    let (mut session, _) = session();
    let editable = |session: &mut _, script| match &outputs(&run_ok(session, script))[..] {
        [ScriptOutput::Cursor { editable, .. }] => *editable,
        other => panic!("se esperaba un cursor: {other:?}"),
    };
    assert!(!editable(&mut session, "db.vista.find({})"));
    assert!(!editable(&mut session, "db.serie.find({})"));
    assert!(editable(&mut session, "db.x.find({})"));
}

#[test]
fn untouched_find_one_document_shows_as_editable_cursor() {
    let (mut session, bridge) = session();
    let outcome = run_ok(&mut session, "db.x.findOne({})");
    let [
        ScriptOutput::Cursor {
            ns,
            cursor_id,
            documents,
            exhausted,
            editable,
            uneditable,
        },
    ] = &outputs(&outcome)[..]
    else {
        panic!("se esperaba un cursor: {:?}", outcome.results);
    };
    assert_eq!(ns, "test.x");
    assert_eq!(documents, &[Bson::Document(doc! { "_id": 0 })]);
    assert!(*exhausted && *editable && cursor_id.is_none());
    assert_eq!(*uneditable, None);
    assert!(bridge.retained.borrow().is_empty());

    let kept = run_ok(&mut session, "var d = db.x.findOne({}); d");
    assert!(matches!(outputs(&kept).last(), Some(ScriptOutput::Cursor { .. })));
}

#[test]
fn changed_projected_or_read_only_find_one_document_stays_a_value() {
    let (mut session, _) = session();
    for script in [
        "db.x.findOne({}, { a: 1 })",
        "db.vista.findOne({})",
        "var d = db.x.findOne({}); d.a = 1; d",
        "var d = db.x.findOne({}); d._id = 5; d",
        "var d = db.x.findOne({}); delete d._id; d",
        "({ ...db.x.findOne({}) })",
    ] {
        let outcome = run_ok(&mut session, script);
        assert!(
            matches!(outputs(&outcome).last(), Some(ScriptOutput::Value { .. })),
            "{script}: {:?}",
            outcome.results
        );
    }
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
    assert_eq!(outcome.db.as_deref(), Some("otra"));
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
fn outcome_reports_the_db_the_script_ends_on() {
    let (mut session, _) = session();
    let db_after = |session: &mut ShellSession, code: &str| session.run(DB, code, None).db;

    assert_eq!(db_after(&mut session, "1").as_deref(), Some(DB));
    assert_eq!(db_after(&mut session, "use a
use b").as_deref(), Some("b"));
    assert_eq!(
        db_after(&mut session, "db = db.getSiblingDB('otra')").as_deref(),
        Some("otra")
    );
    assert_eq!(
        db_after(&mut session, "var db = db.getSiblingDB('otra')").as_deref(),
        Some("otra")
    );
    // Usar otra base de datos sin asignarla a `db` no la cambia.
    assert_eq!(
        db_after(&mut session, "var o = db.getSiblingDB('otra'); o.getName()").as_deref(),
        Some(DB)
    );
    // `use` cuenta aunque el script falle después.
    let failed = session.run(DB, "use otra
throw new Error('x')", None);
    assert!(failed.error.is_some());
    assert_eq!(failed.db.as_deref(), Some("otra"));
    // Si `db` deja de ser una base de datos (o un nombre inválido), la pestaña sigue en la suya.
    assert_eq!(db_after(&mut session, "db = 5"), None);
    assert_eq!(db_after(&mut session, "db = db.getSiblingDB('a.b')"), None);
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
