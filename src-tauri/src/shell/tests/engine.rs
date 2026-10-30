use std::time::Duration;

use mongodb::bson::Bson;

use super::{engine, engine_with};
use crate::shell::engine::EngineLimits;
use crate::shell::outcome::ScriptErrorKind;

#[test]
fn runs_loops_and_functions_and_collects_print() {
    let outcome = engine().run(
        "function square(n) { return n * n; }\n\
         var total = 0;\n\
         for (let i = 1; i <= 3; i++) { total += square(i); print('i =', i); }\n\
         total",
    );
    assert_eq!(outcome.error, None);
    assert_eq!(outcome.output, ["i = 1", "i = 2", "i = 3"]);
    assert_eq!(outcome.value, Some(Bson::Double(14.0)));
}

#[test]
fn printjson_uses_shell_format() {
    let outcome = engine().run(
        "printjson({ _id: ObjectId('65a1b2c3d4e5f6a7b8c9d0e1'), n: NumberLong(5), at: ISODate('2024-01-02T00:00:00Z'), tags: [] })",
    );
    assert_eq!(
        outcome.output,
        [
            "{\n\t\"_id\" : ObjectId(\"65a1b2c3d4e5f6a7b8c9d0e1\"),\n\t\"n\" : NumberLong(5),\n\t\"at\" : ISODate(\"2024-01-02T00:00:00.000Z\"),\n\t\"tags\" : [ ]\n}"
        ]
    );
    assert_eq!(outcome.value, None);
}

#[test]
fn globals_survive_between_runs() {
    let mut engine = engine();
    assert_eq!(engine.run("var counter = 41;").error, None);
    assert_eq!(engine.run("counter + 1").value, Some(Bson::Double(42.0)));
}

#[test]
fn syntax_error_reports_line_and_column() {
    let error = engine().run("var a = 1;\nvar b = ;").error.expect("error");
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
    let error = engine()
        .run("var x = 1;\nnoExiste();")
        .error
        .expect("error");
    assert!(
        error.message.starts_with("ReferenceError"),
        "{}",
        error.message
    );
    assert_eq!(error.line, Some(2));

    let error = engine().run("throw 'texto'").error.expect("error");
    assert_eq!(error.message, "texto");
}

#[test]
fn infinite_loop_is_cut_by_timeout_and_engine_stays_usable() {
    let mut engine = engine_with(EngineLimits {
        timeout: Duration::from_millis(200),
        ..EngineLimits::default()
    });
    let outcome = engine.run("print('antes'); while (true) {}");
    assert_eq!(
        outcome.error.map(|e| e.kind),
        Some(ScriptErrorKind::Timeout)
    );
    assert_eq!(outcome.output, ["antes"]);
    assert_eq!(engine.run("1 + 1").value, Some(Bson::Double(2.0)));
}

#[test]
fn memory_limit_stops_runaway_allocation() {
    let mut engine = engine_with(EngineLimits {
        memory_bytes: 16 * 1024 * 1024,
        ..EngineLimits::default()
    });
    let outcome = engine.run("var a = []; while (true) a.push('x'.repeat(1024));");
    assert_eq!(
        outcome.error.map(|e| e.kind),
        Some(ScriptErrorKind::OutOfMemory)
    );
    // La sesión se reinicia: `a` ya no existe y se puede seguir ejecutando.
    assert_eq!(
        engine.run("typeof a").value,
        Some(Bson::String("undefined".into()))
    );

    let error = engine.run("throw null").error.expect("error");
    assert_eq!(error.kind, ScriptErrorKind::Script);
}
