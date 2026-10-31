//! Backup: vuelca colecciones de una base de datos a una carpeta con el formato de `mongodump`.

use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use mongodb::Database;
use mongodb::bson::{Document, RawDocumentBuf, doc};
use mongodb::options::FindOptions;

use super::folder;
use super::format::{self, CollectionMetadata};
use super::jobs::CancelFlag;
use super::report::{CollectionResult, Progress};
use crate::mongo::describe;

/// Cada cuántos documentos se avisa del progreso.
const PROGRESS_EVERY: u64 = 1000;
const FIND_BATCH_SIZE: u32 = 1000;
/// Los datos se escriben aquí y se renombran al acabar: un backup cortado no deja un `.bson` a medias.
const PARTIAL_SUFFIX: &str = ".partial";
const COLLECTION_TYPE: &str = "collection";

/// Vuelca `collections` de `db` en `dir` (que se crea si no existe).
pub async fn dump(
    db: &Database,
    collections: &[String],
    dir: &Path,
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    let mut results = Vec::with_capacity(collections.len());
    for (index, collection) in collections.iter().enumerate() {
        cancel.check()?;
        let progress = |done, total| {
            report(Progress {
                collection: collection.clone(),
                index,
                count: collections.len(),
                done,
                total,
            })
        };
        results.push(dump_collection(db, collection, dir, cancel, progress).await?);
    }
    Ok(results)
}

async fn dump_collection(
    db: &Database,
    collection: &str,
    dir: &Path,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = read_metadata(db, collection).await?;
    let metadata_path = folder::metadata_path(dir, collection)?;
    fs::write(&metadata_path, metadata.to_json()?).map_err(|e| write_error(&metadata_path, e))?;

    let coll = db.collection::<RawDocumentBuf>(collection);
    let total = coll.estimated_document_count(None).await.map_err(describe)?;
    progress(0, total);

    let data_path = folder::data_path(dir, collection)?;
    let partial = partial_path(&data_path);
    let result = write_documents(&coll, &partial, cancel, |done| progress(done, total.max(done))).await;
    let documents = match result {
        Ok(documents) => documents,
        Err(e) => {
            let _ = fs::remove_file(&partial);
            return Err(e);
        }
    };
    fs::rename(&partial, &data_path).map_err(|e| write_error(&data_path, e))?;
    progress(documents, documents);
    Ok(CollectionResult {
        collection: collection.to_string(),
        documents,
        duplicates: 0,
        indexes: metadata.indexes.len(),
    })
}

async fn write_documents(
    coll: &mongodb::Collection<RawDocumentBuf>,
    path: &Path,
    cancel: &CancelFlag,
    progress: impl Fn(u64),
) -> Result<u64, String> {
    let file = File::create(path).map_err(|e| write_error(path, e))?;
    let mut out = BufWriter::new(file);
    let options = FindOptions::builder().batch_size(FIND_BATCH_SIZE).build();
    let mut cursor = coll.find(None, options).await.map_err(describe)?;
    let mut documents = 0;
    while cursor.advance().await.map_err(describe)? {
        format::write_document(&mut out, cursor.current().as_bytes()).map_err(|e| write_error(path, e))?;
        documents += 1;
        if documents % PROGRESS_EVERY == 0 {
            cancel.check()?;
            progress(documents);
        }
    }
    out.flush().map_err(|e| write_error(path, e))?;
    Ok(documents)
}

/// Opciones (de `listCollections`) e índices (de `listIndexes`) de una colección.
async fn read_metadata(db: &Database, collection: &str) -> Result<CollectionMetadata, String> {
    let listed = first_batch(db, doc! { "listCollections": 1, "filter": { "name": collection } }).await?;
    let info = listed
        .into_iter()
        .next()
        .ok_or_else(|| format!("La colección “{collection}” no existe"))?;
    if info.get_str("type").unwrap_or(COLLECTION_TYPE) != COLLECTION_TYPE {
        return Err(format!("“{collection}” no es una colección (las vistas no se copian)"));
    }
    let indexes = first_batch(db, doc! { "listIndexes": collection }).await?;
    Ok(CollectionMetadata {
        collection: collection.to_string(),
        options: info.get_document("options").cloned().unwrap_or_default(),
        indexes,
    })
}

/// Documentos del primer lote de un comando con cursor; los dos que se usan caben en uno.
async fn first_batch(db: &Database, command: Document) -> Result<Vec<Document>, String> {
    let reply = db.run_command(command, None).await.map_err(describe)?;
    let batch = reply
        .get_document("cursor")
        .and_then(|c| c.get_array("firstBatch"))
        .map_err(|e| e.to_string())?;
    Ok(batch.iter().filter_map(|d| d.as_document().cloned()).collect())
}

fn partial_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(PARTIAL_SUFFIX);
    PathBuf::from(name)
}

fn write_error(path: &Path, e: std::io::Error) -> String {
    format!("No se pudo escribir {}: {e}", path.display())
}
