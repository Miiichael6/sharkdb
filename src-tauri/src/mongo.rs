use std::collections::HashMap;
use std::path::PathBuf;
use std::time::Duration;

use mongodb::Client;
use mongodb::bson::{Bson, Document, doc};
use mongodb::error::{Error, ErrorKind};
use mongodb::options::{ClientOptions, ListDatabasesOptions, ServerAddress};
use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, State};

use crate::shell::ShellSessions;
use crate::ssh_tunnel::{SshConfig, SshTunnel, TunnelTarget};
use crate::store;
use tokio::sync::Mutex;

/// Used when the URI doesn't set connectTimeoutMS / serverSelectionTimeoutMS.
const TIMEOUT: Duration = Duration::from_secs(6);
const DEFAULT_MONGO_PORT: u16 = 27017;
const TUNNEL_HOST: &str = "127.0.0.1";
const KNOWN_HOSTS_FILE: &str = "known_hosts";

/// A client plus the SSH tunnel it goes through, if any: both live and die together.
struct OpenClient {
    client: Client,
    tunnel: Option<SshTunnel>,
    /// The URI it was opened with, for external tools (mongosh).
    uri: String,
}

impl OpenClient {
    async fn shutdown(self) {
        self.client.shutdown().await;
        if let Some(tunnel) = self.tunnel {
            tunnel.close().await;
        }
    }
}

/// Open clients, keyed by saved-connection id.
#[derive(Default)]
pub struct Sessions(Mutex<HashMap<String, OpenClient>>);

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
pub(crate) fn describe(e: Error) -> String {
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

/// The single server an SSH tunnel can lead to; a list of hosts (or an SRV record that
/// resolves to several) can't go through one local port.
fn tunnel_target(opts: &ClientOptions) -> Result<TunnelTarget, String> {
    match opts.hosts.as_slice() {
        [ServerAddress::Tcp { host, port }] => Ok(TunnelTarget {
            host: host.clone(),
            port: port.unwrap_or(DEFAULT_MONGO_PORT),
        }),
        _ => Err("Con túnel SSH la conexión debe apuntar a un único servidor".into()),
    }
}

/// Points the driver at the local end of the tunnel. Direct connection stops it from
/// discovering replica-set members by names only the bastion can reach.
fn route_through_tunnel(opts: &mut ClientOptions, local_port: u16) {
    opts.hosts = vec![ServerAddress::Tcp {
        host: TUNNEL_HOST.into(),
        port: Some(local_port),
    }];
    opts.direct_connection = Some(true);
}

fn known_hosts_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(store::config_dir(app)?.join(KNOWN_HOSTS_FILE))
}

