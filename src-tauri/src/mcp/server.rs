//! El servidor MCP de esta ventana: se arranca la primera vez que hace falta (al abrir el chat con
//! Claude) en un puerto libre de `127.0.0.1` y vive lo que la app. Atiende cada mensaje JSON-RPC
//! con las herramientas de `tools`, solo sobre las conexiones expuestas.

use std::sync::{Arc, RwLock};

use serde_json::{Value, json};
use tauri::{AppHandle, Manager};
use tokio::net::TcpListener;
use tokio::sync::Mutex;

use super::activity::CallActivity;
use super::executor::{self, ExposedConnection};
use super::http;
use super::protocol::{self, Message, Method};
use super::tools;
use crate::mongo::Sessions;

const INSTRUCTIONS: &str = "Herramientas para consultar las bases de datos MongoDB abiertas en SharkDB. \
Empieza con list_connections. Filtros, documentos y pipelines van en JSON extendido de MongoDB. \
Las escrituras (insert, update, delete, $out, $merge) se rechazan en las conexiones con safe mode activo.";

/// Dónde escucha el servidor y el token que hay que mandar en `Authorization: Bearer`.
#[derive(Clone)]
pub struct Endpoint {
    pub url: String,
    pub token: String,
}

type Exposed = Arc<RwLock<Vec<ExposedConnection>>>;

#[derive(Default)]
pub struct McpServer {
    endpoint: Mutex<Option<Endpoint>>,
    exposed: Exposed,
}

impl McpServer {
    /// Dónde escucha, arrancándolo si todavía no lo está.
    pub async fn ensure_started(&self, app: &AppHandle) -> Result<Endpoint, String> {
        let mut endpoint = self.endpoint.lock().await;
        if let Some(running) = &*endpoint {
            return Ok(running.clone());
        }
        let listener = TcpListener::bind((http::HOST, 0)).await.map_err(|e| format!("No se pudo abrir el servidor MCP: {e}"))?;
        let port = listener.local_addr().map_err(|e| e.to_string())?.port();
        let token = uuid::Uuid::new_v4().simple().to_string();
        let (app, exposed) = (app.clone(), self.exposed.clone());
        tauri::async_runtime::spawn(http::serve(listener, token.clone(), move |body| {
            let (app, exposed) = (app.clone(), exposed.clone());
            async move { handle(&app, &exposed, &body).await }
        }));
        let running = Endpoint { url: format!("http://{}:{port}{}", http::HOST, http::PATH), token };
        *endpoint = Some(running.clone());
        Ok(running)
    }

    /// Las conexiones que el agente puede usar a partir de ahora.
    pub fn set_exposed(&self, connections: Vec<ExposedConnection>) {
        *self.exposed.write().unwrap_or_else(|e| e.into_inner()) = connections;
    }
}

async fn handle(app: &AppHandle, exposed: &Exposed, body: &[u8]) -> Option<Value> {
    let (id, method) = match protocol::parse(body) {
        Err(error) => return Some(error),
        Ok(Message::Notification) => return None,
        Ok(Message::Request { id, method }) => (id, method),
    };
    Some(match method {
        Method::Initialize { requested_version } => {
            let result = protocol::initialize_result(requested_version.as_deref(), env!("CARGO_PKG_VERSION"), INSTRUCTIONS);
            protocol::success(id, result)
        }
        Method::Ping => protocol::success(id, json!({})),
        Method::ToolsList => protocol::success(id, protocol::tools_list_result(tools::specs())),
        Method::ToolsCall { name, arguments } => protocol::success(id, call_tool(app, exposed, &name, &arguments).await),
        Method::Unknown(method) => protocol::method_not_found(id, &method),
    })
}

async fn call_tool(app: &AppHandle, exposed: &Exposed, name: &str, arguments: &Value) -> Value {
    let activity = CallActivity::start(app, name, arguments);
    let connections = exposed.read().unwrap_or_else(|e| e.into_inner()).clone();
    let outcome = match tools::parse_call(name, arguments) {
        Ok(call) => executor::run(&app.state::<Sessions>(), &connections, call).await,
        Err(e) => Err(e),
    };
    activity.finish(&outcome);
    match outcome {
        Ok(text) => protocol::tool_result(&text, false),
        Err(reason) => protocol::tool_result(&reason, true),
    }
}
