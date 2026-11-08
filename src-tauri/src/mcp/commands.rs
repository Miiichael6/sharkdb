use tauri::State;

use super::executor::ExposedConnection;
use super::server::McpServer;

/// Las conexiones abiertas que el usuario deja usar a Claude; se llama cada vez que cambian.
#[tauri::command]
pub fn mcp_set_exposed(server: State<'_, McpServer>, connections: Vec<ExposedConnection>) {
    server.set_exposed(connections);
}
