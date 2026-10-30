//! Motor JS de una sesión de shell: un runtime QuickJS con los módulos del shell instalados.
//! Las variables globales sobreviven entre ejecuciones, como en una pestaña de Robo 3T.
//! No es `Send`: vive siempre en el hilo de `runtime.rs`.

use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::{Duration, Instant};

use mongodb::bson::Bson;
use rquickjs::context::EvalOptions;
use rquickjs::{Context, Ctx, Runtime, Value};

use super::bson_types::BsonTypes;
use super::convert::js_to_bson;
use super::errors::{SCRIPT_NAME, describe_thrown};
use super::module::ShellModule;
use super::outcome::{ScriptError, ScriptErrorKind, ScriptOutcome};
use super::output::Output;
use super::watchdog::{Interruption, Watchdog};

const OUT_OF_MEMORY: &str = "out of memory";
const BYTES_PER_MB: usize = 1024 * 1024;
/// Sin memoria ni para crear el error, QuickJS lanza `null`; se distingue de un `throw null`
/// del script porque el uso de memoria está casi en el límite.
const NEAR_MEMORY_LIMIT: f64 = 0.9;
const THROWN_NULL: &str = "null";

#[derive(Debug, Clone, Copy)]
pub struct EngineLimits {
    pub timeout: Duration,
    pub memory_bytes: usize,
}

impl Default for EngineLimits {
    fn default() -> Self {
        Self {
            timeout: Duration::from_secs(60),
            memory_bytes: 256 * BYTES_PER_MB,
        }
    }
}

pub struct Engine {
    // El contexto debe soltarse antes que el runtime: el orden de los campos importa.
    context: Context,
    runtime: Runtime,
    output: Output,
    limits: EngineLimits,
    watchdog: Watchdog,
}

impl Engine {
    /// `cancel` es la bandera que otro hilo pone a `true` para cortar el script en curso.
    pub fn new(limits: EngineLimits, cancel: Arc<AtomicBool>) -> rquickjs::Result<Self> {
        let runtime = Runtime::new()?;
        runtime.set_memory_limit(limits.memory_bytes);
        let watchdog = Watchdog::new(cancel);
        runtime.set_interrupt_handler(Some(watchdog.interrupt_handler()));

        let context = Context::full(&runtime)?;
        let output = Output::default();
        let modules: [&dyn ShellModule; 2] = [&BsonTypes, &output];
        context.with(|ctx| modules.iter().try_for_each(|module| module.install(&ctx)))?;
        Ok(Self {
            context,
            runtime,
            output,
            limits,
            watchdog,
        })
    }

    pub fn run(&mut self, code: &str) -> ScriptOutcome {
        let started = Instant::now();
        self.watchdog.arm(self.limits.timeout);
        let (value, error) = self.context.with(|ctx| match eval(&ctx, code) {
            Ok(value) => convert_result(&ctx, value),
            Err(_) => (
                None,
                Some(describe_thrown(&ctx, ctx.catch(), ScriptErrorKind::Script)),
            ),
        });
        self.watchdog.disarm();
        let outcome = ScriptOutcome {
            output: self.output.take(),
            value,
            error: error.map(|e| self.classify(e)),
            elapsed_ms: started.elapsed().as_millis() as u64,
        };
        if outcome
            .error
            .as_ref()
            .is_some_and(|e| e.kind == ScriptErrorKind::OutOfMemory)
        {
            self.restart();
        }
        outcome
    }

    /// Sin memoria, las variables globales retienen lo que llenó el límite y ni siquiera se
    /// podría compilar otro script. Las funciones JS mantienen vivo su contexto, así que no basta
    /// con cambiar de contexto: se rehace el runtime entero.
    fn restart(&mut self) {
        if let Ok(fresh) = Engine::new(self.limits, self.watchdog.cancel_flag()) {
            *self = fresh;
        }
    }

    #[cfg(test)]
    pub fn with_context<R>(&self, f: impl for<'js> FnOnce(Ctx<'js>) -> R) -> R {
        self.context.with(f)
    }

    /// Sustituye la excepción genérica de QuickJS por el motivo real: tiempo, cancelación o
    /// memoria. Se hace fuera de `context.with` porque consultar la memoria bloquea el runtime.
    fn classify(&self, error: ScriptError) -> ScriptError {
        match self.watchdog.fired() {
            Some(Interruption::Timeout) => ScriptError::new(
                ScriptErrorKind::Timeout,
                format!(
                    "El script superó el tiempo máximo de {} s",
                    self.limits.timeout.as_secs()
                ),
            ),
            Some(Interruption::Cancelled) => {
                ScriptError::new(ScriptErrorKind::Cancelled, "Ejecución cancelada")
            }
            None if self.ran_out_of_memory(&error) => ScriptError::new(
                ScriptErrorKind::OutOfMemory,
                format!(
                    "El script superó el límite de memoria de {} MB; se reinició la sesión y se perdieron sus variables",
                    self.limits.memory_bytes / BYTES_PER_MB
                ),
            ),
            None => error,
        }
    }

    fn ran_out_of_memory(&self, error: &ScriptError) -> bool {
        if error.kind != ScriptErrorKind::Script {
            return false;
        }
        if error.message.ends_with(OUT_OF_MEMORY) {
            return true;
        }
        let used = self.runtime.memory_usage().malloc_size as f64;
        error.message == THROWN_NULL && used >= self.limits.memory_bytes as f64 * NEAR_MEMORY_LIMIT
    }
}

fn eval<'js>(ctx: &Ctx<'js>, code: &str) -> rquickjs::Result<Value<'js>> {
    let mut options = EvalOptions::default();
    options.global = true;
    options.backtrace_barrier = true;
    options.filename = Some(SCRIPT_NAME.into());
    ctx.eval_with_options(code, options)
}

fn convert_result<'js>(ctx: &Ctx<'js>, value: Value<'js>) -> (Option<Bson>, Option<ScriptError>) {
    if value.is_undefined() {
        return (None, None);
    }
    match js_to_bson(ctx, &value) {
        Ok(bson) => (Some(bson), None),
        Err(_) => (
            None,
            Some(describe_thrown(
                ctx,
                ctx.catch(),
                ScriptErrorKind::Conversion,
            )),
        ),
    }
}
