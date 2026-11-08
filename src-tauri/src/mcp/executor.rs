//! Ejecuta una llamada ya traducida (`tools::ToolCall`) contra las sesiones abiertas, solo en las
//! conexiones expuestas y siempre a través del safe mode de cada una.

use serde::{Deserialize, Serialize};
use serde_json::{Value, json};

use super::reply;
use super::tools::ToolCall;
use crate::mongo::{Sessions, describe, session_with_safe_mode};

/// Una conexión abierta que el usuario deja usar al agente.
#[derive(Clone, Debug, Deserialize, Serialize, PartialEq)]
pub struct ExposedConnection {
    pub id: String,
    pub name: String,
}

/// La conexión expuesta que el agente nombra, por nombre (sin distinguir mayúsculas) o por id.
fn resolve<'a>(exposed: &'a [ExposedConnection], wanted: &str) -> Result<&'a ExposedConnection, String> {
    exposed
        .iter()
        .find(|c| c.id == wanted)
        .or_else(|| exposed.iter().find(|c| c.name.eq_ignore_ascii_case(wanted)))
        .ok_or_else(|| format!("La conexión «{wanted}» no está expuesta a Claude; usa list_connections para ver las disponibles"))
}

async fn list_connections(sessions: &Sessions, exposed: &[ExposedConnection]) -> Value {
    let mut listed = Vec::new();
    for conn in exposed {
        let safe_mode = session_with_safe_mode(sessions, &conn.id).await.map(|(_, safe)| safe.is_enabled()).ok();
        listed.push(json!({ "name": conn.name, "id": conn.id, "open": safe_mode.is_some(), "safeMode": safe_mode }));
    }
    Value::Array(listed)
}

/// El resultado de `call` como texto para el agente, o el motivo por el que no se pudo.
pub async fn run(sessions: &Sessions, exposed: &[ExposedConnection], call: ToolCall) -> Result<String, String> {
    let value = match call {
        ToolCall::ListConnections => list_connections(sessions, exposed).await,
        ToolCall::Command { connection, db, command, reply: shape } => {
            let conn = resolve(exposed, &connection)?;
            let (client, safe_mode) = session_with_safe_mode(sessions, &conn.id).await?;
            safe_mode.check_command(&command)?;
            let reply = client.database(&db).run_command(command, None).await.map_err(describe)?;
            reply::shape(shape, reply)
        }
    };
    Ok(reply::to_text(&value))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn exposed() -> Vec<ExposedConnection> {
        vec![
            ExposedConnection { id: "1".into(), name: "Local".into() },
            ExposedConnection { id: "2".into(), name: "QA".into() },
        ]
    }

    #[test]
    fn resolves_by_id_or_by_name_ignoring_case() {
        let list = exposed();
        assert_eq!(resolve(&list, "2").unwrap().name, "QA");
        assert_eq!(resolve(&list, "local").unwrap().id, "1");
        assert!(resolve(&list, "prod").unwrap_err().contains("no está expuesta"));
    }

    /// Lo que hace Claude por el servidor MCP, contra un MongoDB real: escribe en la conexión sin
    /// safe mode, lee en ambas y la escritura en la que tiene safe mode se rechaza sin enviarse.
    #[tokio::test]
    #[ignore = "necesita MongoDB en 127.0.0.1:27017"]
    async fn live_reads_and_writes_through_the_safe_mode_of_each_connection() {
        use super::super::tools::{names, parse_call};
        use crate::safe_mode::SAFE_MODE_ERROR;
        const URI: &str = "mongodb://127.0.0.1:27017";
        const DB: &str = "sharkdb_test_mcp";
        let sessions = Sessions::default();
        sessions.open_for_test("1", URI, false).await;
        sessions.open_for_test("2", URI, true).await;
        let exposed = exposed();
        let (client, _) = session_with_safe_mode(&sessions, "1").await.unwrap();
        client.database(DB).drop(None).await.unwrap();

        let call = |name: &'static str, connection: &'static str, extra: Value| {
            let mut args = json!({ "connection": connection, "database": DB, "collection": "orders" });
            args.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
            let (sessions, exposed) = (&sessions, &exposed);
            async move { run(sessions, exposed, parse_call(name, &args).unwrap()).await }
        };

        let inserted = call(names::INSERT, "Local", json!({ "documents": [{ "item": "café" }] })).await.unwrap();
        assert!(inserted.contains("\"inserted\": 1") || inserted.contains("\"n\": 1"), "{inserted}");
        let found = call(names::FIND, "QA", json!({ "filter": { "item": "café" } })).await.unwrap();
        assert!(found.contains("café"), "{found}");
        let listed = call(names::LIST_COLLECTIONS, "local", json!({})).await.unwrap();
        assert!(listed.contains("orders"), "{listed}");

        let rejected = call(names::INSERT, "QA", json!({ "documents": [{ "item": "té" }] })).await.unwrap_err();
        assert!(rejected.contains(SAFE_MODE_ERROR), "{rejected}");
        let count = call(names::COUNT, "Local", json!({})).await.unwrap();
        assert!(count.contains('1'), "{count}");
        client.database(DB).drop(None).await.unwrap();
    }
}
