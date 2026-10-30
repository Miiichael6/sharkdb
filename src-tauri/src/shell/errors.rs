//! Traduce lo que lanza un script (un `Error` o cualquier valor de `throw`) a `ScriptError`.

use mongodb::bson::Bson;
use rquickjs::{Coerced, Ctx, FromJs, Value};

use super::convert::js_to_bson;
use super::outcome::{ScriptError, ScriptErrorKind};

/// Nombre de fichero con el que QuickJS cita las posiciones (`script:línea:columna`).
pub const SCRIPT_NAME: &str = "script";
const UNKNOWN_ERROR: &str = "Error desconocido";

/// Mensaje `Nombre: mensaje` y posición en el script del valor lanzado.
pub fn describe_thrown<'js>(
    ctx: &Ctx<'js>,
    thrown: Value<'js>,
    kind: ScriptErrorKind,
) -> ScriptError {
    let Some(exception) = thrown.as_exception() else {
        let text =
            Coerced::<String>::from_js(ctx, thrown).map_or_else(|_| UNKNOWN_ERROR.into(), |t| t.0);
        return ScriptError::new(kind, text);
    };
    let name: Option<String> = exception.get("name").ok();
    let message = exception.message().unwrap_or_default();
    let mut error = ScriptError::new(
        kind,
        match name {
            Some(name) if !name.is_empty() => format!("{name}: {message}"),
            _ => message,
        },
    );
    if let Some((line, column)) = exception.stack().as_deref().and_then(script_position) {
        error.line = Some(line);
        error.column = Some(column);
    }
    error
}

/// Convierte un valor del script a BSON; si no se puede, el error es de tipo `Conversion`.
pub fn to_bson_reported<'js>(ctx: &Ctx<'js>, value: &Value<'js>) -> Result<Bson, ScriptError> {
    js_to_bson(ctx, value)
        .map_err(|_| describe_thrown(ctx, ctx.catch(), ScriptErrorKind::Conversion))
}

/// Primera posición `script:línea:columna` de una traza de QuickJS.
fn script_position(stack: &str) -> Option<(u32, u32)> {
    let prefix = format!("{SCRIPT_NAME}:");
    let start = stack.find(&prefix)? + prefix.len();
    let mut parts = stack[start..].split(|c: char| !c.is_ascii_digit());
    let line = parts.next()?.parse().ok()?;
    let column = parts.next()?.parse().ok()?;
    Some((line, column))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn finds_first_script_position_in_stack() {
        assert_eq!(
            script_position("    at f (script:3:7)\n    at <eval> (script:5:1)\n"),
            Some((3, 7))
        );
        assert_eq!(script_position("    at <native>\n"), None);
    }
}
