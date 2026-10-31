//! Restore: recrea colecciones de una carpeta de backup (formato `mongodump`) en una base de datos.

use std::fs::File;
use std::io::BufReader;
use std::path::Path;

use mongodb::bson::{Bson, Document, RawDocumentBuf, doc};
use mongodb::error::{Error, ErrorKind};
use mongodb::options::InsertManyOptions;
use mongodb::results::InsertManyResult;
use mongodb::{Collection, Database};

use super::folder;
use super::format::{CollectionMetadata, DocumentReader};
use super::jobs::CancelFlag;
use super::report::{CollectionResult, Progress};
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

/// Un lote de `insert_many` se envía al llegar a cualquiera de los dos topes.
const BATCH_DOCUMENTS: usize = 1000;
const BATCH_BYTES: usize = 8 * 1024 * 1024;
const DUPLICATE_KEY: i32 = 11000;
const NAMESPACE_EXISTS: i32 = 48;

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

    let coll = target.db.collection::<RawDocumentBuf>(collection);
    if target.drop_before {
        coll.drop(None).await.map_err(describe)?;
    }
    create_collection(target.db, &metadata).await?;

    let mut reader = DocumentReader::new(BufReader::new(file));
    let mut counts = InsertCounts::default();
    let mut batch = Vec::new();
    let mut batch_bytes = 0;
    let mut read_bytes = 0;
    while let Some(document) = reader.next_document()? {
        batch_bytes += document.as_bytes().len();
        batch.push(document);
        if batch.len() >= BATCH_DOCUMENTS || batch_bytes >= BATCH_BYTES {
            read_bytes += batch_bytes as u64;
            insert_batch(target, &coll, &mut batch, &mut counts, cancel).await?;
            batch_bytes = 0;
            progress(read_bytes, total);
        }
    }
    insert_batch(target, &coll, &mut batch, &mut counts, cancel).await?;

    let indexes = metadata.restorable_indexes();
    create_indexes(target.db, collection, &indexes).await?;
    progress(total, total);
    Ok(CollectionResult {
        collection: collection.to_string(),
        documents: counts.inserted,
        duplicates: counts.duplicates,
        indexes: indexes.len(),
    })
}

#[derive(Default)]
struct InsertCounts {
    inserted: u64,
    duplicates: u64,
}

async fn insert_batch(
    target: &RestoreTarget<'_>,
    coll: &Collection<RawDocumentBuf>,
    batch: &mut Vec<RawDocumentBuf>,
    counts: &mut InsertCounts,
    cancel: &CancelFlag,
) -> Result<(), String> {
    if batch.is_empty() {
        return Ok(());
    }
    cancel.check()?;
    target.safe_mode.ensure_writable()?;
    // Sin orden: un `_id` repetido no corta el resto del lote, como en `mongorestore`.
    let options = InsertManyOptions::builder().ordered(false).build();
    let sent = batch.len() as u64;
    let duplicates = duplicates_of(coll.insert_many(batch.drain(..), options).await)?;
    counts.inserted += sent - duplicates;
    counts.duplicates += duplicates;
    Ok(())
}

/// Cuántos documentos del lote se saltaron por `_id` repetido; cualquier otro fallo es un error.
fn duplicates_of(result: Result<InsertManyResult, Error>) -> Result<u64, String> {
    let error = match result {
        Ok(_) => return Ok(0),
        Err(error) => error,
    };
    if let ErrorKind::BulkWrite(failure) = error.kind.as_ref()
        && failure.write_concern_error.is_none()
        && let Some(errors) = &failure.write_errors
        && errors.iter().all(|e| e.code == DUPLICATE_KEY)
    {
        return Ok(errors.len() as u64);
    }
    Err(describe(error))
}

/// Crea la colección con sus opciones (capped, validator, collation...); si ya existe se deja.
async fn create_collection(db: &Database, metadata: &CollectionMetadata) -> Result<(), String> {
    let mut command = doc! { "create": &metadata.collection };
    command.extend(metadata.options.clone());
    match db.run_command(command, None).await {
        Ok(_) => Ok(()),
        Err(e) if command_code(&e) == Some(NAMESPACE_EXISTS) => Ok(()),
        Err(e) => Err(describe(e)),
    }
}

async fn create_indexes(db: &Database, collection: &str, indexes: &[Document]) -> Result<(), String> {
    if indexes.is_empty() {
        return Ok(());
    }
    let indexes: Vec<Bson> = indexes.iter().cloned().map(Bson::Document).collect();
    db.run_command(doc! { "createIndexes": collection, "indexes": indexes }, None)
        .await
        .map(|_| ())
        .map_err(|e| format!("Índices de “{collection}”: {}", describe(e)))
}

fn command_code(error: &Error) -> Option<i32> {
    match error.kind.as_ref() {
        ErrorKind::Command(c) => Some(c.code),
        _ => None,
    }
}
