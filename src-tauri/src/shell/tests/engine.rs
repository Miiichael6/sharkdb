use std::time::Duration;

use mongodb::bson::Bson;

use super::{engine, engine_with, prints, run, value};
use crate::shell::engine::EngineLimits;
use crate::shell::outcome::{MAX_RESULTS, ScriptErrorKind, ScriptOutcome, ScriptOutput};

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
    assert_eq!(value(&outcome), Some(Bson::Int32(14)));
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
fn print_writes_objects_in_shell_format() {
    let outcome = run(
        &mut engine(),
        "print('doc:', { a: 1, id: ObjectId('65a1b2c3d4e5f6a7b8c9d0e1') }, [1, 'x'], null, 2)",
    );
    assert_eq!(
        prints(&outcome),
        [
            "doc: {\n\t\"a\" : 1,\n\t\"id\" : ObjectId(\"65a1b2c3d4e5f6a7b8c9d0e1\")\n} [\n\t1,\n\t\"x\"\n] null 2"
        ]
    );
}

/// Valores de cada `print`, en orden.
fn printed_values(outcome: &ScriptOutcome) -> Vec<Vec<Bson>> {
    outcome
        .results
        .iter()
        .filter_map(|result| match &result.output {
            ScriptOutput::Print { values, .. } => Some(values.clone()),
            _ => None,
        })
        .collect()
}

#[test]
fn print_sends_its_values_only_when_something_is_not_text() {
    let outcome = run(
        &mut engine(),
        "print('a', 'b'); print('doc:', { a: 1 }, [2], null); printjson({ a: 1 })",
    );
    assert_eq!(
        printed_values(&outcome),
        [
            vec![],
            vec![
                Bson::String("doc:".into()),
                Bson::Document(mongodb::bson::doc! { "a": 1 }),
                Bson::Array(vec![Bson::Int32(2)]),
                Bson::Null,
            ],
            vec![],
        ]
    );
}

#[test]
fn printjson_marks_its_text_as_json() {
    let outcome = run(&mut engine(), "print({ a: 1 }); printjson({ a: 1 })");
    let json: Vec<_> = outcome
        .results
        .iter()
        .filter_map(|result| match &result.output {
            ScriptOutput::Print { json, .. } => Some(*json),
            _ => None,
        })
        .collect();
    assert_eq!(json, [false, true]);
}

#[test]
fn globals_survive_between_runs() {
    let mut engine = engine();
    assert_eq!(run(&mut engine, "var counter = 41;").error, None);
    assert_eq!(
        value(&run(&mut engine, "counter + 1")),
        Some(Bson::Int32(42))
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
    assert_eq!(value(&run(&mut engine, "1 + 1")), Some(Bson::Int32(2)));
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

/// Línea y valor de cada resultado que no es un `print`.
fn located_values(outcome: &ScriptOutcome) -> Vec<(u32, Bson)> {
    outcome
        .results
        .iter()
        .filter_map(|result| match &result.output {
            ScriptOutput::Value { value } => Some((result.line, value.clone())),
            _ => None,
        })
        .collect()
}

#[test]
fn each_expression_leaves_its_own_result_with_line_and_source() {
    let outcome = run(&mut engine(), "1 + 1;\nvar a = 5;\n'b'.toUpperCase()\n  a");
    assert_eq!(outcome.error, None);
    assert_eq!(
        located_values(&outcome),
        [
            (1, Bson::Int32(2)),
            (3, Bson::String("B".into())),
            (4, Bson::Int32(5)),
        ]
    );
    let sources: Vec<_> = outcome.results.iter().map(|r| r.source.as_str()).collect();
    assert_eq!(sources, ["1 + 1;", "'b'.toUpperCase()", "a"]);
}

#[test]
fn a_leading_string_leaves_its_value() {
    let outcome = run(&mut engine(), "\"hola\"
1 + 1");
    assert_eq!(outcome.error, None);
    assert_eq!(
        located_values(&outcome),
        [(1, Bson::String("hola".into())), (2, Bson::Int32(2))]
    );
}

#[test]
fn let_and_const_reach_the_next_statements() {
    let outcome = run(&mut engine(), "const x = 1;\nlet y = x + 1;\nx + y");
    assert_eq!(outcome.error, None);
    assert_eq!(located_values(&outcome), [(3, Bson::Int32(3))]);
}

#[test]
fn error_keeps_previous_results_and_reports_its_line() {
    let outcome = run(&mut engine(), "1;\n2;\n  noExiste();\n4;");
    assert_eq!(
        located_values(&outcome),
        [(1, Bson::Int32(1)), (2, Bson::Int32(2))]
    );
    let error = outcome.error.expect("error");
    assert!(error.message.starts_with("ReferenceError"), "{}", error.message);
    assert_eq!((error.line, error.column), (Some(3), Some(3)));
}

#[test]
fn prints_belong_to_the_statement_that_printed_them() {
    let outcome = run(&mut engine(), "print('a');\nfor (const n of [1, 2]) print(n);\n'fin'");
    let lines: Vec<_> = outcome.results.iter().map(|r| r.line).collect();
    assert_eq!(lines, [1, 2, 2, 3]);
}

#[test]
fn function_declarations_are_hoisted() {
    let outcome = run(&mut engine(), "square(3)\nfunction square(n) { return n * n; }");
    assert_eq!(outcome.error, None);
    assert_eq!(located_values(&outcome), [(1, Bson::Int32(9))]);
}

#[test]
fn single_statement_script_is_unchanged() {
    let outcome = run(&mut engine(), "if (true) { 'si' } else { 'no' }");
    assert_eq!(located_values(&outcome), [(1, Bson::String("si".into()))]);
    assert_eq!(run(&mut engine(), "var a = 1;").results, []);
}

#[test]
fn results_beyond_the_limit_are_dropped_with_a_warning() {
    let code = "1;\n".repeat(MAX_RESULTS + 5);
    let outcome = run(&mut engine(), &code);
    assert_eq!(outcome.results.len(), MAX_RESULTS);
    assert!(outcome.truncated);
    assert!(!run(&mut engine(), "1;\n2").truncated);
}
