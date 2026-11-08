//! La conversación con Claude de esta ventana: un proceso de Claude Code que recibe los mensajes
//! por stdin y cuenta lo que hace por stdout. Detenerlo mata el proceso; el siguiente mensaje lo
//! relanza con `--resume`, así la conversación sigue donde estaba.

use std::collections::VecDeque;
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex as StdMutex};

use tauri::{AppHandle, Manager};
use tokio::io::{AsyncBufReadExt, AsyncRead, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::Mutex;

use super::events::{self, ChatEvent};
use super::{cli, stream, token};
use crate::mcp::McpServer;
use crate::secrets::KeyringVault;
use crate::store;

/// Últimas líneas de stderr que se guardan para explicar un cierre inesperado.
const STDERR_TAIL_LINES: usize = 12;
const NO_TOKEN: &str = "Falta el setup token de Claude: pégalo en la configuración de la pestaña";
const CLOSED_WITHOUT_REASON: &str = "Claude Code se cerró sin dar motivo";
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

struct Running {
    child: Child,
    stdin: ChildStdin,
}

type Shared<T> = Arc<StdMutex<T>>;

fn lock<T>(shared: &StdMutex<T>) -> std::sync::MutexGuard<'_, T> {
    shared.lock().unwrap_or_else(|e| e.into_inner())
}

#[derive(Default)]
pub struct ClaudeChat {
    process: Mutex<Option<Running>>,
    /// La conversación que continúa el próximo proceso.
    session_id: Shared<Option<String>>,
    /// Sube con cada proceso nuevo o detenido: un proceso viejo ya no habla.
    generation: Arc<AtomicU64>,
}

impl ClaudeChat {
    /// Manda `text` a Claude, arrancándolo si no está en marcha.
    pub async fn send(&self, app: &AppHandle, text: &str) -> Result<(), String> {
        let mut process = self.process.lock().await;
        let alive = process.as_mut().is_some_and(|running| matches!(running.child.try_wait(), Ok(None)));
        if !alive {
            *process = Some(self.spawn(app).await?);
        }
        let stdin = &mut process.as_mut().expect("just started").stdin;
        let line = stream::user_message_line(text);
        let written = async {
            stdin.write_all(line.as_bytes()).await?;
            stdin.flush().await
        };
        written.await.map_err(|e| format!("No se pudo hablar con Claude Code: {e}"))
    }

    /// Corta la respuesta en curso; la conversación se conserva.
    pub async fn stop(&self, app: &AppHandle) {
        if self.kill().await {
            events::emit(app, ChatEvent::Stopped);
        }
    }

    /// Empieza una conversación nueva.
    pub async fn reset(&self) {
        self.kill().await;
        *lock(&self.session_id) = None;
    }

    async fn kill(&self) -> bool {
        let Some(mut running) = self.process.lock().await.take() else { return false };
        self.generation.fetch_add(1, Ordering::SeqCst);
        let _ = running.child.kill().await;
        true
    }

    async fn spawn(&self, app: &AppHandle) -> Result<Running, String> {
        let oauth_token = token::load(&KeyringVault)?.ok_or(NO_TOKEN)?;
        let endpoint = app.state::<McpServer>().ensure_started(app).await?;
        let dir = cli::working_dir(&store::config_dir(app)?);
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let resume = lock(&self.session_id).clone();

        let mut command = Command::new(cli::find_executable()?);
        command
            .args(cli::args(&endpoint.url, resume.as_deref()))
            .current_dir(dir)
            .env(cli::OAUTH_TOKEN_ENV, oauth_token)
            .env(cli::MCP_TOKEN_ENV, &endpoint.token)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true);
        for name in cli::OVERRIDING_ENV {
            command.env_remove(name);
        }
        #[cfg(windows)]
        command.creation_flags(CREATE_NO_WINDOW);
        let mut child = command.spawn().map_err(|e| format!("No se pudo iniciar Claude Code: {e}"))?;

        let generation = self.generation.fetch_add(1, Ordering::SeqCst) + 1;
        let stderr_tail: Shared<VecDeque<String>> = Arc::default();
        let (stdin, stdout, stderr) = (child.stdin.take(), child.stdout.take(), child.stderr.take());
        let (Some(stdin), Some(stdout), Some(stderr)) = (stdin, stdout, stderr) else {
            return Err("No se pudo conectar con Claude Code".into());
        };
        tauri::async_runtime::spawn(collect_stderr(stderr, stderr_tail.clone()));
        let reader = Reader {
            app: app.clone(),
            generation,
            current: self.generation.clone(),
            session_id: self.session_id.clone(),
            stderr_tail,
        };
        tauri::async_runtime::spawn(reader.run(stdout));
        Ok(Running { child, stdin })
    }
}

async fn collect_stderr(stderr: impl AsyncRead + Unpin, tail: Shared<VecDeque<String>>) {
    let mut lines = BufReader::new(stderr).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        let mut tail = lock(&tail);
        if tail.len() == STDERR_TAIL_LINES {
            tail.pop_front();
        }
        tail.push_back(line);
    }
}

/// Lee lo que cuenta un proceso y lo pasa a la pestaña mientras sea el proceso actual.
struct Reader {
    app: AppHandle,
    generation: u64,
    current: Arc<AtomicU64>,
    session_id: Shared<Option<String>>,
    stderr_tail: Shared<VecDeque<String>>,
}

impl Reader {
    fn is_current(&self) -> bool {
        self.current.load(Ordering::SeqCst) == self.generation
    }

    async fn run(self, stdout: impl AsyncRead + Unpin) {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if !self.is_current() {
                return;
            }
            let parsed = stream::parse_line(&line);
            if let Some(id) = parsed.session_id {
                *lock(&self.session_id) = Some(id);
            }
            for event in parsed.events {
                events::emit(&self.app, event);
            }
        }
        if self.is_current() {
            let tail = lock(&self.stderr_tail).iter().cloned().collect::<Vec<_>>().join("\n");
            let reason = if tail.trim().is_empty() { CLOSED_WITHOUT_REASON.to_string() } else { tail };
            events::emit(&self.app, ChatEvent::Exited { reason });
        }
    }
}
