// "Abrir mongosh": the session's URI, pointed at one database, opened in a terminal window.
// The URI rewriting is pure (and tested); only `open_mongosh` touches the system.
use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::State;

use crate::mongo::{self, Sessions};

const MONGOSH: &str = "mongosh";
const WINDOWS_TERMINAL: &str = "wt";
const TUNNEL_HOST: &str = "127.0.0.1";
const DEFAULT_AUTH_DB: &str = "admin";

/// `scheme://[credentials@]hosts/[database][?options]`, split into its parts.
struct UriParts<'a> {
    scheme: &'a str,
    credentials: Option<&'a str>,
    hosts: &'a str,
    database: &'a str,
    options: Vec<&'a str>,
}

fn split_uri(uri: &str) -> Result<UriParts<'_>, String> {
    let invalid = || format!("URI de conexión no válida: {uri}");
    let (scheme, rest) = uri.split_once("://").ok_or_else(invalid)?;
    let (authority_path, query) = rest.split_once('?').unwrap_or((rest, ""));
    let (authority, database) = authority_path.split_once('/').unwrap_or((authority_path, ""));
    // Credentials end at the last '@': an unencoded '@' may appear in a password.
    let (credentials, hosts) = match authority.rsplit_once('@') {
        Some((credentials, hosts)) => (Some(credentials), hosts),
        None => (None, authority),
    };
    if hosts.is_empty() {
        return Err(invalid());
    }
    let options = query.split('&').filter(|o| !o.is_empty()).collect();
    Ok(UriParts { scheme, credentials, hosts, database, options })
}

fn join_uri(parts: &UriParts, options: &[String]) -> String {
    let credentials = parts.credentials.map(|c| format!("{c}@")).unwrap_or_default();
    let query = if options.is_empty() { String::new() } else { format!("?{}", options.join("&")) };
    format!("{}://{credentials}{}/{}{query}", parts.scheme, parts.hosts, parts.database)
}

fn has_option(options: &[String], name: &str) -> bool {
    options.iter().any(|o| o.split('=').next().is_some_and(|k| k.eq_ignore_ascii_case(name)))
}

/// Database names may hold characters that aren't valid in a URI path.
fn encode_path_segment(s: &str) -> String {
    s.bytes()
        .map(|b| match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => (b as char).to_string(),
            _ => format!("%{b:02X}"),
        })
        .collect()
}

/// The URI mongosh is started with: on `db`, and through the session's SSH tunnel if it has one.
/// The path database is also the default auth database, so the original one is kept as
/// `authSource` when the URI has credentials and didn't set it.
pub fn mongosh_uri(uri: &str, db: &str, tunnel_port: Option<u16>) -> Result<String, String> {
    let mut parts = split_uri(uri)?;
    let mut options: Vec<String> = parts.options.iter().map(|o| o.to_string()).collect();
    if parts.credentials.is_some() && !has_option(&options, "authSource") {
        let auth_db = if parts.database.is_empty() { DEFAULT_AUTH_DB } else { parts.database };
        options.push(format!("authSource={auth_db}"));
    }
    let tunnel_hosts;
    if let Some(port) = tunnel_port {
        // Same routing as the app's own client (see mongo::route_through_tunnel).
        tunnel_hosts = format!("{TUNNEL_HOST}:{port}");
        parts.scheme = "mongodb";
        parts.hosts = &tunnel_hosts;
        if !has_option(&options, "directConnection") {
            options.push("directConnection=true".into());
        }
    }
    let database = encode_path_segment(db);
    parts.database = &database;
    Ok(join_uri(&parts, &options))
}

/// First `<name>` executable on `path` (the PATH variable's value).
fn find_in_path(name: &str, path: &std::ffi::OsStr) -> Option<PathBuf> {
    let file = if cfg!(windows) { format!("{name}.exe") } else { name.to_string() };
    std::env::split_paths(path).map(|dir| dir.join(&file)).find(|p| p.is_file())
}

fn find_executable(name: &str) -> Option<PathBuf> {
    find_in_path(name, &std::env::var_os("PATH")?)
}

/// Windows Terminal splits its command line on ';' (even inside an argument) unless escaped.
fn escape_for_windows_terminal(arg: &str) -> String {
    arg.replace(';', "\\;")
}

