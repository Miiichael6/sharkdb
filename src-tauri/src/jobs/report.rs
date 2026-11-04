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

/// En qué punto está una colección (D23). Los estados "pendiente" y "descartada" no salen de aquí:
/// el frontend los deduce del plan y de cómo terminó el trabajo.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum CollectionState {
    Running,
    /// Escrita en su provisional; el destino aún no cambió (sync y restore la reemplazan al final).
    Copied,
    /// Ya está en el destino: reemplazada (sync, restore) o guardada en el archivo (backup).
    Applied,
    Failed,
}

/// Estado y avance de una colección; con varias copiándose a la vez, cada una manda el suyo (R94).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CollectionProgress {
    pub db: String,
    pub collection: String,
    pub state: CollectionState,
    pub done: u64,
    pub total: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// A quién cuenta un trabajo cómo va: el avance agregado (`job-progress`) y el de cada colección.
pub trait Report {
    fn progress(&self, progress: Progress);
    fn collection(&self, update: CollectionProgress);
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

/// `Report` que lo guarda todo, para las pruebas; puede reaccionar a cada avance (p. ej. cancelar).
#[cfg(test)]
pub mod testing {
    use std::sync::Mutex;

    use super::{CollectionProgress, Progress, Report};

    pub struct Recorder<F = fn(&Progress)> {
        pub progress: Mutex<Vec<Progress>>,
        pub collections: Mutex<Vec<CollectionProgress>>,
        on_progress: Option<F>,
    }

    impl Recorder {
        pub fn new() -> Self {
            Self { progress: Mutex::default(), collections: Mutex::default(), on_progress: None }
        }
    }

    impl<F: Fn(&Progress)> Recorder<F> {
        pub fn reacting(on_progress: F) -> Self {
            Self { progress: Mutex::default(), collections: Mutex::default(), on_progress: Some(on_progress) }
        }

        pub fn collections(&self) -> Vec<CollectionProgress> {
            self.collections.lock().unwrap().clone()
        }
    }

    impl<F: Fn(&Progress)> Report for Recorder<F> {
        fn progress(&self, progress: Progress) {
            if let Some(react) = &self.on_progress {
                react(&progress);
            }
            self.progress.lock().unwrap().push(progress);
        }

        fn collection(&self, update: CollectionProgress) {
            self.collections.lock().unwrap().push(update);
        }
    }
}
