//! Sync: reemplaza colecciones de una o varias BDs del destino con las del origen, leyendo por cursor y escribiendo
//! por lotes (el `writer` del restore de 14), sin pasar por disco.
//!
//! Cada colección se copia en una provisional del destino que solo al final reemplaza a la original
//! (`backup::staging`): un fallo o una cancelación dejan el destino como estaba. Varias colecciones
//! se copian a la vez; los reemplazos siguen siendo todos al final.

use std::sync::Mutex;

use futures::{StreamExt, stream};
use mongodb::Database;
use mongodb::bson::RawDocumentBuf;
use mongodb::options::FindOptions;

use super::target::ensure_distinct_collections;
use crate::backup::source::{collection_uuid, read_metadata};
use crate::backup::staging::{Destination, Replacements, new_run, staging_name};
use crate::backup::writer::{self, BatchWriter};
use crate::jobs::{CANCELLED, CancelFlag};
use crate::jobs::report::{CollectionResult, Progress};
use crate::jobs::selection::{collection_label, each_collection};
use crate::mongo::describe;

const FIND_BATCH_SIZE: u32 = 1000;
/// Colecciones que se copian a la vez: con origen y destino en servidores distintos, buena parte
/// del tiempo se va en esperar a la red. Más castigaría al origen, que suele ser producción.
const PARALLEL_COLLECTIONS: usize = 3;
/// Resolución del avance agregado (`OverallProgress`): la UI solo usa la proporción.
const PROGRESS_SCALE: u64 = 1000;

/// Colecciones de una BD del origen (solo se lee) que reemplazan a las de una BD del destino.
pub struct DatabaseCopy {
    pub source: Database,
    pub target: Database,
    pub collections: Vec<String>,
}

/// Reemplaza las colecciones de cada `copies` en el destino, en un solo trabajo: se copian varias a
/// la vez (`PARALLEL_COLLECTIONS`) y no se reemplaza ninguna hasta que todas se copiaron.
pub async fn sync(
    destination: &Destination<'_>,
    copies: &[DatabaseCopy],
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let mut replacements = Replacements::new(destination);
    let copied = copy_all(&mut replacements, destination, copies, cancel, report).await;
    replacements.finish(copied).await
}

async fn copy_all(
    replacements: &mut Replacements<'_>,
    destination: &Destination<'_>,
    copies: &[DatabaseCopy],
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let run = new_run();
    // Reunidas antes del bucle: un iterador de closures vivo entre `await`s no es `Send`.
    let collections = each_collection(copies, |c| &c.collections);
    let count = collections.len();
    // Apuntadas antes de empezar: se llenan a la vez y `finish` tiene que conocerlas todas.
    let pending: Vec<_> = collections
        .into_iter()
        .enumerate()
        .map(|(index, (copy, collection))| {
            let staging = staging_name(collection, &run);
            replacements.reserve(&copy.target, collection, &staging);
            (index, copy, collection, staging)
        })
        .collect();
    let overall = OverallProgress::new(count);
    let (overall, report) = (&overall, &report);
    // Los futuros se arman fuera del `stream` (son perezosos): un closure que los cree dentro del
    // `map` del stream no prueba ser `Send` para cualquier lifetime y el comando Tauri no compila.
    let copying: Vec<_> = pending
        .iter()
        .map(|(index, copy, collection, staging)| async move {
            let label = collection_label(copy.target.name(), collection);
            let progress = |done, total| report(overall.update(*index, &label, done, total));
            let result = sync_collection(destination, copy, collection, staging, cancel, progress).await;
            // Un fallo para a las demás; se las espera (no se sueltan a medio lote) para que
            // ningún insert en vuelo llegue después de que `finish` borre las provisionales.
            if matches!(&result, Err(e) if e != CANCELLED) {
                cancel.cancel();
            }
            (*index, result.map(|r| CollectionResult { collection: label, ..r }))
        })
        .collect();
    let mut outcomes: Vec<(usize, Result<CollectionResult, String>)> =
        stream::iter(copying).buffer_unordered(PARALLEL_COLLECTIONS).collect().await;
    outcomes.sort_by_key(|(index, _)| *index);
    let results = first_error(outcomes.into_iter().map(|(_, outcome)| outcome))?;
    // Cancelar cuando ya terminó la última copia también deja el destino como estaba.
    cancel.check()?;
    Ok(results)
}

/// Los resultados en orden, o el error que hizo fallar el trabajo: el `CANCELLED` de las demás
/// copias, paradas por ese error, solo cuenta si no hubo otro.
fn first_error(outcomes: impl Iterator<Item = Result<CollectionResult, String>>) -> Result<Vec<CollectionResult>, String> {
    let mut results = Vec::new();
    let mut cancelled = false;
    for outcome in outcomes {
        match outcome {
            Ok(result) => results.push(result),
            Err(e) if e == CANCELLED => cancelled = true,
            Err(e) => return Err(e),
        }
    }
    if cancelled { Err(CANCELLED.into()) } else { Ok(results) }
}

