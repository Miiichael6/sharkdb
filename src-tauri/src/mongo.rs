use std::collections::HashMap;
use std::time::Duration;

use mongodb::bson::{doc, Bson};
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

/// Runs a database command written as extended JSON. Key order matters (the first key is the
/// command name, index keys are ordered), which is why serde_json has `preserve_order` on.
#[tauri::command]
pub async fn run_command(
    sessions: State<'_, Sessions>,
    id: String,
    db: String,
    command: Value,
) -> Result<Value, String> {
    let client = session(&sessions, &id).await?;
    let Bson::Document(command) = Bson::try_from(command).map_err(|e| e.to_string())? else {
        return Err("El comando debe ser un objeto JSON".into());
    };
    let reply = client
        .database(&db)
        .run_command(command, None)
        .await
        .map_err(describe)?;
    Ok(Bson::Document(reply).into_relaxed_extjson())
}
