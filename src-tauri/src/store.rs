// App data lives as JSON in <app config dir>: saved connections in connections.json and each
// connection's query history in history/<connection id>.json. The frontend owns the shapes;
// here they are just opaque JSON values, except for the secrets `secrets` keeps out of the file.
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::secrets::{self, KeyringVault};

const CONNECTIONS_FILE: &str = "connections.json";
const HISTORY_DIR: &str = "history";

pub(crate) fn config_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

/// Connection ids are UUIDs: anything else could escape the history folder.
fn history_file_name(connection_id: &str) -> Result<String, String> {
    let valid = !connection_id.is_empty()
        && connection_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-');
    if valid {
        Ok(format!("{connection_id}.json"))
    } else {
        Err(format!("Id de conexión inválido: {connection_id}"))
    }
}

fn history_path(app: &AppHandle, connection_id: &str) -> Result<PathBuf, String> {
    Ok(config_dir(app)?
        .join(HISTORY_DIR)
        .join(history_file_name(connection_id)?))
}

/// The saved value, or `empty` if the file doesn't exist yet.
fn read_json(path: &Path, empty: Value) -> Result<Value, String> {
    if !path.exists() {
        return Ok(empty);
    }
    let raw = fs::read_to_string(path).map_err(|e| e.to_string())?;
    let name = path.file_name().unwrap_or_default().to_string_lossy();
    serde_json::from_str(&raw).map_err(|e| format!("{name} inválido: {e}"))
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let raw = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    // Write to a temp file first so a crash mid-write can't truncate the saved data.
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, raw).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_connections(app: AppHandle) -> Result<Value, String> {
    let path = config_dir(&app)?.join(CONNECTIONS_FILE);
    let mut connections = read_json(&path, Value::Array(vec![]))?;
    // Files from before the credential store still hold passwords: move them out right away.
    if secrets::has_plain_secrets(&connections) {
        secrets::seal(&mut connections, &KeyringVault)?;
        write_json(&path, &connections)?;
    }
    secrets::unseal(&mut connections, &KeyringVault)?;
    Ok(connections)
}

#[tauri::command]
pub fn save_connections(app: AppHandle, mut connections: Value) -> Result<(), String> {
    let path = config_dir(&app)?.join(CONNECTIONS_FILE);
    let before = read_json(&path, Value::Array(vec![]))?;
    secrets::seal(&mut connections, &KeyringVault)?;
    write_json(&path, &connections)?;
    secrets::forget_removed(&before, &connections, &KeyringVault)
}

/// Whether a saved connection is marked protected (production-like): restore and sync never
/// write to it. Reads the file as is: the secrets aren't needed for this.
pub(crate) fn is_protected(app: &AppHandle, connection_id: &str) -> Result<bool, String> {
    let connections = read_json(&config_dir(app)?.join(CONNECTIONS_FILE), Value::Array(vec![]))?;
    Ok(connection_is_protected(&connections, connection_id))
}

fn connection_is_protected(connections: &Value, connection_id: &str) -> bool {
    connections.as_array().is_some_and(|list| {
        list.iter().any(|c| {
            c.get("id").and_then(Value::as_str) == Some(connection_id)
                && c.get("protected").and_then(Value::as_bool) == Some(true)
        })
    })
}

#[tauri::command]
pub fn load_history(app: AppHandle, connection_id: String) -> Result<Value, String> {
    read_json(&history_path(&app, &connection_id)?, Value::Array(vec![]))
}

#[tauri::command]
pub fn save_history(app: AppHandle, connection_id: String, entries: Value) -> Result<(), String> {
    write_json(&history_path(&app, &connection_id)?, &entries)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn history_file_is_named_after_the_connection_id() {
        let id = "0f8fad5b-d9cb-469f-a165-70867728950e";
        assert_eq!(history_file_name(id).unwrap(), format!("{id}.json"));
    }

    #[test]
    fn history_file_rejects_ids_that_could_escape_the_folder() {
        for id in ["", "../connections", "a/b", "a\\b", "c:x"] {
            assert!(history_file_name(id).is_err(), "{id}");
        }
    }

    #[test]
    fn only_connections_marked_protected_are_protected() {
        let connections = serde_json::json!([
            { "id": "prod", "protected": true },
            { "id": "qa", "protected": false },
            { "id": "old" },
        ]);
        assert!(connection_is_protected(&connections, "prod"));
        assert!(!connection_is_protected(&connections, "qa"));
        assert!(!connection_is_protected(&connections, "old"));
        assert!(!connection_is_protected(&connections, "missing"));
    }

    #[test]
    fn json_round_trip_and_missing_file() {
        let dir = std::env::temp_dir().join(format!("robo3b-store-{}", std::process::id()));
        let path = dir.join(HISTORY_DIR).join("x.json");
        assert_eq!(
            read_json(&path, Value::Array(vec![])).unwrap(),
            Value::Array(vec![])
        );
        let value = serde_json::json!([{ "code": "db.x.find({})" }]);
        write_json(&path, &value).unwrap();
        assert_eq!(read_json(&path, Value::Null).unwrap(), value);
        fs::remove_dir_all(dir).unwrap();
    }
}
