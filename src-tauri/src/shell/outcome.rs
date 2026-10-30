//! Resultado de ejecutar un script, tal como se entrega al frontend.

use mongodb::bson::Bson;
use serde::{Serialize, Serializer};

/// Identificador de un cursor abierto dentro de una sesión de shell.
pub type CursorId = u32;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ScriptErrorKind {
    /// Excepción lanzada por el script (incluye errores de sintaxis y del servidor).
    Script,
    Timeout,
    Cancelled,
    OutOfMemory,
    /// El valor final no se pudo convertir a BSON.
    Conversion,
    /// Safe mode frenó una escritura del script.
    ReadOnly,
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

/// Una salida del script. Los valores BSON viajan en Extended JSON canónico.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScriptResult {
    /// Línea de `print`/`printjson`.
    Print { text: String },
    /// Valor de la última expresión.
    Value {
        #[serde(serialize_with = "canonical")]
        value: Bson,
    },
    /// Resultado de una operación de escritura (`insertOne`, `updateMany`...).
    Write {
        #[serde(serialize_with = "canonical")]
        value: Bson,
    },
    /// Cursor que quedó como valor final: su primer lote y, si no se agotó, el id para pedir más.
    #[serde(rename_all = "camelCase")]
    Cursor {
        ns: String,
        cursor_id: Option<CursorId>,
        #[serde(serialize_with = "canonical_all")]
        documents: Vec<Bson>,
        exhausted: bool,
    },
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutcome {
    /// Salidas en orden: lo impreso y, al final, el valor del script.
    pub results: Vec<ScriptResult>,
    pub error: Option<ScriptError>,
    pub elapsed_ms: u64,
}

impl ScriptOutcome {
    /// Cursores que siguen abiertos porque el frontend los va a paginar.
    pub fn open_cursors(&self) -> Vec<CursorId> {
        self.results
            .iter()
            .filter_map(|result| match result {
                ScriptResult::Cursor { cursor_id, .. } => *cursor_id,
                _ => None,
            })
            .collect()
    }
}

/// Siguiente lote de un cursor paginado desde el frontend.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CursorBatch {
    #[serde(serialize_with = "canonical_all")]
    pub documents: Vec<Bson>,
    pub exhausted: bool,
}

fn canonical<S: Serializer>(value: &Bson, serializer: S) -> Result<S::Ok, S::Error> {
    value.clone().into_canonical_extjson().serialize(serializer)
}

fn canonical_all<S: Serializer>(values: &[Bson], serializer: S) -> Result<S::Ok, S::Error> {
    serializer.collect_seq(values.iter().map(|v| v.clone().into_canonical_extjson()))
}
