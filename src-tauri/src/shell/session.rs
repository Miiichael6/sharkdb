//! Sesión de shell: el motor con la API `db` instalada sobre un `MongoBridge`. Ejecuta scripts
//! (reescribiendo `use`/`show`) y pagina los cursores que quedan como resultado.

use std::rc::Rc;

use super::bridge::MongoBridge;
use super::engine::{Engine, EngineLimits};
use super::outcome::{CursorBatch, CursorId, ScriptOutcome};
use super::prelude::{Prelude, ShellRun};
use super::syntax;
use super::watchdog::Watchdog;

/// Documentos del primer lote de un cursor resultado (una página de Robo 3T).
pub const FIRST_BATCH_SIZE: usize = 50;

pub struct ShellSession {
    engine: Engine,
    bridge: Rc<dyn MongoBridge>,
    watchdog: Watchdog,
    limits: EngineLimits,
}

impl ShellSession {
    pub fn new(
        limits: EngineLimits,
        watchdog: Watchdog,
        bridge: Rc<dyn MongoBridge>,
    ) -> rquickjs::Result<Self> {
        let prelude = Rc::new(Prelude::new(bridge.clone()));
        let engine = Engine::new(limits, watchdog.clone(), vec![prelude])?;
        Ok(Self {
            engine,
            bridge,
            watchdog,
            limits,
        })
    }

    /// Ejecuta `code` con `db` apuntando a la base de datos indicada. Los cursores que el script
    /// dejó abiertos se cierran, salvo el que queda como resultado.
    pub fn run(&mut self, db: &str, code: &str) -> ScriptOutcome {
        let hooks = ShellRun {
            db,
            first_batch: FIRST_BATCH_SIZE,
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
