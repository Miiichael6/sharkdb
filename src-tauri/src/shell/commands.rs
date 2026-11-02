//! Comandos Tauri del shell: finos, solo localizan el `ShellRuntime` de la pestaña y delegan.
//! Cada pestaña (`tab`) de una conexión (`sid`) tiene su propio runtime, como en Robo 3T: se crea
//! al ejecutar su primer script y se suelta al cerrar la pestaña o desconectar.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::{Arc, Mutex};

use mongodb::Client;
use tauri::State;
use tokio::runtime::Handle;

use super::bridge::MongoBridge;
use super::document_eval::{self, DocumentEval};
use super::engine::EngineLimits;
use super::native::MongoNatives;
use super::outcome::{CursorBatch, CursorId, ScriptOutcome};
use super::runtime::ShellRuntime;
use super::session::RunOptions;
use crate::mongo::{self, Sessions};
use crate::safe_mode::SafeMode;

const NO_SHELL: &str = "No hay ningún shell abierto en esta pestaña";

type TabShells = HashMap<String, Arc<ShellRuntime>>;

/// Runtimes de shell abiertos, por id de conexión y, dentro de ella, por pestaña.
#[derive(Default)]
pub struct ShellSessions(Mutex<HashMap<String, TabShells>>);

impl ShellSessions {
    fn get(&self, sid: &str, tab: &str) -> Option<Arc<ShellRuntime>> {
        self.lock().get(sid)?.get(tab).cloned()
    }

    fn require(&self, sid: &str, tab: &str) -> Result<Arc<ShellRuntime>, String> {
        self.get(sid, tab).ok_or_else(|| NO_SHELL.to_string())
    }

    /// El runtime de la pestaña, creándolo si aún no existe. Se comprueba con el cerrojo tomado
    /// para que dos scripts lanzados a la vez no creen dos.
    fn get_or_spawn(
        &self,
        sid: &str,
        tab: &str,
        (client, safe_mode): (Client, SafeMode),
    ) -> Result<Arc<ShellRuntime>, String> {
        let mut shells = self.lock();
        let tabs = shells.entry(sid.to_string()).or_default();
        if let Some(shell) = tabs.get(tab) {
            return Ok(shell.clone());
        }
        let handle = Handle::current();
        let bridge_handle = handle.clone();
        let runtime = ShellRuntime::spawn(EngineLimits::default(), handle, move |watchdog| {
            Rc::new(MongoNatives::new(
                client,
                safe_mode,
                bridge_handle,
                watchdog,
            )) as Rc<dyn MongoBridge>
        })?;
        let runtime = Arc::new(runtime);
        tabs.insert(tab.to_string(), runtime.clone());
        Ok(runtime)
    }

    /// Suelta los runtimes de todas las pestañas de la conexión: corta sus scripts y cierra sus
    /// cursores. Se cancela aquí porque un `execute_script` en curso aún tiene su propia
    /// referencia al runtime.
    pub fn close(&self, sid: &str) {
        let tabs = self.lock().remove(sid).unwrap_or_default();
        tabs.values().for_each(|shell| shell.cancel());
    }

    /// Suelta el runtime de una sola pestaña.
    fn close_tab(&self, sid: &str, tab: &str) {
        let shell = self.lock().get_mut(sid).and_then(|tabs| tabs.remove(tab));
        if let Some(shell) = shell {
            shell.cancel();
        }
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, TabShells>> {
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
    tab: String,
    db: String,
    code: String,
    script_path: Option<String>,
    options: RunOptions,
) -> Result<ScriptOutcome, String> {
    let shell = match shells.get(&sid, &tab) {
        Some(shell) => shell,
        None => shells.get_or_spawn(
            &sid,
            &tab,
            mongo::session_with_safe_mode(&sessions, &sid).await?,
        )?,
    };
    shell
        .run(
            db,
            code,
            script_path.as_deref().and_then(folder_of),
            options,
        )
        .await
}

/// Carpeta del script abierto en la pestaña, desde la que `load` resuelve rutas relativas.
fn folder_of(script_path: &str) -> Option<PathBuf> {
    Path::new(script_path).parent().map(Path::to_path_buf)
}

#[tauri::command]
pub async fn next_batch(
    shells: State<'_, ShellSessions>,
    sid: String,
    tab: String,
    cursor_id: CursorId,
    size: usize,
) -> Result<CursorBatch, String> {
    shells
        .require(&sid, &tab)?
        .next_batch(cursor_id, size)
        .await
}

#[tauri::command]
pub fn close_cursor(
    shells: State<'_, ShellSessions>,
    sid: String,
    tab: String,
    cursor_id: CursorId,
) -> Result<(), String> {
    match shells.get(&sid, &tab) {
        Some(shell) => shell.close_cursor(cursor_id),
        // Sin shell (pestaña cerrada o desconectado) el cursor ya está cerrado.
        None => Ok(()),
    }
}

#[tauri::command]
pub fn cancel_script(shells: State<'_, ShellSessions>, sid: String, tab: String) {
    if let Some(shell) = shells.get(&sid, &tab) {
        shell.cancel();
    }
}

#[tauri::command]
pub fn close_shell(shells: State<'_, ShellSessions>, sid: String, tab: String) {
    shells.close_tab(&sid, &tab);
}

/// Evalúa el texto de un documento con la sintaxis del shell. QuickJS es síncrono: se hace en un
/// hilo de bloqueo para no frenar los demás comandos.
#[tauri::command]
pub async fn eval_document(text: String) -> Result<DocumentEval, String> {
    tokio::task::spawn_blocking(move || document_eval::evaluate(&text))
        .await
        .map_err(|e| e.to_string())
}
