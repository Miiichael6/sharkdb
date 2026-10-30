//! Evalúa el texto del editor de documentos como una expresión del shell, así se aceptan
//! `ObjectId(...)`, `ISODate(...)`, `NumberLong(...)`... igual que en un script. Usa un motor
//! propio sin API `db`: el texto solo construye un documento, nunca toca la base de datos.

use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use mongodb::bson::Bson;
use rquickjs::{Ctx, Value};
use serde::{Serialize, Serializer};

use super::engine::{Engine, EngineLimits};
use super::errors::to_bson_reported;
use super::module::RunHooks;
use super::outcome::{ScriptError, ScriptErrorKind, ScriptResult};
use super::watchdog::Watchdog;

const BYTES_PER_MB: usize = 1024 * 1024;
/// Un documento se construye en milisegundos: estos límites solo frenan un texto malicioso.
const EVAL_LIMITS: EngineLimits = EngineLimits {
    timeout: Duration::from_secs(5),
    memory_bytes: 64 * BYTES_PER_MB,
};
const NOT_A_DOCUMENT: &str = "El texto debe ser un documento: { … }";
/// Delante del texto, para que `{ … }` sea un objeto y no un bloque: `0, { … }` vale el objeto.
/// Va en la misma línea, así las líneas de los errores no cambian.
const EXPRESSION_PREFIX: &str = "0, ";

/// El documento evaluado (Extended JSON canónico) o el error, con su línea en el texto original.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentEval {
    #[serde(serialize_with = "canonical")]
    pub document: Option<Bson>,
    pub error: Option<ScriptError>,
}

pub fn evaluate(text: &str) -> DocumentEval {
    let watchdog = Watchdog::new(Arc::new(AtomicBool::new(false)));
    let mut engine = match Engine::new(EVAL_LIMITS, watchdog, Vec::new()) {
        Ok(engine) => engine,
        Err(e) => return failed(ScriptError::new(ScriptErrorKind::Script, e.to_string())),
    };
    let outcome = engine.run(&as_expression(text), &DocumentOnly);
    if let Some(error) = outcome.error {
        return failed(at_original_position(error));
    }
    let document = outcome.results.into_iter().find_map(|result| match result {
        ScriptResult::Value { value } => Some(value),
        _ => None,
    });
    match document {
        Some(document) => DocumentEval {
            document: Some(document),
            error: None,
        },
        None => failed(ScriptError::new(ScriptErrorKind::Script, NOT_A_DOCUMENT)),
    }
}

fn as_expression(text: &str) -> String {
    format!("{EXPRESSION_PREFIX}{text}")
}

fn at_original_position(mut error: ScriptError) -> ScriptError {
    if error.line == Some(1) {
        error.column = error
            .column
            .map(|c| c.saturating_sub(EXPRESSION_PREFIX.len() as u32).max(1));
    }
    error
}

fn failed(error: ScriptError) -> DocumentEval {
    DocumentEval {
        document: None,
        error: Some(error),
    }
}

/// Solo acepta un documento como valor final (ni arrays ni valores sueltos).
struct DocumentOnly;

impl RunHooks for DocumentOnly {
    fn before_run(&self, _: &Ctx<'_>) -> rquickjs::Result<()> {
        Ok(())
    }

    fn final_result<'js>(
        &self,
        ctx: &Ctx<'js>,
        value: Value<'js>,
    ) -> Result<Option<ScriptResult>, ScriptError> {
        match to_bson_reported(ctx, &value)? {
            value @ Bson::Document(_) => Ok(Some(ScriptResult::Value { value })),
            _ => Err(ScriptError::new(ScriptErrorKind::Script, NOT_A_DOCUMENT)),
        }
    }
}

fn canonical<S: Serializer>(value: &Option<Bson>, serializer: S) -> Result<S::Ok, S::Error> {
    value
        .clone()
        .map(Bson::into_canonical_extjson)
        .serialize(serializer)
}
