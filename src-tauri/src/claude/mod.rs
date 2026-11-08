//! Chat con Claude dentro de la app: lanza Claude Code (con el setup token del usuario) conectado
//! solo al servidor MCP de la app (`crate::mcp`).
//!
//! - `token`, `cli` y `stream`: lógica pura (validar el token, argumentos del proceso, traducir
//!   su salida stream-json).
//! - `session`: el proceso y su ciclo de vida; `events`: lo que se emite a la pestaña.

mod cli;
pub mod commands;
mod events;
mod session;
mod stream;
mod token;

pub use session::ClaudeChat;
