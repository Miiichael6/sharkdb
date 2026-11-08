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

use crate::safe_mode::SafeMode;
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
    /// Read-only switch of the session, shared with the shells that use its client.
    safe_mode: SafeMode,
}

impl OpenClient {
    async fn shutdown(self) {
        self.client.shutdown().await;
        if let Some(tunnel) = self.tunnel {
            tunnel.close().await;
        }
    }
}

/// A client opened apart for the operations (sync, backup, restore) on a connection the user hasn't
/// opened; it closes when the last one that holds it lets it go.
struct Detached {
    client: OpenClient,
    /// Where it was opened to: a hold for a connection edited since then must not reuse it.
    endpoint: Endpoint,
    holders: usize,
}

/// Where a client leads: its URI and, through a tunnel, the SSH server it goes through.
#[derive(Clone, Debug, PartialEq)]
struct Endpoint {
    uri: String,
    ssh: Option<(String, u16)>,
}

impl Endpoint {
    fn new(uri: &str, ssh: Option<&SshConfig>) -> Self {
        Self { uri: uri.to_string(), ssh: ssh.map(|s| (s.host.clone(), s.port)) }
    }
}

const DETACHED_READ_ONLY: &str =
    "La conexión ya está abierta aparte en solo lectura por otra operación; espera a que termine";
const DETACHED_EDITED: &str =
    "La conexión cambió mientras otra operación la usa con sus datos anteriores; espera a que termine";

impl Detached {
    /// Another hold on this client, in `safe_mode`, for a connection that now leads to `endpoint`.
    /// Fails when the connection was edited since the client was opened (it would write on the old
    /// server while the checks looked at the new one). The strictest mode wins: asking for
    /// read-only turns it on for every holder, and asking to write while it is read-only fails.
    fn join(&mut self, safe_mode: bool, endpoint: &Endpoint) -> Result<Client, String> {
        if *endpoint != self.endpoint {
            return Err(DETACHED_EDITED.into());
        }
        let current = &self.client.safe_mode;
        if safe_mode {
            current.set(true);
        } else if current.is_enabled() {
            return Err(DETACHED_READ_ONLY.into());
        }
        self.holders += 1;
        Ok(self.client.client.clone())
    }
}

/// Clients keyed by saved-connection id: the sessions the user opened and, apart from them, the
/// detached ones the operations borrow. An open session wins over a detached one with the same id.
#[derive(Default)]
pub struct Sessions {
    open: Mutex<HashMap<String, OpenClient>>,
    detached: Mutex<HashMap<String, Detached>>,
}

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

