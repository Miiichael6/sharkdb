//! Traduce cada línea stream-json de Claude Code a los eventos del chat. Lógica pura.

use serde_json::{Value, json};

use super::cli::MCP_SERVER_NAME;
use super::events::ChatEvent;

/// Lo que dice una línea: los eventos para la pestaña y la sesión a la que pertenece.
#[derive(Debug, Default, PartialEq)]
pub struct Parsed {
    pub session_id: Option<String>,
    pub events: Vec<ChatEvent>,
}

/// `mcp__sharkdb__find` → `find`; otras herramientas quedan como vienen.
fn tool_name(raw: &str) -> String {
    raw.strip_prefix(&format!("mcp__{MCP_SERVER_NAME}__")).unwrap_or(raw).to_string()
}

fn text_of(value: &Value) -> String {
    match value {
        Value::String(s) => s.clone(),
        Value::Array(parts) => parts.iter().filter_map(|p| p.get("text").and_then(Value::as_str)).collect::<Vec<_>>().join("\n"),
        _ => String::new(),
    }
}

fn str_field(value: &Value, key: &str) -> String {
    value.get(key).and_then(Value::as_str).unwrap_or_default().to_string()
}

fn content_blocks(line: &Value) -> impl Iterator<Item = &Value> {
    line.pointer("/message/content").and_then(Value::as_array).into_iter().flatten()
}

fn assistant_events(line: &Value) -> Vec<ChatEvent> {
    content_blocks(line)
        .filter_map(|block| match block.get("type").and_then(Value::as_str) {
            Some("text") => Some(ChatEvent::Text { text: str_field(block, "text") }),
            Some("tool_use") => Some(ChatEvent::ToolUse {
                id: str_field(block, "id"),
                name: tool_name(&str_field(block, "name")),
                input: block.get("input").cloned().unwrap_or(Value::Null),
            }),
            _ => None,
        })
        .collect()
}

fn tool_results(line: &Value) -> Vec<ChatEvent> {
    content_blocks(line)
        .filter(|block| block.get("type").and_then(Value::as_str) == Some("tool_result"))
        .map(|block| ChatEvent::ToolResult {
            id: str_field(block, "tool_use_id"),
            is_error: block.get("is_error").and_then(Value::as_bool).unwrap_or(false),
            text: block.get("content").map(text_of).unwrap_or_default(),
        })
        .collect()
}

fn text_delta(line: &Value) -> Option<ChatEvent> {
    let delta = line.pointer("/event/delta")?;
    (delta.get("type")?.as_str()? == "text_delta").then(|| ChatEvent::TextDelta { text: str_field(delta, "text") })
}

fn turn_end(line: &Value) -> ChatEvent {
    let failed = line.get("is_error").and_then(Value::as_bool).unwrap_or(false);
    let error = failed.then(|| {
        let text = str_field(line, "result");
        if text.is_empty() { str_field(line, "subtype") } else { text }
    });
    ChatEvent::TurnEnd { error, cost_usd: line.get("total_cost_usd").and_then(Value::as_f64) }
}

/// La línea stream-json con la que se le manda un mensaje del usuario.
pub fn user_message_line(text: &str) -> String {
    let message = json!({ "type": "user", "message": { "role": "user", "content": text } });
    format!("{message}\n")
}

/// Los eventos de una línea; las que no interesan (hooks, límites de uso…) no dan ninguno.
pub fn parse_line(line: &str) -> Parsed {
    let Ok(line) = serde_json::from_str::<Value>(line) else {
        return Parsed::default();
    };
    let events = match line.get("type").and_then(Value::as_str) {
        Some("system") if line.get("subtype").and_then(Value::as_str) == Some("init") => {
            vec![ChatEvent::Ready { model: str_field(&line, "model") }]
        }
        Some("stream_event") => text_delta(&line).into_iter().collect(),
        Some("assistant") => assistant_events(&line),
        Some("user") => tool_results(&line),
        Some("result") => vec![turn_end(&line)],
        _ => Vec::new(),
    };
    Parsed { session_id: line.get("session_id").and_then(Value::as_str).map(str::to_string), events }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn events(line: Value) -> Vec<ChatEvent> {
        parse_line(&line.to_string()).events
    }

    #[test]
    fn init_gives_the_model_and_the_session() {
        let parsed = parse_line(&json!({ "type": "system", "subtype": "init", "session_id": "s1", "model": "claude-opus-5-5" }).to_string());
        assert_eq!(parsed.session_id.as_deref(), Some("s1"));
        assert_eq!(parsed.events, [ChatEvent::Ready { model: "claude-opus-5-5".into() }]);
    }

    #[test]
    fn text_streams_in_deltas_and_ends_with_the_whole_block() {
        let delta = json!({ "type": "stream_event", "event": { "type": "content_block_delta", "delta": { "type": "text_delta", "text": "Ho" } } });
        assert_eq!(events(delta), [ChatEvent::TextDelta { text: "Ho".into() }]);
        let json_delta = json!({ "type": "stream_event", "event": { "type": "content_block_delta", "delta": { "type": "input_json_delta", "partial_json": "{" } } });
        assert!(events(json_delta).is_empty());
        let block = json!({ "type": "assistant", "message": { "content": [{ "type": "text", "text": "Hola" }] } });
        assert_eq!(events(block), [ChatEvent::Text { text: "Hola".into() }]);
    }

    #[test]
    fn tool_calls_and_results_keep_their_id() {
        let call = json!({ "type": "assistant", "message": { "content": [
            { "type": "tool_use", "id": "t1", "name": "mcp__sharkdb__find", "input": { "collection": "orders" } }
        ] } });
        assert_eq!(events(call), [ChatEvent::ToolUse { id: "t1".into(), name: "find".into(), input: json!({ "collection": "orders" }) }]);
        let result = json!({ "type": "user", "message": { "content": [
            { "type": "tool_result", "tool_use_id": "t1", "is_error": true, "content": [{ "type": "text", "text": "Safe mode activo" }] }
        ] } });
        assert_eq!(events(result), [ChatEvent::ToolResult { id: "t1".into(), is_error: true, text: "Safe mode activo".into() }]);
    }

    #[test]
    fn the_result_ends_the_turn_with_its_error_if_any() {
        let ok = json!({ "type": "result", "subtype": "success", "is_error": false, "result": "ok", "total_cost_usd": 0.02 });
        assert_eq!(events(ok), [ChatEvent::TurnEnd { error: None, cost_usd: Some(0.02) }]);
        let failed = json!({ "type": "result", "subtype": "success", "is_error": true, "result": "Invalid API key" });
        assert_eq!(events(failed), [ChatEvent::TurnEnd { error: Some("Invalid API key".into()), cost_usd: None }]);
    }

    #[test]
    fn a_user_message_is_one_json_line() {
        let line = user_message_line("hola\n\"mundo\"");
        assert!(line.ends_with('\n') && line.matches('\n').count() == 1);
        let value: Value = serde_json::from_str(&line).unwrap();
        assert_eq!(value["message"]["content"], "hola\n\"mundo\"");
    }

    #[test]
    fn noise_and_garbage_give_nothing() {
        assert!(events(json!({ "type": "rate_limit_event" })).is_empty());
        assert!(events(json!({ "type": "system", "subtype": "hook_started" })).is_empty());
        assert_eq!(parse_line("not json"), Parsed::default());
    }
}