async fn open(uri: &str, ssh: Option<SshConfig>, known_hosts: PathBuf) -> Result<OpenClient, String> {
    let mut opts = ClientOptions::parse(uri).await.map_err(describe)?;
    opts.app_name = Some("robo3b".into());
    opts.server_selection_timeout.get_or_insert(TIMEOUT);
    opts.connect_timeout.get_or_insert(TIMEOUT);

    let tunnel = match ssh {
        Some(config) => {
            let tunnel = SshTunnel::open(&config, tunnel_target(&opts)?, known_hosts).await?;
            route_through_tunnel(&mut opts, tunnel.local_port());
            Some(tunnel)
        }
        None => None,
    };
    let client = Client::with_options(opts).map_err(describe)?;
    Ok(OpenClient { client, tunnel, uri: uri.to_string() })
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
pub async fn test_connection(app: AppHandle, uri: String, ssh: Option<SshConfig>) -> Result<ServerInfo, String> {
    let open = open(&uri, ssh, known_hosts_path(&app)?).await?;
    let info = server_info(&open.client).await;
    open.shutdown().await;
    info
}

#[tauri::command]
pub async fn connect(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    shells: State<'_, ShellSessions>,
    id: String,
    uri: String,
    ssh: Option<SshConfig>,
) -> Result<ServerInfo, String> {
    let client = open(&uri, ssh, known_hosts_path(&app)?).await?;
    let info = match server_info(&client.client).await {
        Ok(info) => info,
        Err(e) => {
            client.shutdown().await;
            return Err(e);
        }
    };
    // El shell abierto usa el cliente anterior: se suelta antes de cerrarlo.
    shells.close(&id);
    if let Some(old) = sessions.0.lock().await.insert(id, client) {
        old.shutdown().await;
    }
    Ok(info)
}

#[tauri::command]
pub async fn disconnect(
    sessions: State<'_, Sessions>,
    shells: State<'_, ShellSessions>,
    id: String,
) -> Result<(), String> {
    // `shutdown` espera a que se suelten los cursores, y los del shell viven en su hilo.
    shells.close(&id);
    if let Some(client) = sessions.0.lock().await.remove(&id) {
        client.shutdown().await;
    }
    Ok(())
}

pub(crate) async fn session(sessions: &Sessions, id: &str) -> Result<Client, String> {
    sessions
        .0
        .lock()
        .await
        .get(id)
        .map(|open| open.client.clone())
        .ok_or_else(|| "La conexión no está abierta".to_string())
}

/// URI an open session was opened with, and the local port of its SSH tunnel if it has one.
pub(crate) async fn session_uri(sessions: &Sessions, id: &str) -> Result<(String, Option<u16>), String> {
    sessions
        .0
        .lock()
        .await
        .get(id)
        .map(|open| (open.uri.clone(), open.tunnel.as_ref().map(SshTunnel::local_port)))
        .ok_or_else(|| "La conexión no está abierta".to_string())
}

/// Parses a command written as extended JSON. Key order matters (the first key is the command
/// name, index keys are ordered), which is why serde_json has `preserve_order` on.
pub(crate) fn command_from_json(command: Value) -> Result<Document, String> {
    match Bson::try_from(command).map_err(|e| e.to_string())? {
        Bson::Document(command) => Ok(command),
        _ => Err("El comando debe ser un objeto JSON".into()),
    }
}

pub(crate) fn reply_to_json(reply: Document) -> Value {
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
        let index = command.get_array("indexes").unwrap()[0]
            .as_document()
            .unwrap();
        let index_keys: Vec<&String> = index.get_document("key").unwrap().keys().collect();
        assert_eq!(index_keys, ["b", "a"]);
        assert!(matches!(command.get("since"), Some(Bson::DateTime(_))));
    }

    async fn options(uri: &str) -> ClientOptions {
        ClientOptions::parse(uri).await.unwrap()
    }

    #[tokio::test]
    async fn tunnel_target_is_the_single_host_with_its_default_port() {
        let target = tunnel_target(&options("mongodb://db.internal/?replicaSet=rs0").await).unwrap();
        assert_eq!(target, TunnelTarget { host: "db.internal".into(), port: DEFAULT_MONGO_PORT });
        assert!(tunnel_target(&options("mongodb://a:1,b:2/").await).is_err());
    }

    #[tokio::test]
    async fn routing_through_the_tunnel_keeps_the_other_options() {
        let mut opts = options("mongodb://db.internal:27018/?replicaSet=rs0&tls=true").await;
        route_through_tunnel(&mut opts, 40123);
        assert_eq!(opts.hosts, [ServerAddress::Tcp { host: TUNNEL_HOST.into(), port: Some(40123) }]);
        assert_eq!(opts.direct_connection, Some(true));
        assert_eq!(opts.repl_set_name.as_deref(), Some("rs0"));
        assert!(opts.tls.is_some());
    }

    /// Real servers for the manual check of task 07; each test runs only when its variable is set:
    /// ROBO3B_TLS_URI (e.g. a mongod with a self-signed certificate) and ROBO3B_SSH_URI plus
    /// ROBO3B_SSH (the tunnel settings as the frontend sends them, in JSON).
    async fn open_and_list(uri: &str, ssh: Option<SshConfig>) -> OpenClient {
        let known_hosts = std::env::temp_dir().join("robo3b-it-known_hosts");
        let open = open(uri, ssh, known_hosts).await.unwrap();
        let info = server_info(&open.client).await.unwrap();
        assert!(!info.databases.is_empty());
        open
    }

    #[tokio::test]
    #[ignore = "needs ROBO3B_TLS_URI"]
    async fn connects_with_tls_certificates() {
        let uri = std::env::var("ROBO3B_TLS_URI").unwrap();
        open_and_list(&uri, None).await.shutdown().await;
    }

    #[tokio::test]
    #[ignore = "needs ROBO3B_SSH_URI and ROBO3B_SSH"]
    async fn connects_through_an_ssh_tunnel_and_closes_it() {
        let uri = std::env::var("ROBO3B_SSH_URI").unwrap();
        let ssh: SshConfig = serde_json::from_str(&std::env::var("ROBO3B_SSH").unwrap()).unwrap();
        let open = open_and_list(&uri, Some(ssh)).await;
        let local_port = open.tunnel.as_ref().unwrap().local_port();
        open.shutdown().await;
        // Once closed, nothing listens on the tunnel's local port any more.
        assert!(tokio::net::TcpStream::connect((TUNNEL_HOST, local_port)).await.is_err());
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