async fn sync_collection(
    destination: &Destination<'_>,
    copy: &DatabaseCopy,
    collection: &str,
    staging: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    cancel.check()?;
    destination.safe_mode.ensure_writable()?;
    let target = &copy.target;
    ensure_distinct_collections(
        collection_uuid(&copy.source, collection).await?.as_ref(),
        collection_uuid(target, collection).await?.as_ref(),
    )?;
    copy_into(destination, &copy.source, target, collection, staging, cancel, progress).await
}

/// Avance del trabajo entero con varias colecciones copiándose a la vez, en la forma de `Progress`
/// que entiende la UI (colecciones enteras + proporción de la siguiente): `index` es la parte
/// entera de lo que suman todas y `done/total`, lo que sobra. Así no retrocede al alternar avisos
/// de colecciones distintas.
struct OverallProgress {
    fractions: Mutex<Vec<f64>>,
}

impl OverallProgress {
    fn new(count: usize) -> Self {
        Self { fractions: Mutex::new(vec![0.0; count]) }
    }

    fn update(&self, index: usize, label: &str, done: u64, total: u64) -> Progress {
        let mut fractions = self.fractions.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        fractions[index] = if total == 0 { 1.0 } else { (done as f64 / total as f64).min(1.0) };
        let count = fractions.len();
        let sum: f64 = fractions.iter().sum();
        let whole = (sum.floor() as usize).min(count.saturating_sub(1));
        let rest = (sum - whole as f64).clamp(0.0, 1.0);
        Progress {
            collection: label.to_string(),
            index: whole,
            count,
            done: (rest * PROGRESS_SCALE as f64).round() as u64,
            total: PROGRESS_SCALE,
        }
    }
}

/// Copia documentos e índices de `collection` del origen a `staging` en el destino.
async fn copy_into(
    destination: &Destination<'_>,
    source: &Database,
    target: &Database,
    collection: &str,
    staging: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = read_metadata(source, collection).await?;
    let source = source.collection::<RawDocumentBuf>(collection);
    let total = source.estimated_document_count(None).await.map_err(describe)?;
    progress(0, total);

    writer::create_collection(target, staging, &metadata.options).await?;
    let mut writer = BatchWriter::new(target, staging, destination.safe_mode, cancel);
    let options = FindOptions::builder().batch_size(FIND_BATCH_SIZE).build();
    let mut cursor = source.find(None, options).await.map_err(describe)?;
    while cursor.advance().await.map_err(describe)? {
        let document = cursor.current().to_raw_document_buf();
        if writer.push(document).await? {
            progress(writer.sent_documents(), total.max(writer.sent_documents()));
        }
    }
    writer.flush().await?;
    // Si otra copia falló mientras se escribía el último lote, no se construyen los índices de algo que se va a borrar.
    cancel.check()?;

    let indexes = metadata.restorable_indexes();
    writer::create_indexes(target, staging, &indexes).await?;
    progress(writer.sent_documents(), writer.sent_documents());
    Ok(CollectionResult {
        collection: collection.to_string(),
        documents: writer.inserted(),
        duplicates: writer.duplicates(),
        indexes: indexes.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn percent(p: &Progress) -> f64 {
        (p.index as f64 + p.done as f64 / p.total as f64) / p.count as f64 * 100.0
    }

    #[test]
    fn overall_progress_adds_the_collections_copying_at_once() {
        let overall = OverallProgress::new(4);
        assert_eq!(percent(&overall.update(0, "a.x", 50, 100)), 12.5);
        let p = overall.update(1, "a.y", 3, 4);
        assert_eq!((p.collection.as_str(), p.index, p.done), ("a.y", 1, 250));
        // Un aviso con menos avance de otra colección no hace retroceder el total.
        assert_eq!(percent(&overall.update(2, "b.z", 0, 10)), 31.25);
        // Vacía: cuenta como copiada.
        assert_eq!(percent(&overall.update(3, "b.w", 0, 0)), 56.25);
        for index in 0..3 {
            overall.update(index, "", 7, 7);
        }
        let done = overall.update(3, "b.w", 0, 0);
        assert_eq!((done.index, done.done, done.total), (3, PROGRESS_SCALE, PROGRESS_SCALE));
    }

    fn result(collection: &str) -> CollectionResult {
        CollectionResult { collection: collection.into(), documents: 1, duplicates: 0, indexes: 1 }
    }

    #[test]
    fn the_error_that_stopped_the_others_wins_over_their_cancellation() {
        let all_ok = [Ok(result("a")), Ok(result("b"))];
        assert_eq!(first_error(all_ok.into_iter()), Ok(vec![result("a"), result("b")]));
        let failed = [Err(CANCELLED.to_string()), Ok(result("b")), Err("boom".to_string())];
        assert_eq!(first_error(failed.into_iter()), Err("boom".into()));
        let cancelled = [Ok(result("a")), Err(CANCELLED.to_string())];
        assert_eq!(first_error(cancelled.into_iter()), Err(CANCELLED.into()));
    }
}
