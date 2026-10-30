use std::time::Duration;

use mongodb::bson::Bson;

use super::{engine, engine_with, prints, run, value};
use crate::shell::engine::EngineLimits;
use crate::shell::outcome::ScriptErrorKind;

#[test]
fn runs_loops_and_functions_and_collects_print() {
    let outcome = run(
        &mut engine(),
        "function square(n) { return n * n; }\n\
         var total = 0;\n\
         for (let i = 1; i <= 3; i++) { total += square(i); print('i =', i); }\n\
         total",
    );
    assert_eq!(outcome.error, None);
    assert_eq!(prints(&outcome), ["i = 1", "i = 2", "i = 3"]);
    assert_eq!(value(&outcome), Some(Bson::Double(14.0)));
}

#[test]
fn printjson_uses_shell_format() {
    let outcome = run(
        &mut engine(),
        "printjson({ _id: ObjectId('65a1b2c3d4e5f6a7b8c9d0e1'), n: NumberLong(5), at: ISODate('2024-01-02T00:00:00Z'), tags: [] })",
    );
    assert_eq!(
        prints(&outcome),
        [
            "{\n\t\"_id\" : ObjectId(\"65a1b2c3d4e5f6a7b8c9d0e1\"),\n\t\"n\" : NumberLong(5),\n\t\"at\" : ISODate(\"2024-01-02T00:00:00.000Z\"),\n\t\"tags\" : [ ]\n}"
        ]
    );
    assert_eq!(value(&outcome), None);
}

#[test]
fn globals_survive_between_runs() {
    let mut engine = engine();
    assert_eq!(run(&mut engine, "var counter = 41;").error, None);
    assert_eq!(
        value(&run(&mut engine, "counter + 1")),
        Some(Bson::Double(42.0))
    );
}

#[test]
fn syntax_error_reports_line_and_column() {
    let error = run(&mut engine(), "var a = 1;\nvar b = ;")
        .error
        .expect("error");
    assert_eq!(error.kind, ScriptErrorKind::Script);
    assert!(
        error.message.starts_with("SyntaxError"),
        "{}",
        error.message
    );
    assert_eq!(error.line, Some(2));
    assert!(error.column.is_some());
}

#[test]
fn runtime_error_reports_position_and_thrown_values() {
    let error = run(&mut engine(), "var x = 1;\nnoExiste();")
        .error
        .expect("error");
    assert!(
        error.message.starts_with("ReferenceError"),
        "{}",
        error.message
    );
    assert_eq!(error.line, Some(2));

    let error = run(&mut engine(), "throw 'texto'").error.expect("error");
    assert_eq!(error.message, "texto");
}

#[test]
fn infinite_loop_is_cut_by_timeout_and_engine_stays_usable() {
    let mut engine = engine_with(EngineLimits {
        timeout: Duration::from_millis(200),
        ..EngineLimits::default()
    });
    let outcome = run(&mut engine, "print('antes'); while (true) {}");
    assert_eq!(
        outcome.error.as_ref().map(|e| e.kind),
        Some(ScriptErrorKind::Timeout)
    );
    assert_eq!(prints(&outcome), ["antes"]);
    assert_eq!(value(&run(&mut engine, "1 + 1")), Some(Bson::Double(2.0)));
}

#[test]
fn memory_limit_stops_runaway_allocation() {
    let mut engine = engine_with(EngineLimits {
        memory_bytes: 16 * 1024 * 1024,
        ..EngineLimits::default()
    });
    let outcome = run(
        &mut engine,
        "var a = []; while (true) a.push('x'.repeat(1024));",
    );
    assert_eq!(
        outcome.error.map(|e| e.kind),
        Some(ScriptErrorKind::OutOfMemory)
    );
    // La sesión se reinicia: `a` ya no existe y se puede seguir ejecutando.
    assert_eq!(
        value(&run(&mut engine, "typeof a")),
        Some(Bson::String("undefined".into()))
    );

    let error = run(&mut engine, "throw null").error.expect("error");
    assert_eq!(error.kind, ScriptErrorKind::Script);
}
