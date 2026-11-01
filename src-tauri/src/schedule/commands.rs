//! Comandos Tauri de los backups programados: finos, delegan en `runs` y en el plugin de notificaciones.

use std::path::PathBuf;

use tauri::AppHandle;
use tauri_plugin_notification::NotificationExt;

use super::runs;

/// Las carpetas de ejecución de una programación (`<carpeta>/<nombre>`).
#[tauri::command]
pub fn list_backup_runs(parent: PathBuf) -> Result<Vec<String>, String> {
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