#[cfg(windows)]
fn launch(mongosh: &Path, uri: &str) -> std::io::Result<()> {
    use std::os::windows::process::CommandExt;
    // Without Windows Terminal, mongosh gets its own console window (what `cmd /c start` does),
    // with no shell in between that could reinterpret '&' or '%' in the URI.
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;

    if let Some(wt) = find_executable(WINDOWS_TERMINAL) {
        let mut command = Command::new(wt);
        command.args(["new-tab", "--title", MONGOSH]).arg(mongosh).arg(escape_for_windows_terminal(uri));
        return command.spawn().map(drop);
    }
    Command::new(mongosh).arg(uri).creation_flags(CREATE_NEW_CONSOLE).spawn().map(drop)
}

#[cfg(not(windows))]
fn launch(_mongosh: &Path, _uri: &str) -> std::io::Result<()> {
    Err(std::io::Error::other("abrir mongosh en una terminal solo está disponible en Windows por ahora"))
}

#[tauri::command]
pub async fn open_mongosh(sessions: State<'_, Sessions>, id: String, db: String) -> Result<(), String> {
    let (uri, tunnel_port) = mongo::session_uri(&sessions, &id).await?;
    let mongosh = find_executable(MONGOSH)
        .ok_or("No se encontró mongosh en el PATH. Instálalo desde https://www.mongodb.com/try/download/shell")?;
    launch(&mongosh, &mongosh_uri(&uri, &db, tunnel_port)?).map_err(|e| format!("No se pudo abrir la terminal: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn points_the_uri_at_the_database() {
        assert_eq!(mongosh_uri("mongodb://localhost:27017", "shop", None).unwrap(), "mongodb://localhost:27017/shop");
        assert_eq!(
            mongosh_uri("mongodb://a:1,b:2/old?replicaSet=rs0", "shop", None).unwrap(),
            "mongodb://a:1,b:2/shop?replicaSet=rs0"
        );
    }

    #[test]
    fn keeps_the_original_auth_database() {
        assert_eq!(
            mongosh_uri("mongodb://u:p%40ss@h/reports", "shop", None).unwrap(),
            "mongodb://u:p%40ss@h/shop?authSource=reports"
        );
        assert_eq!(mongosh_uri("mongodb://u:p@h", "shop", None).unwrap(), "mongodb://u:p@h/shop?authSource=admin");
        assert_eq!(
            mongosh_uri("mongodb://u:p@h/x?authsource=users&tls=true", "shop", None).unwrap(),
            "mongodb://u:p@h/shop?authsource=users&tls=true"
        );
    }

    #[test]
    fn goes_through_the_tunnel_port() {
        assert_eq!(
            mongosh_uri("mongodb+srv://u:p@cluster.example.net/?tls=true", "shop", Some(40123)).unwrap(),
            "mongodb://u:p@127.0.0.1:40123/shop?tls=true&authSource=admin&directConnection=true"
        );
    }

    #[test]
    fn encodes_unusual_database_names() {
        assert_eq!(mongosh_uri("mongodb://h", "my db", None).unwrap(), "mongodb://h/my%20db");
    }

    #[test]
    fn rejects_what_is_not_a_uri() {
        assert!(mongosh_uri("localhost:27017", "shop", None).is_err());
        assert!(mongosh_uri("mongodb:///shop", "shop", None).is_err());
    }

    #[test]
    fn escapes_separators_for_windows_terminal() {
        assert_eq!(escape_for_windows_terminal("mongodb://h/?a=1;b=2"), "mongodb://h/?a=1\\;b=2");
    }

    #[test]
    fn finds_executables_on_the_path() {
        let dir = std::env::temp_dir().join("robo3b-terminal-test");
        std::fs::create_dir_all(&dir).unwrap();
        let file = if cfg!(windows) { "fake-tool.exe" } else { "fake-tool" };
        std::fs::write(dir.join(file), "").unwrap();
        let path = std::env::join_paths([std::env::temp_dir(), dir.clone()]).unwrap();
        assert_eq!(find_in_path("fake-tool", &path), Some(dir.join(file)));
        assert_eq!(find_in_path("missing-tool", &path), None);
    }
}
