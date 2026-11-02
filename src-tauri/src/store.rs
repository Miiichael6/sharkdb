// App data lives as JSON in <app config dir>: saved connections in connections.json, backup
// schedules in backup-schedules.json, the preferences in settings.json and each connection's query
// history in history/<connection id>.json. The frontend owns the shapes; here they are just opaque
// JSON values, except for the secrets `secrets` keeps out of the file.
use std::fs;
use std::path::{Path, PathBuf};

use serde_json::Value;
use tauri::{AppHandle, Manager};

use crate::secrets::{self, KeyringVault};

const CONNECTIONS_FILE: &str = "connections.json";
const SCHEDULES_FILE: &str = "backup-schedules.json";
const SETTINGS_FILE: &str = "settings.json";
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

#[tauri::command]
pub fn load_backup_schedules(app: AppHandle) -> Result<Value, String> {
    read_json(
        &config_dir(&app)?.join(SCHEDULES_FILE),
        Value::Array(vec![]),
    )
}

#[tauri::command]
pub fn save_backup_schedules(app: AppHandle, schedules: Value) -> Result<(), String> {
    write_json(&config_dir(&app)?.join(SCHEDULES_FILE), &schedules)
}

/// The saved preferences, or `null` before the first save: the frontend fills in the defaults.
#[tauri::command]
pub fn load_settings(app: AppHandle) -> Result<Value, String> {
    read_json(&config_dir(&app)?.join(SETTINGS_FILE), Value::Null)
}

#[tauri::command]
pub fn save_settings(app: AppHandle, settings: Value) -> Result<(), String> {
    write_json(&config_dir(&app)?.join(SETTINGS_FILE), &settings)
}

/// Tag of production connections: like a protected one, it's never modified.
const PRODUCTION_TAG: &str = "production";

/// Whether a saved connection must never be written to by restore or sync: it is marked protected
/// or tagged production, or it points at the same server as one that is (another entry for
/// production, unmarked, must not get around it). Reads the file as is: the secrets aren't needed.
pub(crate) fn is_protected(app: &AppHandle, connection_id: &str) -> Result<bool, String> {
    let connections = read_json(
        &config_dir(app)?.join(CONNECTIONS_FILE),
        Value::Array(vec![]),
    )?;
    Ok(connection_is_protected(&connections, connection_id))
}

fn connection_is_protected(connections: &Value, connection_id: &str) -> bool {
    let list = connections.as_array().map(Vec::as_slice).unwrap_or_default();
    let Some(target) = list.iter().find(|c| c.get("id").and_then(Value::as_str) == Some(connection_id)) else {
        return false;
    };
    let addresses = server_addresses(target);
    marked_protected(target)
        || list
            .iter()
            .filter(|c| marked_protected(c))
            .any(|c| server_addresses(c).iter().any(|a| addresses.contains(a)))
}

fn marked_protected(connection: &Value) -> bool {
    connection.get("protected").and_then(Value::as_bool) == Some(true)
        || connection.get("tag").and_then(Value::as_str) == Some(PRODUCTION_TAG)
}

const DEFAULT_PORT: u64 = 27017;
const LOOPBACK: [&str; 4] = ["localhost", "127.0.0.1", "::1", "[::1]"];

/// The `host:port` addresses a saved connection reaches (`srv:host` for an SRV seed), as the
/// frontend's `serverAddresses`: lowercase, default port, `localhost` for any loopback, and behind
/// the SSH server when tunnelled (there `localhost` is that server, not this machine).
fn server_addresses(connection: &Value) -> Vec<String> {
    let text = |v: &Value, key: &str| v.get(key).and_then(Value::as_str).unwrap_or_default().trim().to_lowercase();
    let hosts: Vec<String> = if text(connection, "mode") == "uri" {
        uri_addresses(&text(connection, "uri"))
    } else {
        let host = text(connection, "host");
        let port = connection.get("port").and_then(Value::as_u64).filter(|p| *p > 0).unwrap_or(DEFAULT_PORT);
        match (host.is_empty(), connection.get("srv").and_then(Value::as_bool) == Some(true)) {
            (true, _) => vec![],
            (false, true) => vec![format!("srv:{host}")],
            (false, false) => vec![normalized_address(&format!("{host}:{port}"))],
        }
    };
    let ssh = connection.get("ssh").filter(|s| s.get("enabled").and_then(Value::as_bool) == Some(true));
    match ssh {
        Some(ssh) => {
            let port = ssh.get("port").and_then(Value::as_u64).unwrap_or(22);
            hosts.into_iter().map(|h| format!("ssh:{}:{port}>{h}", text(ssh, "host"))).collect()
        }
        None => hosts,
    }
}

