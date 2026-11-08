//! Servidor MCP (Model Context Protocol): deja que un agente de IA (el chat con Claude de la app)
//! consulte las conexiones abiertas que el usuario expone, siempre a través de su safe mode.
//!
//! - `tools`, `reply`, `schema` y `protocol`: lógica pura (qué herramientas hay, qué comando ejecuta
//!   cada una, qué se devuelve, cómo se habla JSON-RPC).
//! - `executor`: corre una llamada contra las sesiones abiertas.
//! - `http`: el transporte (HTTP local con token bearer); `server`: arranque y despacho.
//! - `activity`: los eventos `mcp://activity` que ve el panel.

mod activity;
pub mod commands;
mod executor;
mod http;
mod protocol;
mod reply;
mod schema;
mod server;
mod tools;

pub use server::McpServer;
