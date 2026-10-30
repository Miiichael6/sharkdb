// Saved connections live in <app config dir>/connections.json. The frontend owns the shape;
// here they are just an opaque JSON array.
use std::fs;
use std::path::PathBuf;

use serde_json::Value;
use tauri::{AppHandle, Manager};

const FILE_NAME: &str = "connections.json";

fn file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_config_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join(FILE_NAME))
}

#[tauri::command]
pub fn load_connections(app: AppHandle) -> Result<Value, String> {
    let path = file_path(&app)?;
    if !path.exists() {
        return Ok(Value::Array(vec![]));
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&raw).map_err(|e| format!("connections.json inválido: {e}"))
}

#[tauri::command]
pub fn save_connections(app: AppHandle, connections: Value) -> Result<(), String> {
    let path = file_path(&app)?;
    let raw = serde_json::to_string_pretty(&connections).map_err(|e| e.to_string())?;
    // Write to a temp file first so a crash mid-write can't truncate the saved list.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw).map_err(|e| e.to_string())?;
    fs::rename(&tmp, &path).map_err(|e| e.to_string())
}
