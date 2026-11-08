//! Lo que el chat le cuenta a la pestaña Claude, como evento `claude://event`.

use serde::Serialize;
use serde_json::Value;
use tauri::{AppHandle, Emitter};

pub const CHAT_EVENT: &str = "claude://event";

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum ChatEvent {
    /// Claude arrancó y está listo, con este modelo.
    Ready { model: String },
    /// Un trozo del texto que Claude está escribiendo.
    TextDelta { text: String },
    /// Un bloque de texto ya completo: sustituye a los trozos recibidos desde el anterior.
    Text { text: String },
    /// Claude llama a una herramienta (`name` sin el prefijo `mcp__sharkdb__`).
    ToolUse { id: String, name: String, input: Value },
    ToolResult { id: String, is_error: bool, text: String },
    /// Terminó el turno; con `error` si fue un fallo (p. ej. token no válido).
    TurnEnd { error: Option<String>, cost_usd: Option<f64> },
    /// El usuario detuvo la respuesta.
    Stopped,
    /// El proceso de Claude terminó por su cuenta (con lo último que escribió en stderr).
    Exited { reason: String },
}

pub fn emit(app: &AppHandle, event: ChatEvent) {
    let _ = app.emit(CHAT_EVENT, event);
}