/// Hosts of a `mongodb://` or `mongodb+srv://` URI (already lowercase).
fn uri_addresses(uri: &str) -> Vec<String> {
    let (srv, rest) = match uri.split_once("://") {
        Some(("mongodb+srv", rest)) => (true, rest),
        Some((_, rest)) => (false, rest),
        None => return vec![],
    };
    let authority = rest.split(['/', '?']).next().unwrap_or_default();
    let hosts = authority.rsplit_once('@').map_or(authority, |(_, hosts)| hosts);
    hosts
        .split(',')
        .map(str::trim)
        .filter(|h| !h.is_empty())
        .map(|h| if srv { format!("srv:{h}") } else { normalized_address(h) })
        .collect()
}

/// `host[:port]` with the default port and every loopback spelled `localhost`.
fn normalized_address(address: &str) -> String {
    let (host, port) = match address.rsplit_once(':') {
        // `::1` without brackets has colons but no port.
        Some((host, port)) if port.parse::<u16>().is_ok() && (host.starts_with('[') || !host.contains(':')) => {
            (host, port.to_string())
        }
        _ => (address, DEFAULT_PORT.to_string()),
    };
    let host = if LOOPBACK.contains(&host) { "localhost" } else { host };
    format!("{host}:{port}")
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
    fn connections_marked_protected_or_tagged_production_are_protected() {
        let connections = serde_json::json!([
            { "id": "prod", "protected": true },
            { "id": "prod2", "protected": false, "tag": "production" },
            { "id": "qa", "protected": false, "tag": "development" },
            { "id": "old" },
        ]);
        assert!(connection_is_protected(&connections, "prod"));
        assert!(connection_is_protected(&connections, "prod2"));
        assert!(!connection_is_protected(&connections, "qa"));
        assert!(!connection_is_protected(&connections, "old"));
        assert!(!connection_is_protected(&connections, "missing"));
    }

    #[test]
    fn a_connection_to_the_same_server_as_a_protected_one_is_protected() {
        let connections = serde_json::json!([
            { "id": "prod", "tag": "production", "mode": "uri", "uri": "mongodb://u:p@DB1.corp:27017,db2.corp/app?replicaSet=rs" },
            { "id": "alias", "tag": "development", "mode": "fields", "host": "db2.corp", "port": 27017 },
            { "id": "other_port", "tag": "development", "mode": "fields", "host": "db2.corp", "port": 27018 },
            { "id": "local_prod", "protected": true, "mode": "fields", "host": "127.0.0.1", "port": 27017 },
            { "id": "local", "mode": "uri", "uri": "mongodb://localhost" },
            { "id": "tunnel", "mode": "fields", "host": "localhost", "port": 27017,
              "ssh": { "enabled": true, "host": "bastion", "port": 22 } },
            { "id": "srv_prod", "protected": true, "mode": "fields", "host": "cluster0.abc.mongodb.net", "srv": true },
            { "id": "srv_qa", "mode": "uri", "uri": "mongodb+srv://qa@cluster0.abc.mongodb.net/?retryWrites=true" },
        ]);
        assert!(connection_is_protected(&connections, "alias"));
        assert!(!connection_is_protected(&connections, "other_port"));
        assert!(connection_is_protected(&connections, "local"));
        // Por el túnel, `localhost` es el servidor SSH, no esta máquina.
        assert!(!connection_is_protected(&connections, "tunnel"));
        assert!(connection_is_protected(&connections, "srv_qa"));
    }

    #[test]
    fn addresses_are_normalized() {
        assert_eq!(normalized_address("[::1]:27018"), "localhost:27018");
        assert_eq!(normalized_address("::1"), "localhost:27017");
        assert_eq!(normalized_address("db.corp"), "db.corp:27017");
        assert_eq!(uri_addresses("mongodb://a:b@x,y:1/db"), ["x:27017", "y:1"]);
        assert_eq!(uri_addresses("no es una uri"), Vec::<String>::new());
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
