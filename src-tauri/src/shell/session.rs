//! Sesión de shell: el motor con la API `db` instalada sobre un `MongoBridge`. Ejecuta scripts
//! (reescribiendo `use`/`show`) y pagina los cursores que quedan como resultado.

use std::path::PathBuf;
use std::rc::Rc;
use std::time::Duration;

use serde::Deserialize;

use super::bridge::MongoBridge;
use super::engine::{Engine, EngineLimits};
use super::host::Host;
use super::module::ShellModule;
use super::outcome::{CursorBatch, CursorId, ScriptOutcome};
use super::prelude::{Prelude, ShellRun};
use super::syntax;
use super::watchdog::Watchdog;

/// Documentos del primer lote de un cursor resultado (una página de Robo 3T).
pub const FIRST_BATCH_SIZE: usize = 50;

/// Lo que el usuario elige en Preferencias para cada ejecución: el tiempo máximo (de un script o
/// de la lectura de una página) y los documentos del primer lote de un cursor resultado.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunOptions {
    pub timeout_seconds: u64,
    pub page_size: usize,
}

impl Default for RunOptions {
    fn default() -> Self {
        Self {
            timeout_seconds: EngineLimits::default().timeout.as_secs(),
            page_size: FIRST_BATCH_SIZE,
        }
    }
}

pub struct ShellSession {
    engine: Engine,
    host: Host,
    bridge: Rc<dyn MongoBridge>,
    watchdog: Watchdog,
    limits: EngineLimits,
    first_batch: usize,
}

impl ShellSession {
    pub fn new(
        limits: EngineLimits,
        watchdog: Watchdog,
        bridge: Rc<dyn MongoBridge>,
    ) -> rquickjs::Result<Self> {
        let host = Host::new(watchdog.clone());
        let prelude = Rc::new(Prelude::new(bridge.clone()));
        let modules: Vec<Rc<dyn ShellModule>> = vec![Rc::new(host.clone()), prelude];
        let engine = Engine::new(limits, watchdog.clone(), modules)?;
        Ok(Self {
            engine,
            host,
            bridge,
            watchdog,
            limits,
            first_batch: FIRST_BATCH_SIZE,
        })
    }

    /// Aplica las preferencias a las ejecuciones siguientes; valores a cero se suben a uno.
    pub fn configure(&mut self, options: RunOptions) {
        self.limits.timeout = Duration::from_secs(options.timeout_seconds.max(1));
        self.engine.set_timeout(self.limits.timeout);
        self.first_batch = options.page_size.max(1);
    }

    /// Ejecuta `code` con `db` apuntando a la base de datos indicada; `load` resuelve las rutas
    /// relativas desde `script_dir`. Los cursores que el script dejó abiertos se cierran, salvo
    /// los que quedan como resultado.
    pub fn run(&mut self, db: &str, code: &str, script_dir: Option<PathBuf>) -> ScriptOutcome {
        self.host.set_script_dir(script_dir);
        let hooks = ShellRun {
            db,
            first_batch: self.first_batch,
            bridge: self.bridge.as_ref(),
        };
        let mut outcome = self.engine.run(&syntax::rewrite(code), &hooks);
        outcome.query_ms = self
            .bridge
            .take_query_time()
            .map(|spent| spent.as_millis() as u64);
        self.bridge.retain_cursors(&outcome.open_cursors());
        outcome
    }

    /// Lectura cancelable con `cancel` y limitada por el mismo tiempo máximo que un script.
    pub fn next_batch(&mut self, cursor: CursorId, size: usize) -> Result<CursorBatch, String> {
        self.watchdog.arm(self.limits.timeout);
        let batch = self.bridge.next_batch(cursor, size);
        self.watchdog.disarm();
        batch
    }

    pub fn close_cursor(&mut self, cursor: CursorId) {
        self.bridge.close_cursor(cursor);
    }
}
