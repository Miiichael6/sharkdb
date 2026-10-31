//! Restore: recrea colecciones de una carpeta de backup (formato `mongodump`) en una base de datos.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use mongodb::Database;
use mongodb::bson::Document;

use super::folder;
use super::format::DocumentReader;
use super::writer::{self, BatchWriter};
use crate::jobs::CancelFlag;
use crate::jobs::report::{CollectionResult, Progress};
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

pub struct RestoreTarget<'a> {
    pub db: &'a Database,
    /// Se vuelve a mirar antes de cada lote: activar safe mode a mitad para el restore.
    pub safe_mode: &'a SafeMode,
    /// Eliminar cada colección antes de restaurarla (si no, los `_id` repetidos se saltan).
    pub drop_before: bool,
}

/// Restaura `collections` de la carpeta `dir` en `target`.
pub async fn restore(
    target: &RestoreTarget<'_>,
    collections: &[String],
    dir: &Path,
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let mut results = Vec::with_capacity(collections.len());
    for (index, collection) in collections.iter().enumerate() {
        cancel.check()?;
        target.safe_mode.ensure_writable()?;
        let progress = |done, total| {
            report(Progress {
                collection: collection.clone(),
                index,
                count: collections.len(),
                done,
                total,
            })
        };
        results.push(restore_collection(target, collection, dir, cancel, progress).await?);
    }
    Ok(results)
}

async fn restore_collection(
    target: &RestoreTarget<'_>,
    collection: &str,
    dir: &Path,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = folder::read_metadata(dir, collection)?;
    let data_path = folder::data_path(dir, collection)?;
    let file = File::open(&data_path).map_err(|e| format!("No se pudo leer {}: {e}", data_path.display()))?;
    let total = file.metadata().map(|m| m.len()).unwrap_or(0);
    progress(0, total);

    if target.drop_before {
        target.db.collection::<Document>(collection).drop(None).await.map_err(describe)?;
    }
    writer::create_collection(target.db, collection, &metadata.options).await?;

    let mut reader = DocumentReader::new(BufReader::new(file));
    let mut writer = BatchWriter::new(target.db, collection, target.safe_mode, cancel);
    while let Some(document) = reader.next_document()? {
        if writer.push(document).await? {
            progress(writer.sent_bytes(), total);
        }
    }
    writer.flush().await?;

    let indexes = metadata.restorable_indexes();
    writer::create_indexes(target.db, collection, &indexes).await?;
    progress(total, total);
    Ok(CollectionResult {
        collection: collection.to_string(),
        documents: writer.inserted(),
        duplicates: writer.duplicates(),
        indexes: indexes.len(),
    })
}
