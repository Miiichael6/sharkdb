//! Restore: reemplaza colecciones de una o varias BDs con las de una carpeta de backup (formato
//! `mongodump`). Como el sync, cada colección se escribe en una provisional y solo cuando todas
//! están llenas reemplazan a las originales (`staging`): un fallo o una cancelación mientras se
//! escriben dejan el destino como estaba.

use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

use mongodb::Database;

use super::folder;
use super::format::DocumentReader;
use super::staging::{Destination, Replacements, new_run, staging_name};
use super::writer::{self, BatchWriter};
use crate::jobs::CancelFlag;
use crate::jobs::report::{CollectionResult, Progress};
use crate::jobs::selection::{collection_label, each_collection};

/// Colecciones de la carpeta de una BD del backup que reemplazan a las de una BD del destino.
pub struct DatabaseRestore {
    pub dir: PathBuf,
    pub target: Database,
    pub collections: Vec<String>,
}

/// Restaura las colecciones de cada `restores` en el destino, en un solo trabajo: no se reemplaza
/// ninguna hasta que todas se escribieron.
pub async fn restore_databases(
    destination: &Destination<'_>,
    restores: &[DatabaseRestore],
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let mut replacements = Replacements::new(destination);
    let restored = restore_all(&mut replacements, destination, restores, cancel, report).await;
    replacements.finish(restored).await
}

async fn restore_all(
    replacements: &mut Replacements<'_>,
    destination: &Destination<'_>,
    restores: &[DatabaseRestore],
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let run = new_run();
    let collections = each_collection(restores, |r| &r.collections);
    let count = collections.len();
    let mut results = Vec::with_capacity(count);
    for (index, (restore, collection)) in collections.into_iter().enumerate() {
        cancel.check()?;
        destination.safe_mode.ensure_writable()?;
        let label = collection_label(restore.target.name(), collection);
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let staging = staging_name(collection, &run);
        let fill = restore_into(destination, &restore.dir, &restore.target, collection, &staging, cancel, progress);
        let result = replacements.stage(&restore.target, collection, &staging, fill).await?;
        results.push(CollectionResult { collection: label, ..result });
    }
    cancel.check()?;
    Ok(results)
}

/// Escribe documentos e índices de `collection` (de la carpeta `dir`) en `staging`. El progreso va en bytes del `.bson`.
async fn restore_into(
    destination: &Destination<'_>,
    dir: &Path,
    target: &Database,
    collection: &str,
    staging: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = folder::read_metadata(dir, collection)?;
    let data_path = folder::data_path(dir, collection)?;
    let file = File::open(&data_path).map_err(|e| format!("No se pudo leer {}: {e}", data_path.display()))?;
    let total = file.metadata().map(|m| m.len()).unwrap_or(0);
    progress(0, total);

    writer::create_collection(target, staging, &metadata.options).await?;
    let mut reader = DocumentReader::new(BufReader::new(file));
    let mut writer = BatchWriter::new(target, staging, destination.safe_mode, cancel);
    while let Some(document) = reader.next_document()? {
        if writer.push(document).await? {
            progress(writer.sent_bytes(), total);
        }
    }
    writer.flush().await?;

    let indexes = metadata.restorable_indexes();
    writer::create_indexes(target, staging, &indexes).await?;
    progress(total, total);
    Ok(CollectionResult {
        collection: collection.to_string(),
        documents: writer.inserted(),
        duplicates: writer.duplicates(),
        indexes: indexes.len(),
    })
}
