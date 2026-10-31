//! Backup: vuelca colecciones de una o varias BDs a una carpeta con el formato de `mongodump --out`
//! (`<carpeta>/<bd>/<colección>.bson`).

use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

use mongodb::bson::RawDocumentBuf;
use mongodb::{Client, Database};
use mongodb::options::FindOptions;

use super::folder;
use super::format;
use super::source::read_metadata;
use crate::jobs::CancelFlag;
use crate::jobs::report::{CollectionResult, Progress};
use crate::jobs::selection::{DatabaseSelection, collection_label, each_collection};
use crate::mongo::describe;

/// Cada cuántos documentos se avisa del progreso.
const PROGRESS_EVERY: u64 = 1000;
const FIND_BATCH_SIZE: u32 = 1000;
/// Los datos se escriben aquí y se renombran al acabar: un backup cortado no deja un `.bson` a medias.
const PARTIAL_SUFFIX: &str = ".partial";

/// Vuelca las colecciones elegidas de cada BD de `client` en `dir/<bd>` (que se crean si no existen).
pub async fn dump_databases(
    client: &Client,
    databases: &[DatabaseSelection],
    dir: &Path,
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    // Reunidas antes del bucle: un iterador de closures vivo entre `await`s no es `Send`.
    let collections = each_collection(databases, |d| &d.collections);
    let count = collections.len();
    let mut results = Vec::with_capacity(count);
    for (index, (database, collection)) in collections.into_iter().enumerate() {
        cancel.check()?;
        let db_dir = folder::database_dir(dir, &database.db);
        fs::create_dir_all(&db_dir).map_err(|e| format!("No se pudo crear {}: {e}", db_dir.display()))?;
        let label = collection_label(&database.db, collection);
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let result = dump_collection(&client.database(&database.db), collection, &db_dir, cancel, progress).await?;
        results.push(CollectionResult { collection: label, ..result });
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

fn partial_path(path: &Path) -> PathBuf {
    let mut name = path.as_os_str().to_owned();
    name.push(PARTIAL_SUFFIX);
    PathBuf::from(name)
}

fn write_error(path: &Path, e: std::io::Error) -> String {
    format!("No se pudo escribir {}: {e}", path.display())
}
