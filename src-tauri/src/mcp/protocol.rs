//! Mensajes JSON-RPC del protocolo MCP: leer una petición y escribir sus respuestas. Lógica pura;
//! quién ejecuta las herramientas lo decide `server`.

use serde_json::{Value, json};

/// Versiones del protocolo que entiende el servidor, la más nueva primero. Solo usa herramientas,
/// que no cambian entre ellas.
const SUPPORTED_VERSIONS: &[&str] = &["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
pub const SERVER_NAME: &str = "sharkdb";

const PARSE_ERROR: i64 = -32700;
const INVALID_REQUEST: i64 = -32600;
const METHOD_NOT_FOUND: i64 = -32601;

#[derive(Debug, PartialEq)]
pub enum Method {
    Initialize { requested_version: Option<String> },
    Ping,
    ToolsList,
    ToolsCall { name: String, arguments: Value },
    Unknown(String),
}

#[derive(Debug, PartialEq)]
pub enum Message {
    /// Espera respuesta con este `id`.
    Request { id: Value, method: Method },
    /// Aviso del cliente (`notifications/initialized`…): no se responde.
    Notification,
}

/// Lee un mensaje del cliente; si no es válido, devuelve la respuesta de error que le toca.
pub fn parse(body: &[u8]) -> Result<Message, Value> {
    let value: Value = serde_json::from_slice(body).map_err(|e| error(Value::Null, PARSE_ERROR, &e.to_string()))?;
    let invalid = || error(value.get("id").cloned().unwrap_or(Value::Null), INVALID_REQUEST, "Petición JSON-RPC no válida");
    let method = value.get("method").and_then(Value::as_str).ok_or_else(invalid)?;
    let Some(id) = value.get("id").cloned() else {
        return Ok(Message::Notification);
    };
    let params = value.get("params").cloned().unwrap_or(Value::Null);
    let method = match method {
        "initialize" => Method::Initialize {
            requested_version: params.get("protocolVersion").and_then(Value::as_str).map(str::to_string),
        },
        "ping" => Method::Ping,
        "tools/list" => Method::ToolsList,
        "tools/call" => Method::ToolsCall {
            name: params.get("name").and_then(Value::as_str).ok_or_else(invalid)?.to_string(),
            arguments: params.get("arguments").cloned().unwrap_or(Value::Null),
        },
        other => Method::Unknown(other.to_string()),
    };
    Ok(Message::Request { id, method })
}

/// La versión que pidió el cliente si se entiende; si no, la más nueva del servidor.
fn negotiated_version(requested: Option<&str>) -> &'static str {
    requested
        .and_then(|r| SUPPORTED_VERSIONS.iter().find(|v| **v == r))
        .copied()
        .unwrap_or(SUPPORTED_VERSIONS[0])
}

pub fn initialize_result(requested: Option<&str>, version: &str, instructions: &str) -> Value {
    json!({
        "protocolVersion": negotiated_version(requested),
        "capabilities": { "tools": { "listChanged": false } },
        "serverInfo": { "name": SERVER_NAME, "version": version },
        "instructions": instructions,
    })
}

pub fn tools_list_result(tools: Vec<Value>) -> Value {
    json!({ "tools": tools })
}

/// Resultado de una herramienta. Los fallos de la herramienta (safe mode, error de MongoDB) van
/// con `isError` para que el agente los lea, no como error de protocolo.
pub fn tool_result(text: &str, is_error: bool) -> Value {
    json!({ "content": [{ "type": "text", "text": text }], "isError": is_error })
}

pub fn success(id: Value, result: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "result": result })
}

pub fn error(id: Value, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}

pub fn method_not_found(id: Value, method: &str) -> Value {
    error(id, METHOD_NOT_FOUND, &format!("Método no soportado: {method}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(body: Value) -> (Value, Method) {
        match parse(body.to_string().as_bytes()).unwrap() {
            Message::Request { id, method } => (id, method),
            other => panic!("{other:?}"),
        }
    }

    #[test]
    fn reads_requests_and_notifications() {
        let (id, method) = request(json!({ "jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": { "name": "find", "arguments": { "a": 1 } } }));
        assert_eq!(id, json!(3));
        assert_eq!(method, Method::ToolsCall { name: "find".into(), arguments: json!({ "a": 1 }) });
        let note = json!({ "jsonrpc": "2.0", "method": "notifications/initialized" });
        assert_eq!(parse(note.to_string().as_bytes()).unwrap(), Message::Notification);
        assert_eq!(request(json!({ "id": "x", "method": "resources/list" })).1, Method::Unknown("resources/list".into()));
    }

    #[test]
    fn malformed_messages_get_their_json_rpc_error() {
        assert_eq!(parse(b"{nope").unwrap_err()["error"]["code"], PARSE_ERROR);
        assert_eq!(parse(br#"{"id":1}"#).unwrap_err()["error"]["code"], INVALID_REQUEST);
        assert_eq!(parse(br#"{"id":1,"method":"tools/call","params":{}}"#).unwrap_err()["id"], 1);
    }

    #[test]
    fn negotiates_the_requested_version_when_supported() {
        assert_eq!(initialize_result(Some("2025-03-26"), "0.1", "")["protocolVersion"], "2025-03-26");
        assert_eq!(initialize_result(Some("1999-01-01"), "0.1", "")["protocolVersion"], SUPPORTED_VERSIONS[0]);
        assert_eq!(initialize_result(None, "0.1", "")["serverInfo"]["name"], SERVER_NAME);
    }

    #[test]
    fn tool_failures_are_results_flagged_as_errors() {
        let result = tool_result("Safe mode activo", true);
        assert_eq!(result["isError"], true);
        assert_eq!(result["content"][0]["text"], "Safe mode activo");
    }
}
