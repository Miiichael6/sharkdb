//! Comandos Tauri de los backups programados: finos, delegan en `runs`, en `crate::jobs` (el turno
//! entre instancias) y en el plugin de notificaciones.

use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_notification::NotificationExt;

use super::runs;
use crate::jobs::Jobs;

/// El turno de las programadas: lo tiene a lo sumo una instancia, y ninguna mientras otra tenga en
/// marcha un backup, un restore o un sync (error 60).
const SCHEDULE_TURN: &str = "turno-programadas";
const SCHEDULE_TURN_LABEL: &str = "un backup programado";

/// Toma el turno para lanzar una programada: `false` si otra instancia (o esta) ya está en ello.
#[tauri::command]
pub fn take_schedule_turn(jobs: State<'_, Jobs>) -> Result<bool, String> {
    jobs.take_turn(SCHEDULE_TURN, SCHEDULE_TURN_LABEL)
}

/// Suelta el turno al acabar la ejecución (o al no lanzarla).
#[tauri::command]
pub fn release_schedule_turn(jobs: State<'_, Jobs>) {
    jobs.release_turn(SCHEDULE_TURN);
}

/// Crea, en exclusiva, la carpeta de una ejecución que empieza en `stamp`; devuelve su nombre.
#[tauri::command]
pub fn create_backup_run(parent: PathBuf, stamp: String) -> Result<String, String> {
    runs::create_run(&parent, &stamp)
}

/// Las carpetas de ejecución de una programación (`<carpeta>/<nombre>`), y si terminaron bien.
#[tauri::command]
pub fn list_backup_runs(parent: PathBuf) -> Result<Vec<runs::RunFolder>, String> {
    runs::list_runs(&parent)
}

/// Borra ejecuciones viejas de una programación (retención, D16).
#[tauri::command]
pub fn delete_backup_runs(parent: PathBuf, names: Vec<String>) -> Result<(), String> {
    runs::remove_runs(&parent, &names)
}

/// Notificación del sistema: se ve aunque la app esté en segundo plano (R62).
#[tauri::command]
pub fn show_system_notification(app: AppHandle, title: String, body: String) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| format!("No se pudo mostrar la notificación: {e}"))
}
