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

/// Resultados de sentencias que se muestran como mucho por ejecución; los demás se descartan
/// (y sus cursores se cierran) y el `ScriptOutcome` avisa con `truncated`.
pub const MAX_RESULTS: usize = 100;

/// Una salida del script. Los valores BSON viajan en Extended JSON canónico.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum ScriptOutput {
    /// Línea de `print`/`printjson`. Si `print` recibió algo que no es texto, `values` trae sus
    /// argumentos para que la consola los muestre como objetos y arrays desplegables.
    Print {
        text: String,
        #[serde(skip_serializing_if = "Vec::is_empty", serialize_with = "canonical_all")]
        values: Vec<Bson>,
        /// Salió de `printjson`: el texto es JSON del shell y se muestra como código.
        #[serde(skip_serializing_if = "std::ops::Not::not")]
        json: bool,
    },
    /// Valor de una expresión.
    Value {
        #[serde(serialize_with = "canonical")]
        value: Bson,
    },
    /// Resultado de una operación de escritura (`insertOne`, `updateMany`...).
    Write {
        #[serde(serialize_with = "canonical")]
        value: Bson,
    },
    /// Cursor que quedó como valor de una sentencia: su primer lote y, si no se agotó, el id para pedir más.
    #[serde(rename_all = "camelCase")]
    Cursor {
        ns: String,
        cursor_id: Option<CursorId>,
        #[serde(serialize_with = "canonical_all")]
        documents: Vec<Bson>,
        exhausted: bool,
    },
}

/// Una salida con la sentencia que la produjo.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptResult {
    /// Línea del script donde empieza la sentencia, desde 1.
    pub line: u32,
    /// Texto de la sentencia, recortado.
    pub source: String,
    /// Lo que tardó la sentencia, incluido su primer lote si devolvió un cursor.
    pub elapsed_ms: u64,
    #[serde(flatten)]
    pub output: ScriptOutput,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScriptOutcome {
    /// Salidas en orden de ejecución: lo impreso y el valor de cada sentencia que devolvió algo.
    pub results: Vec<ScriptResult>,
    pub error: Option<ScriptError>,
    /// Hubo más de `MAX_RESULTS` resultados y se descartaron los siguientes.
    pub truncated: bool,
    pub elapsed_ms: u64,
}

impl ScriptOutcome {
    /// Cursores que siguen abiertos porque el frontend los va a paginar.
    pub fn open_cursors(&self) -> Vec<CursorId> {
        self.results
            .iter()
            .filter_map(|result| match result.output {
                ScriptOutput::Cursor { cursor_id, .. } => cursor_id,
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
