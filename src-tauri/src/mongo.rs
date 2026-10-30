use std::collections::HashMap;
use std::time::Duration;

use mongodb::bson::{doc, Bson, Document};
use mongodb::error::{Error, ErrorKind};
use mongodb::options::{ClientOptions, ListDatabasesOptions};
use mongodb::Client;
use serde::Serialize;
use serde_json::Value;
use tauri::State;
use tokio::sync::Mutex;

const TIMEOUT: Duration = Duration::from_secs(6);

/// Open clients, keyed by saved-connection id.
#[derive(Default)]
pub struct Sessions(Mutex<HashMap<String, Client>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseInfo {
    name: String,
    size_on_disk: u64,
    empty: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServerInfo {
    version: String,
    databases: Vec<DatabaseInfo>,
}

/// Driver errors carry debug noise (labels, topology dumps); keep what a user can act on.
fn describe(e: Error) -> String {
    match *e.kind {
        ErrorKind::Command(c) => format!("{} ({})", c.message, c.code_name),
        ErrorKind::Authentication { message, .. } => format!("Autenticación fallida: {message}"),
        ErrorKind::ServerSelection { message, .. } => {
            // "... Topology: { ..., Servers: [ { ..., Error: <cause> }, ] }" -> "<cause>"
            // The cause is itself a formatted error: "Kind: I/O error: <msg>, labels: {}".
            let cause = message.split_once("Error: Kind: ").map(|(_, rest)| {
                let rest = rest.split(", labels:").next().unwrap_or(rest);
                rest.split_once("error: ").map_or(rest, |(_, msg)| msg)
            });
            match cause {
                Some(cause) => format!("No se pudo conectar con el servidor: {cause}"),
                None => "No se pudo conectar con el servidor (tiempo de espera agotado)".into(),
            }
        }
        kind => kind.to_string(),
    }
}

async fn open(uri: &str) -> Result<Client, String> {
    let mut opts = ClientOptions::parse(uri).await.map_err(describe)?;
    opts.app_name = Some("robo3b".into());
    opts.server_selection_timeout = Some(TIMEOUT);
    opts.connect_timeout = Some(TIMEOUT);
    Client::with_options(opts).map_err(describe)
}

async fn server_info(client: &Client) -> Result<ServerInfo, String> {
    let build = client
        .database("admin")
        .run_command(doc! { "buildInfo": 1 }, None)
        .await
        .map_err(describe)?;
    let version = build.get_str("version").unwrap_or("?").to_string();

    // authorized_databases lets users without listDatabases on the cluster still see their DBs.
    let databases = client
        .list_databases(
            None,
            ListDatabasesOptions::builder()
                .authorized_databases(true)
                .build(),
        )
        .await
        .map_err(describe)?
        .into_iter()
        .map(|d| DatabaseInfo {
            name: d.name,
            size_on_disk: d.size_on_disk,
            empty: d.empty,
        })
        .collect();

    Ok(ServerInfo { version, databases })
}

#[tauri::command]
pub async fn test_connection(uri: String) -> Result<ServerInfo, String> {
    let client = open(&uri).await?;
    let info = server_info(&client).await;
    client.shutdown().await;
    info
}

#[tauri::command]
pub async fn connect(
    sessions: State<'_, Sessions>,
    id: String,
    uri: String,
) -> Result<ServerInfo, String> {
    let client = open(&uri).await?;
    let info = server_info(&client).await?;
    if let Some(old) = sessions.0.lock().await.insert(id, client) {
        old.shutdown().await;
    }
    Ok(info)
}

#[tauri::command]
pub async fn disconnect(sessions: State<'_, Sessions>, id: String) -> Result<(), String> {
    if let Some(client) = sessions.0.lock().await.remove(&id) {
        client.shutdown().await;
    }
    Ok(())
}

async fn session(sessions: &Sessions, id: &str) -> Result<Client, String> {
    sessions
        .0
        .lock()
        .await
        .get(id)
        .cloned()
        .ok_or_else(|| "La conexión no está abierta".to_string())
}

/// Parses a command written as extended JSON. Key order matters (the first key is the command
/// name, index keys are ordered), which is why serde_json has `preserve_order` on.
fn command_from_json(command: Value) -> Result<Document, String> {
    match Bson::try_from(command).map_err(|e| e.to_string())? {
        Bson::Document(command) => Ok(command),
        _ => Err("El comando debe ser un objeto JSON".into()),
    }
}

fn reply_to_json(reply: Document) -> Value {
    Bson::Document(reply).into_relaxed_extjson()
}

#[tauri::command]
pub async fn run_command(
    sessions: State<'_, Sessions>,
    id: String,
    db: String,
    command: Value,
) -> Result<Value, String> {
    let client = session(&sessions, &id).await?;
    let reply = client
        .database(&db)
        .run_command(command_from_json(command)?, None)
        .await
        .map_err(describe)?;
    Ok(reply_to_json(reply))
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::oid::ObjectId;
    use serde_json::json;

    #[test]
    fn command_keeps_key_order_and_extended_json_types() {
        let command = command_from_json(json!({
            "createIndexes": "orders",
            "indexes": [{ "key": { "b": 1, "a": -1 }, "name": "b_1_a_-1" }],
            "since": { "$date": "2024-01-02T03:04:05Z" },
        }))
        .unwrap();
        let keys: Vec<&String> = command.keys().collect();
        assert_eq!(keys, ["createIndexes", "indexes", "since"]);
        let index = command.get_array("indexes").unwrap()[0].as_document().unwrap();
        let index_keys: Vec<&String> = index.get_document("key").unwrap().keys().collect();
        assert_eq!(index_keys, ["b", "a"]);
        assert!(matches!(command.get("since"), Some(Bson::DateTime(_))));
    }

    #[test]
    fn command_must_be_an_object() {
        assert!(command_from_json(json!([1, 2])).is_err());
        assert!(command_from_json(json!("ping")).is_err());
    }

    #[test]
    fn reply_uses_relaxed_extended_json() {
        let oid = ObjectId::parse_str("65a1b2c3d4e5f6a7b8c9d0e1").unwrap();
        let reply = doc! { "ok": 1.0, "n": 3_i64, "_id": oid };
        assert_eq!(
            reply_to_json(reply),
            json!({ "ok": 1.0, "n": 3, "_id": { "$oid": "65a1b2c3d4e5f6a7b8c9d0e1" } })
        );
    }
}
