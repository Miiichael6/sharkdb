//! Motor JS de una sesión de shell: un runtime QuickJS con los módulos del shell instalados.
//! Las variables globales sobreviven entre ejecuciones, como en una pestaña de Robo 3T.
//! No es `Send`: vive siempre en el hilo de `runtime.rs`.

use std::rc::Rc;
use std::time::{Duration, Instant};

use rquickjs::{Context, Runtime};

use super::bson_types::BsonTypes;
use super::errors::describe_thrown;
use super::module::{RunHooks, ShellModule};
use super::outcome::{ScriptError, ScriptErrorKind, ScriptOutcome};
use super::output::Output;
use super::statement_run::{StatementsRun, run_statements};
use super::statements;
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
    /// Módulos además de los tipos BSON y `print`; se guardan para reinstalarlos al reiniciar.
    extra_modules: Vec<Rc<dyn ShellModule>>,
}

impl Engine {
    /// El `watchdog` corta el script en curso por cancelación (desde otro hilo) o tiempo.
    pub fn new(
        limits: EngineLimits,
        watchdog: Watchdog,
        extra_modules: Vec<Rc<dyn ShellModule>>,
    ) -> rquickjs::Result<Self> {
        let runtime = Runtime::new()?;
        runtime.set_memory_limit(limits.memory_bytes);
        runtime.set_interrupt_handler(Some(watchdog.interrupt_handler()));

        let context = Context::full(&runtime)?;
        let output = Output::default();
        context.with(|ctx| {
            let built_in: [&dyn ShellModule; 2] = [&BsonTypes, &output];
            built_in
                .into_iter()
                .chain(extra_modules.iter().map(|module| module.as_ref()))
                .try_for_each(|module| module.install(&ctx))
        })?;
        Ok(Self {
            context,
            runtime,
            output,
            limits,
            watchdog,
            extra_modules,
        })
    }

    /// Cambia el tiempo máximo de las ejecuciones siguientes (lo elige el usuario en Preferencias).
    pub fn set_timeout(&mut self, timeout: Duration) {
        self.limits.timeout = timeout;
    }

    /// Ejecuta el script sentencia a sentencia: cada una que devuelve algo deja su resultado.
    pub fn run(&mut self, code: &str, hooks: &dyn RunHooks) -> ScriptOutcome {
        let started = Instant::now();
        let statements = statements::split(code);
        self.watchdog.arm(self.limits.timeout);
        let run = self.context.with(|ctx| match hooks.before_run(&ctx) {
            Ok(()) => run_statements(&ctx, &statements, hooks, &self.output),
            Err(_) => {
                StatementsRun::failed(describe_thrown(&ctx, ctx.catch(), ScriptErrorKind::Script))
            }
        });
        self.watchdog.disarm();
        let outcome = ScriptOutcome {
            results: run.results,
            error: run.error.map(|e| self.classify(e)),
            truncated: run.truncated,
            elapsed_ms: started.elapsed().as_millis() as u64,
            query_ms: None,
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
        let modules = self.extra_modules.clone();
        if let Ok(fresh) = Engine::new(self.limits, self.watchdog.clone(), modules) {
            *self = fresh;
        }
    }

    #[cfg(test)]
    pub fn with_context<R>(&self, f: impl for<'js> FnOnce(rquickjs::Ctx<'js>) -> R) -> R {
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
