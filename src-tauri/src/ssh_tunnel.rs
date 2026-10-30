// Local port forwarding through an SSH bastion: the Mongo driver connects to
// 127.0.0.1:<local port> and every socket accepted there is carried over a `direct-tcpip`
// channel to the real server, as seen from the bastion.
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use russh::client::{self, Handle};
use russh::keys::{self, PrivateKeyWithHashAlg, PublicKeyOrCertificate};
use russh::Disconnect;
use serde::Deserialize;
use tokio::net::{TcpListener, TcpStream};
use tokio::task::JoinHandle;

const LOCALHOST: &str = "127.0.0.1";
const CONNECT_TIMEOUT: Duration = Duration::from_secs(10);
/// Keeps idle tunnels alive through NATs and firewalls that drop quiet connections.
const KEEPALIVE_INTERVAL: Duration = Duration::from_secs(30);

#[derive(Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SshAuth {
    Password,
    Key,
}

#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SshConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub auth: SshAuth,
    pub password: String,
    pub private_key_path: String,
    pub passphrase: String,
}

/// Where the tunnel must lead to, as reachable from the bastion.
#[derive(Debug, PartialEq)]
pub struct TunnelTarget {
    pub host: String,
    pub port: u16,
}

pub fn validate(config: &SshConfig) -> Result<(), String> {
    if config.host.trim().is_empty() {
        return Err("Falta el host del servidor SSH".into());
    }
    if config.username.trim().is_empty() {
        return Err("Falta el usuario SSH".into());
    }
    if config.auth == SshAuth::Key && config.private_key_path.trim().is_empty() {
        return Err("Falta el archivo de clave privada SSH".into());
    }
    Ok(())
}

/// Accepts the server key on first use (and remembers it); refuses a key that changed.
struct HostKeyCheck {
    host: String,
    port: u16,
    known_hosts: PathBuf,
}

impl client::Handler for HostKeyCheck {
    type Error = russh::Error;

    async fn check_server_key(&mut self, key: &PublicKeyOrCertificate) -> Result<bool, Self::Error> {
        let key = key.public_key();
        match keys::check_known_hosts_path(&self.host, self.port, &key, &self.known_hosts) {
            Ok(true) => Ok(true),
            Ok(false) => {
                keys::known_hosts::learn_known_hosts_path(&self.host, self.port, &key, &self.known_hosts)?;
                Ok(true)
            }
            Err(keys::Error::KeyChanged { .. }) => Ok(false),
            Err(e) => Err(e.into()),
        }
    }
}

fn describe(e: russh::Error) -> String {
    match e {
        russh::Error::UnknownKey => {
            "La clave del servidor SSH ha cambiado desde la última conexión; si es legítimo, borra su línea en known_hosts de la carpeta de la app".into()
        }
        russh::Error::IO(e) => format!("No se pudo conectar con el servidor SSH: {e}"),
        e => format!("Error SSH: {e}"),
    }
}

pub struct SshTunnel {
    local_port: u16,
    session: Arc<Handle<HostKeyCheck>>,
    listener: JoinHandle<()>,
}

impl SshTunnel {
    /// Connects to the bastion, authenticates and starts listening on a free local port.
    pub async fn open(config: &SshConfig, target: TunnelTarget, known_hosts: PathBuf) -> Result<Self, String> {
        validate(config)?;
        let session = Arc::new(connect(config, known_hosts).await?);
        let listener = TcpListener::bind((LOCALHOST, 0))
            .await
            .map_err(|e| format!("No se pudo abrir el puerto local del túnel: {e}"))?;
        let local_port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let listener = tokio::spawn(accept_loop(listener, session.clone(), target));
        Ok(Self { local_port, session, listener })
    }

    pub fn local_port(&self) -> u16 {
        self.local_port
    }

    pub async fn close(mut self) {
        self.listener.abort();
        // Abort only requests cancellation; awaiting it guarantees the local port is released.
        let _ = (&mut self.listener).await;
        // Closing the session also ends every forwarded channel still open.
        let _ = self.session.disconnect(Disconnect::ByApplication, "", "es").await;
    }
}

impl Drop for SshTunnel {
    fn drop(&mut self) {
        self.listener.abort();
    }
}