async fn open(
    uri: &str,
    ssh: Option<SshConfig>,
    known_hosts: PathBuf,
    safe_mode: bool,
) -> Result<OpenClient, String> {
    let mut opts = ClientOptions::parse(uri).await.map_err(describe)?;
    opts.app_name = Some("sharkdb".into());
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
    Ok(OpenClient {
        client,
        tunnel,
        uri: uri.to_string(),
        safe_mode: SafeMode::new(safe_mode),
    })
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
    let open = open(&uri, ssh, known_hosts_path(&app)?, true).await?;
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
    safe_mode: bool,
) -> Result<ServerInfo, String> {
    let client = open(&uri, ssh, known_hosts_path(&app)?, safe_mode).await?;
    let info = match server_info(&client.client).await {
        Ok(info) => info,
        Err(e) => {
            client.shutdown().await;
            return Err(e);
        }
    };
    // El shell abierto usa el cliente anterior: se suelta antes de cerrarlo.
    shells.close(&id);
    if let Some(old) = sessions.open.lock().await.insert(id, client) {
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
    if let Some(client) = sessions.open.lock().await.remove(&id) {
        client.shutdown().await;
    }
    Ok(())
}

/// Opens connection `id` apart, without a session (the explorer doesn't show it), for an operation
/// to use; each call holds it until its `close_detached`. Reuses the one already open apart.
#[tauri::command]
pub async fn open_detached(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    id: String,
    uri: String,
    ssh: Option<SshConfig>,
    safe_mode: bool,
) -> Result<ServerInfo, String> {
    let known_hosts = known_hosts_path(&app)?;
    let endpoint = Endpoint::new(&uri, ssh.as_ref());
    sessions.hold_detached(&id, safe_mode, endpoint, || open(&uri, ssh, known_hosts, safe_mode)).await
}

/// Lets go of a hold taken by `open_detached`; the last one closes the client.
#[tauri::command]
pub async fn close_detached(sessions: State<'_, Sessions>, id: String) -> Result<(), String> {
    sessions.release_detached(&id).await;
    Ok(())
}

impl Sessions {
    /// Opens `uri` (no tunnel) as session `id`: for the tests against a real MongoDB.
    #[cfg(test)]
    pub(crate) async fn open_for_test(&self, id: &str, uri: &str, safe_mode: bool) {
        let client = open(uri, None, PathBuf::new(), safe_mode).await.expect("client");
        self.open.lock().await.insert(id.to_string(), client);
    }

    /// Takes a hold on the client opened apart for `id`, opening it with `open_client` (in
    /// `safe_mode`, to `endpoint`) when there's none; fails (holding nothing) when the server
    /// doesn't answer or the client already open can't be used (see `Detached::join`).
    async fn hold_detached<F, Fut>(
        &self,
        id: &str,
        safe_mode: bool,
        endpoint: Endpoint,
        open_client: F,
    ) -> Result<ServerInfo, String>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<OpenClient, String>>,
    {
        let held = self.detached.lock().await.get_mut(id).map(|held| held.join(safe_mode, &endpoint));
        if let Some(client) = held {
            let client = client?;
            let info = server_info(&client).await;
            if info.is_err() {
                self.release_detached(id).await;
            }
            return info;
        }
        let client = open_client().await?;
        let info = match server_info(&client.client).await {
            Ok(info) => info,
            Err(e) => {
                client.shutdown().await;
                return Err(e);
            }
        };
        let mut detached = self.detached.lock().await;
        match detached.get_mut(id) {
            // Another call opened it meanwhile: this one shares that client.
            Some(held) => {
                let joined = held.join(safe_mode, &endpoint).map(|_| ());
                drop(detached);
                client.shutdown().await;
                joined?;
            }
            None => {
                detached.insert(id.to_string(), Detached { client, endpoint, holders: 1 });
            }
        }
        Ok(info)
    }

    async fn release_detached(&self, id: &str) {
        let mut detached = self.detached.lock().await;
        let Some(held) = detached.get_mut(id) else { return };
        held.holders -= 1;
        if held.holders == 0 {
            let held = detached.remove(id).expect("just found");
            drop(detached);
            held.client.shutdown().await;
        }
    }
}

const NOT_OPEN: &str = "La conexión no está abierta";

/// The client of an open session (or, without one, of the one opened apart) and its read-only
/// switch. Code that runs arbitrary commands checks them with `safe_mode.check_command(&command)?`
/// before sending them.
pub(crate) async fn session_with_safe_mode(
    sessions: &Sessions,
    id: &str,
) -> Result<(Client, SafeMode), String> {
    let pair = |open: &OpenClient| (open.client.clone(), open.safe_mode.clone());
    if let Some(found) = sessions.open.lock().await.get(id).map(pair) {
        return Ok(found);
    }
    sessions
        .detached
        .lock()
        .await
        .get(id)
        .map(|held| pair(&held.client))
        .ok_or_else(|| NOT_OPEN.to_string())
}

/// Client of a session for an operation that always writes (mongosh, restore, sync); fails with
/// "Safe mode activo" while the session is read-only. Any new writing command goes through here
/// (backup/restore and sync too).
pub(crate) async fn writable_session(sessions: &Sessions, id: &str) -> Result<Client, String> {
    let (client, safe_mode) = session_with_safe_mode(sessions, id).await?;
    safe_mode.ensure_writable()?;
    Ok(client)
}

/// Turns the read-only switch of an open session on or off; the open shells see it at once.
#[tauri::command]
pub async fn set_safe_mode(
    sessions: State<'_, Sessions>,
    id: String,
    enabled: bool,
) -> Result<(), String> {
    session_with_safe_mode(&sessions, &id).await?.1.set(enabled);
    Ok(())
}

/// URI an open session was opened with, and the local port of its SSH tunnel if it has one.
pub(crate) async fn session_uri(sessions: &Sessions, id: &str) -> Result<(String, Option<u16>), String> {
    sessions
        .open
        .lock()
        .await
        .get(id)
        .map(|open| (open.uri.clone(), open.tunnel.as_ref().map(SshTunnel::local_port)))
        .ok_or_else(|| NOT_OPEN.to_string())
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
    let (client, safe_mode) = session_with_safe_mode(&sessions, &id).await?;
    let command = command_from_json(command)?;
    safe_mode.check_command(&command)?;
    let reply = client
        .database(&db)
        .run_command(command, None)
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
        let open = open(uri, ssh, known_hosts, false).await.unwrap();
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

    /// A client that never connects (the driver connects lazily), to fill the registry.
    async fn idle_client(safe_mode: bool) -> OpenClient {
        let client = Client::with_uri_str("mongodb://127.0.0.1:1/").await.unwrap();
        OpenClient { client, tunnel: None, uri: String::new(), safe_mode: SafeMode::new(safe_mode) }
    }

    fn endpoint(host: &str) -> Endpoint {
        Endpoint::new(&format!("mongodb://{host}/"), None)
    }

    #[tokio::test]
    async fn an_open_session_wins_over_the_detached_client() {
        let sessions = Sessions::default();
        sessions.detached.lock().await.insert("c".into(), Detached { client: idle_client(false).await, endpoint: endpoint("a"), holders: 1 });
        sessions.open.lock().await.insert("c".into(), idle_client(true).await);
        assert!(session_with_safe_mode(&sessions, "c").await.unwrap().1.is_enabled());

        sessions.open.lock().await.remove("c").unwrap().shutdown().await;
        assert!(!session_with_safe_mode(&sessions, "c").await.unwrap().1.is_enabled());
        // mongosh only ever uses a session the user opened.
        assert!(session_uri(&sessions, "c").await.is_err());

        sessions.release_detached("c").await;
        assert_eq!(session_with_safe_mode(&sessions, "c").await.unwrap_err(), NOT_OPEN);
    }

    /// Prueba real contra un mongod local: el cliente aparte se abre una sola vez aunque lo tomen
    /// dos operaciones y se cierra cuando lo suelta la última.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_detached_client_is_shared_and_closed_by_the_last_holder() {
        let sessions = Sessions::default();
        let opened = std::sync::atomic::AtomicUsize::new(0);
        let open_local = || async {
            opened.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
            let known_hosts = std::env::temp_dir().join("robo3b-it-known_hosts");
            open("mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000", None, known_hosts, false).await
        };
        let info = sessions.hold_detached("local", false, endpoint("local"), open_local).await.unwrap();
        assert!(!info.databases.is_empty());
        sessions.hold_detached("local", false, endpoint("local"), open_local).await.unwrap();
        assert_eq!(opened.load(std::sync::atomic::Ordering::SeqCst), 1);

        sessions.release_detached("local").await;
        let (client, _) = session_with_safe_mode(&sessions, "local").await.unwrap();
        client.database("admin").run_command(doc! { "ping": 1 }, None).await.unwrap();

        sessions.release_detached("local").await;
        assert_eq!(session_with_safe_mode(&sessions, "local").await.unwrap_err(), NOT_OPEN);
    }

    #[tokio::test]
    async fn a_detached_client_that_does_not_answer_holds_nothing() {
        let sessions = Sessions::default();
        let unreachable = || async {
            let known_hosts = std::env::temp_dir().join("robo3b-it-known_hosts");
            open("mongodb://127.0.0.1:1/?serverSelectionTimeoutMS=200", None, known_hosts, false).await
        };
        assert!(sessions.hold_detached("down", false, endpoint("down"), unreachable).await.is_err());
        assert!(sessions.detached.lock().await.is_empty());
    }

    #[tokio::test]
    async fn a_shared_detached_client_takes_the_strictest_safe_mode() {
        let mut writable = Detached { client: idle_client(false).await, endpoint: endpoint("a"), holders: 1 };
        writable.join(true, &endpoint("a")).unwrap();
        assert!(writable.client.safe_mode.is_enabled());
        assert_eq!(writable.holders, 2);

        let mut read_only = Detached { client: idle_client(true).await, endpoint: endpoint("a"), holders: 1 };
        assert_eq!(read_only.join(false, &endpoint("a")).unwrap_err(), DETACHED_READ_ONLY);
        assert_eq!(read_only.holders, 1);
        read_only.join(true, &endpoint("a")).unwrap();
        assert!(read_only.client.safe_mode.is_enabled());
    }

    #[tokio::test]
    async fn a_detached_client_is_not_shared_once_its_connection_leads_elsewhere() {
        let mut held = Detached { client: idle_client(false).await, endpoint: endpoint("prod"), holders: 1 };
        assert_eq!(held.join(false, &endpoint("qa")).unwrap_err(), DETACHED_EDITED);
        let through_ssh = Endpoint { ssh: Some(("bastion".into(), 22)), ..endpoint("prod") };
        assert_eq!(held.join(false, &through_ssh).unwrap_err(), DETACHED_EDITED);
        assert_eq!(held.holders, 1);
        held.join(false, &endpoint("prod")).unwrap();
        assert_eq!(held.holders, 2);
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
