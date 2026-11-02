//! Ejecuta las sentencias de un script una a una en el mismo contexto global, así las variables
//! de una sentencia siguen vivas en la siguiente, y recoge un resultado por cada sentencia que
//! devuelve algo. Se para en la primera que falla.

use std::time::Instant;

use rquickjs::context::EvalOptions;
use rquickjs::{Ctx, Object, Value};

use super::errors::{SCRIPT_NAME, describe_thrown};
use super::module::{BegunResult, RunHooks};
use super::outcome::{MAX_RESULTS, ScriptError, ScriptErrorKind, ScriptOutput, ScriptResult};
use super::output::Output;
use super::statements::Statement;

/// Caracteres de la sentencia que acompañan a cada resultado; el frontend la usa de título.
const MAX_SOURCE_CHARS: usize = 200;
const ELLIPSIS: char = '…';

#[derive(Debug, Default)]
pub struct StatementsRun {
    pub results: Vec<ScriptResult>,
    pub error: Option<ScriptError>,
    pub truncated: bool,
    /// Resultados que no son `print`: los que cuentan para `MAX_RESULTS`.
    values: usize,
}

impl StatementsRun {
    pub fn failed(error: ScriptError) -> Self {
        Self {
            error: Some(error),
            ..Self::default()
        }
    }
}

/// Lo que dejó una sentencia.
enum Step<'js> {
    Nothing,
    Output(ScriptOutput),
    /// Cursor cuya consulta ya va en marcha; su primer lote se lee al final.
    Pending(Object<'js>),
    /// Devolvió algo, pero ya se alcanzó `MAX_RESULTS`.
    Dropped,
    Failed(ScriptError),
}

/// Un resultado en su sitio, ya completo o a falta de leer su primer lote.
enum Entry<'js> {
    Done(ScriptResult),
    Pending {
        line: u32,
        source: String,
        started: Instant,
        described: Object<'js>,
    },
}

/// Las declaraciones de función van primero (hoisting); del resto, se muestra el valor de cada
/// expresión y el de la última sentencia, sea cual sea, como cuando se evaluaba el script entero.
///
/// Los cursores que quedan como valor no se esperan: se lanza la sentencia siguiente y sus
/// primeros lotes se leen al final, en orden, así varias consultas seguidas van en paralelo. Si
/// una falla, el script se da por parado ahí, como si se hubiera esperado.
pub fn run_statements<'js>(
    ctx: &Ctx<'js>,
    statements: &[Statement<'_>],
    hooks: &dyn RunHooks,
    output: &Output,
) -> StatementsRun {
    let (hoisted, in_order): (Vec<_>, Vec<_>) = statements.iter().partition(|s| s.is_hoisted);
    let last = in_order.len().saturating_sub(1);
    let steps = hoisted.into_iter().map(|s| (s, false)).chain(
        in_order
            .into_iter()
            .enumerate()
            .map(|(i, s)| (s, s.is_expression || i == last)),
    );

    let mut run = StatementsRun::default();
    let mut entries = Vec::new();
    for (statement, shows_value) in steps {
        let room = run.values < MAX_RESULTS;
        let started = Instant::now();
        let step = run_statement(ctx, statement, shows_value, room, hooks);
        let elapsed_ms = started.elapsed().as_millis() as u64;
        let source = source_of(statement);
        let located = |output| {
            Entry::Done(ScriptResult {
                line: statement.line,
                source: source.clone(),
                elapsed_ms,
                output,
            })
        };
        entries.extend(output.take().into_iter().map(&located));
        match step {
            Step::Nothing => {}
            Step::Output(output) => {
                run.values += 1;
                entries.push(located(output));
            }
            Step::Pending(described) => {
                run.values += 1;
                entries.push(Entry::Pending {
                    line: statement.line,
                    source,
                    started,
                    described,
                });
            }
            Step::Dropped => run.truncated = true,
            Step::Failed(mut error) => {
                error.line.get_or_insert(statement.line);
                run.error = Some(error);
                break;
            }
        }
    }
    finish(ctx, entries, hooks, &mut run);
    run
}

/// Completa los resultados pendientes en orden. El primero que falla manda: lo que vino
/// después no se muestra y su error sustituye al que hubiera.
fn finish<'js>(
    ctx: &Ctx<'js>,
    entries: Vec<Entry<'js>>,
    hooks: &dyn RunHooks,
    run: &mut StatementsRun,
) {
    for entry in entries {
        let result = match entry {
            Entry::Done(result) => result,
            Entry::Pending {
                line,
                source,
                started,
                described,
            } => match hooks.finish_result(ctx, described) {
                Ok(output) => ScriptResult {
                    line,
                    source,
                    elapsed_ms: started.elapsed().as_millis() as u64,
                    output,
                },
                Err(mut error) => {
                    error.line.get_or_insert(line);
                    run.error = Some(error);
                    run.truncated = false;
                    return;
                }
            },
        };
        run.results.push(result);
    }
}

fn run_statement<'js>(
    ctx: &Ctx<'js>,
    statement: &Statement<'_>,
    shows_value: bool,
    room: bool,
    hooks: &dyn RunHooks,
) -> Step<'js> {
    let value = match eval(ctx, &statement.padded()) {
        Ok(value) => value,
        Err(_) => {
            return Step::Failed(describe_thrown(ctx, ctx.catch(), ScriptErrorKind::Script));
        }
    };
    if !shows_value || value.is_undefined() {
        return Step::Nothing;
    }
    if !room {
        return Step::Dropped;
    }
    match hooks.begin_result(ctx, value) {
        Ok(Some(BegunResult::Ready(output))) => Step::Output(output),
        Ok(Some(BegunResult::Pending(described))) => Step::Pending(described),
        Ok(None) => Step::Nothing,
        Err(error) => Step::Failed(error),
    }
}

fn eval<'js>(ctx: &Ctx<'js>, code: &str) -> rquickjs::Result<Value<'js>> {
    let mut options = EvalOptions::default();
    options.global = true;
    options.backtrace_barrier = true;
    options.filename = Some(SCRIPT_NAME.into());
    ctx.eval_with_options(code, options)
}

fn source_of(statement: &Statement<'_>) -> String {
    let code = statement.code.trim();
    if code.chars().count() <= MAX_SOURCE_CHARS {
        return code.to_string();
    }
    code.chars()
        .take(MAX_SOURCE_CHARS)
        .chain([ELLIPSIS])
        .collect()
}
