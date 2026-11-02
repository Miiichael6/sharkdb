//! Lo que un trabajo (backup, restore, sync) cuenta mientras avanza y al terminar.

use serde::Serialize;

/// Avance dentro de la colección en curso. `done`/`total` miden documentos en el backup y el sync,
/// y bytes del `.bson` en el restore; el frontend solo calcula la proporción. El sync copia varias
/// colecciones a la vez y manda el avance agregado: `index` son las colecciones enteras que suman
/// todas y `done/total`, la fracción que sobra (`sync::copy::OverallProgress`).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Progress {
    pub collection: String,
    /// Posición de la colección (desde 0) y cuántas hay en total.
    pub index: usize,
    pub count: usize,
    pub done: u64,
    pub total: u64,
}

/// Resultado de una colección.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionResult {
    pub collection: String,
    pub documents: u64,
    /// Documentos que no se restauraron porque su `_id` ya existía en el destino.
    pub duplicates: u64,
    pub indexes: usize,
}
