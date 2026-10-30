// Script files (.js) the user opens or saves from a shell tab. The path always comes from a
// native open/save dialog in the frontend.
use std::fs;

#[tauri::command]
pub fn read_script(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("No se pudo leer {path}: {e}"))
}

#[tauri::command]
pub fn write_script(path: String, content: String) -> Result<(), String> {
    fs::write(&path, content).map_err(|e| format!("No se pudo guardar {path}: {e}"))
}
