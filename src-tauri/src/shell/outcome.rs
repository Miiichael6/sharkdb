//! Resultado de ejecutar un script, tal como se entrega al frontend.

use mongodb::bson::Bson;
use serde::{Serialize, Serializer};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptErrorKind {
    /// Excepción lanzada por el script (incluye errores de sintaxis).
    Script,
    Timeout,
    Cancelled,
    OutOfMemory,
    /// El valor final no se pudo convertir a BSON.
    Conversion,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptError {
    pub kind: ScriptErrorKind,
    pub message: String,
    pub line: Option<u32>,
    pub column: Option<u32>,
}

impl ScriptError {
    pub fn new(kind: ScriptErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            line: None,
            column: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutcome {
    /// Líneas de `print`/`printjson`, en orden.
    pub output: Vec<String>,
    /// Valor de la última expresión (`None` si es `undefined`), en Extended JSON canónico.
    #[serde(serialize_with = "canonical_extjson")]
    pub value: Option<Bson>,
    pub error: Option<ScriptError>,
    pub elapsed_ms: u64,
}

fn canonical_extjson<S: Serializer>(
    value: &Option<Bson>,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    value
        .clone()
        .map(Bson::into_canonical_extjson)
        .serialize(serializer)
}