async fn connect(config: &SshConfig, known_hosts: PathBuf) -> Result<Handle<HostKeyCheck>, String> {
    let host_key_check = HostKeyCheck {
        host: config.host.trim().to_string(),
        port: config.port,
        known_hosts,
    };
    let client_config = Arc::new(client::Config {
        keepalive_interval: Some(KEEPALIVE_INTERVAL),
        nodelay: true,
        ..Default::default()
    });
    let address = (config.host.trim(), config.port);
    let mut session = tokio::time::timeout(CONNECT_TIMEOUT, client::connect(client_config, address, host_key_check))
        .await
        .map_err(|_| "No se pudo conectar con el servidor SSH (tiempo de espera agotado)".to_string())?
        .map_err(describe)?;

    let user = config.username.trim();
    let auth = match config.auth {
        SshAuth::Password => session.authenticate_password(user, &config.password).await,
        SshAuth::Key => {
            let key = load_private_key(config)?;
            let hash = session.best_supported_rsa_hash().await.map_err(describe)?.flatten();
            session
                .authenticate_publickey(user, PrivateKeyWithHashAlg::new(Arc::new(key), hash))
                .await
        }
    }
    .map_err(describe)?;

    if auth.success() {
        Ok(session)
    } else {
        Err("Autenticación SSH fallida: revisa el usuario y la contraseña o la clave".into())
    }
}

fn load_private_key(config: &SshConfig) -> Result<keys::PrivateKey, String> {
    let passphrase = Some(config.passphrase.as_str()).filter(|p| !p.is_empty());
    keys::load_secret_key(config.private_key_path.trim(), passphrase).map_err(describe_key_error)
}

fn describe_key_error(e: keys::Error) -> String {
    match e {
        keys::Error::KeyIsEncrypted => "La clave privada SSH está cifrada: indica su passphrase".into(),
        // A wrong passphrase decrypts to garbage, which surfaces as a crypto error.
        keys::Error::SshKey(keys::ssh_key::Error::Crypto) => "La passphrase de la clave privada SSH no es correcta".into(),
        e => format!("No se pudo leer la clave privada SSH: {e}"),
    }
}

async fn accept_loop(listener: TcpListener, session: Arc<Handle<HostKeyCheck>>, target: TunnelTarget) {
    let target = Arc::new(target);
    while let Ok((socket, origin)) = listener.accept().await {
        let session = session.clone();
        let target = target.clone();
        // A failed channel only drops that socket; the driver reports it and retries.
        tokio::spawn(async move {
            let _ = forward(socket, origin, &session, &target).await;
        });
    }
}

async fn forward(
    mut socket: TcpStream,
    origin: SocketAddr,
    session: &Handle<HostKeyCheck>,
    target: &TunnelTarget,
) -> Result<(), russh::Error> {
    let channel = session
        .channel_open_direct_tcpip(
            target.host.clone(),
            target.port.into(),
            origin.ip().to_string(),
            origin.port().into(),
        )
        .await?;
    let mut stream = channel.into_stream();
    tokio::io::copy_bidirectional(&mut socket, &mut stream).await?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config(auth: SshAuth) -> SshConfig {
        SshConfig {
            host: "bastion".into(),
            port: 22,
            username: "deploy".into(),
            auth,
            password: String::new(),
            private_key_path: String::new(),
            passphrase: String::new(),
        }
    }

    #[test]
    fn validate_requires_host_user_and_key_file() {
        assert!(validate(&config(SshAuth::Password)).is_ok());
        assert!(validate(&SshConfig { host: " ".into(), ..config(SshAuth::Password) }).is_err());
        assert!(validate(&SshConfig { username: "".into(), ..config(SshAuth::Password) }).is_err());
        assert!(validate(&config(SshAuth::Key)).is_err());
        assert!(validate(&SshConfig { private_key_path: "id_ed25519".into(), ..config(SshAuth::Key) }).is_ok());
    }

    #[test]
    fn config_deserializes_from_the_frontend_shape() {
        let config: SshConfig = serde_json::from_value(serde_json::json!({
            "host": "bastion", "port": 2222, "username": "deploy", "auth": "key",
            "password": "", "privateKeyPath": "C:\\keys\\id", "passphrase": "x",
        }))
        .unwrap();
        assert_eq!(config.auth, SshAuth::Key);
        assert_eq!(config.private_key_path, "C:\\keys\\id");
    }

    #[tokio::test]
    async fn open_fails_cleanly_when_the_bastion_is_unreachable() {
        // Port 1 on localhost is closed: the error must be readable, not a panic or a hang.
        let config = SshConfig { host: LOCALHOST.into(), port: 1, password: "pw".into(), ..config(SshAuth::Password) };
        let target = TunnelTarget { host: "db".into(), port: 27017 };
        let known_hosts = std::env::temp_dir().join("robo3b-test-known_hosts");
        let error = SshTunnel::open(&config, target, known_hosts).await.err().unwrap();
        assert!(error.contains("SSH"), "{error}");
    }
}
