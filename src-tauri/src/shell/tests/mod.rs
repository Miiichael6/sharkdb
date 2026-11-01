//! Tests del shell que necesitan el motor QuickJS completo.

mod convert;
mod document_eval;
mod engine;
mod fake_bridge;
mod host;
mod live;
mod live_compat;
mod live_documents;
mod prelude;
mod prelude_shortcuts;
mod prelude_writes;
mod runtime;

use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use mongodb::bson::Bson;
use rquickjs::{Ctx, Value};

use super::engine::{Engine, EngineLimits};
use super::errors::to_bson_reported;
use super::module::{RunHooks, ShellModule};
use super::outcome::{ScriptError, ScriptOutcome, ScriptOutput};
use super::watchdog::Watchdog;

/// Ejecución sin API `db`: el valor final se entrega tal cual.
struct PlainRun;

impl RunHooks for PlainRun {
    fn before_run(&self, _: &Ctx<'_>) -> rquickjs::Result<()> {
        Ok(())
    }

    fn final_result<'js>(
        &self,
        ctx: &Ctx<'js>,
        value: Value<'js>,
    ) -> Result<Option<ScriptOutput>, ScriptError> {
        if value.is_undefined() {
            return Ok(None);
        }
        let value = to_bson_reported(ctx, &value)?;
        Ok(Some(ScriptOutput::Value { value }))
    }
}

fn test_limits() -> EngineLimits {
    EngineLimits {
        timeout: Duration::from_secs(10),
        ..EngineLimits::default()
    }
}

fn engine_with_modules(limits: EngineLimits, modules: Vec<Rc<dyn ShellModule>>) -> Engine {
    let watchdog = Watchdog::new(Arc::new(AtomicBool::new(false)));
    Engine::new(limits, watchdog, modules).expect("motor")
}

fn engine_with(limits: EngineLimits) -> Engine {
    engine_with_modules(limits, Vec::new())
}

fn engine() -> Engine {
    engine_with(test_limits())
}

fn run(engine: &mut Engine, code: &str) -> ScriptOutcome {
    engine.run(code, &PlainRun)
}

/// Las salidas del script en orden, sin la sentencia que las produjo.
fn outputs(outcome: &ScriptOutcome) -> Vec<&ScriptOutput> {
    outcome.results.iter().map(|result| &result.output).collect()
}

/// Lo que el script imprimió, en orden.
fn prints(outcome: &ScriptOutcome) -> Vec<&str> {
    outputs(outcome)
        .into_iter()
        .filter_map(|output| match output {
            ScriptOutput::Print { text, .. } => Some(text.as_str()),
            _ => None,
        })
        .collect()
}

/// Primer valor simple que devolvió el script.
fn value(outcome: &ScriptOutcome) -> Option<Bson> {
    outputs(outcome).into_iter().find_map(|output| match output {
        ScriptOutput::Value { value } => Some(value.clone()),
        _ => None,
    })
}
