//! Actividad MCP: un evento al empezar y otro al terminar cada llamada a una herramienta, para que
//! la pestaña Claude la muestre en vivo.

use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

use super::reply::truncate;

pub const ACTIVITY_EVENT: &str = "mcp://activity";
/// Lo que se guarda del resultado para el detalle del panel.
const MAX_PREVIEW_CHARS: usize = 8_000;

static NEXT_ID: AtomicU64 = AtomicU64::new(1);

#[derive(Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum Status {
    Running,
    Ok,
    Error,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Activity<'a> {
    id: u64,
    tool: &'a str,
    arguments: &'a Value,
    /// Milisegundos desde la época Unix.
    started_at: u64,
    status: Status,
    duration_ms: Option<u64>,
    result: Option<String>,
}

/// Una llamada en marcha: avisa al crearse y, con `finish`, al terminar.
pub struct CallActivity<'a> {
    app: &'a AppHandle,
    id: u64,
    tool: &'a str,
    arguments: &'a Value,
    started_at: u64,
    clock: Instant,
}

fn now_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

impl<'a> CallActivity<'a> {
    pub fn start(app: &'a AppHandle, tool: &'a str, arguments: &'a Value) -> Self {
        let call = Self { app, id: NEXT_ID.fetch_add(1, Ordering::Relaxed), tool, arguments, started_at: now_ms(), clock: Instant::now() };
        call.emit(Status::Running, None, None);
        call
    }

    pub fn finish(self, outcome: &Result<String, String>) {
        let (status, text) = match outcome {
            Ok(text) => (Status::Ok, text),
            Err(text) => (Status::Error, text),
        };
        let preview = truncate(text.clone(), MAX_PREVIEW_CHARS, "(cortado)");
        self.emit(status, Some(self.clock.elapsed().as_millis() as u64), Some(preview));
    }

    fn emit(&self, status: Status, duration_ms: Option<u64>, result: Option<String>) {
        let activity = Activity { id: self.id, tool: self.tool, arguments: self.arguments, started_at: self.started_at, status, duration_ms, result };
        let _ = self.app.emit(ACTIVITY_EVENT, activity);
    }
}
