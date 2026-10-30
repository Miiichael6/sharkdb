//! Comandos Tauri del shell: finos, solo localizan el `ShellRuntime` de la sesión y delegan.
//! El runtime de una sesión se crea al ejecutar el primer script y se suelta al desconectar.

use std::collections::HashMap;
use std::rc::Rc;
use std::sync::{Arc, Mutex};

use mongodb::Client;
use tauri::State;
use tokio::runtime::Handle;

use super::bridge::MongoBridge;
use super::engine::EngineLimits;
use super::native::MongoNatives;
use super::outcome::{CursorBatch, CursorId, ScriptOutcome};
use super::runtime::ShellRuntime;
use crate::mongo::{self, Sessions};

const NO_SHELL: &str = "No hay ningún shell abierto en esta conexión";

/// Runtimes de shell abiertos, por id de conexión.
#[derive(Default)]
pub struct ShellSessions(Mutex<HashMap<String, Arc<ShellRuntime>>>);

impl ShellSessions {
    fn get(&self, sid: &str) -> Option<Arc<ShellRuntime>> {
        self.lock().get(sid).cloned()
    }

    fn require(&self, sid: &str) -> Result<Arc<ShellRuntime>, String> {
        self.get(sid).ok_or_else(|| NO_SHELL.to_string())
    }

    /// El runtime de la sesión, creándolo si aún no existe. Se comprueba con el cerrojo tomado
    /// para que dos scripts lanzados a la vez no creen dos.
    fn get_or_spawn(&self, sid: &str, client: Client) -> Result<Arc<ShellRuntime>, String> {
        let mut shells = self.lock();
        if let Some(shell) = shells.get(sid) {
            return Ok(shell.clone());
        }
        let handle = Handle::current();
        let bridge_handle = handle.clone();
        let runtime = ShellRuntime::spawn(EngineLimits::default(), handle, move |watchdog| {
            Rc::new(MongoNatives::new(client, bridge_handle, watchdog)) as Rc<dyn MongoBridge>
        })?;
        let runtime = Arc::new(runtime);
        shells.insert(sid.to_string(), runtime.clone());
        Ok(runtime)
    }

    /// Suelta el runtime de la sesión: corta su script y cierra sus cursores. Se cancela aquí
    /// porque un `execute_script` en curso aún tiene su propia referencia al runtime.
    pub fn close(&self, sid: &str) {
        if let Some(shell) = self.lock().remove(sid) {
            shell.cancel();
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, Arc<ShellRuntime>>> {
        self.0
            .lock()
            .unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[tauri::command]
pub async fn execute_script(
    sessions: State<'_, Sessions>,
    shells: State<'_, ShellSessions>,
    sid: String,
    db: String,
    code: String,
) -> Result<ScriptOutcome, String> {
    let shell = match shells.get(&sid) {
        Some(shell) => shell,
        None => shells.get_or_spawn(&sid, mongo::session(&sessions, &sid).await?)?,
    };
    shell.run(db, code).await
}

#[tauri::command]
pub async fn next_batch(
    shells: State<'_, ShellSessions>,
    sid: String,
    cursor_id: CursorId,
    size: usize,
) -> Result<CursorBatch, String> {
    shells.require(&sid)?.next_batch(cursor_id, size).await
}

#[tauri::command]
pub fn close_cursor(
    shells: State<'_, ShellSessions>,
    sid: String,
    cursor_id: CursorId,
) -> Result<(), String> {
    match shells.get(&sid) {
        Some(shell) => shell.close_cursor(cursor_id),
        // Sin shell (desconectado) el cursor ya está cerrado.
        None => Ok(()),
    }
}

#[tauri::command]
pub fn cancel_script(shells: State<'_, ShellSessions>, sid: String) {
    if let Some(shell) = shells.get(&sid) {
        shell.cancel();
    }
}
