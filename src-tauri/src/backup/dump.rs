//! Backup: vuelca colecciones de una o varias BDs a una carpeta con el formato de `mongodump --out`
//! (`<carpeta>/<bd>/<colección>.bson`). Los nombres que solo difieren en mayúsculas van a archivos
//! distintos (`Users~1.bson`, error 36): el real queda en el `.metadata.json` o en `NOMBRE_BD.txt`.

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
use crate::jobs::selection::{DatabaseSelection, collection_label};
use crate::mongo::describe;

/// Cada cuántos documentos se avisa del progreso.
const PROGRESS_EVERY: u64 = 1000;
const FIND_BATCH_SIZE: u32 = 1000;
/// Los datos se escriben aquí y se renombran al acabar: un backup cortado no deja un `.bson` a medias.
const PARTIAL_SUFFIX: &str = ".partial";

/// Dónde se guarda una colección: la carpeta de su BD y el nombre base de sus archivos.
struct Target<'a> {
    database: &'a DatabaseSelection,
    collection: &'a str,
    db_dir: PathBuf,
    stem: String,
}

/// Vuelca las colecciones elegidas de cada BD de `client` en `dir/<bd>` (que se crean si no existen).
/// Mientras dura, `dir` lleva la marca de backup sin terminar; si falla o se cancela, se queda.
pub async fn dump_databases(
    client: &Client,
    databases: &[DatabaseSelection],
    dir: &Path,
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    folder::mark_incomplete(dir)?;
    let results = dump_all(client, databases, dir, cancel, report).await?;
    folder::mark_complete(dir)?;
    Ok(results)
}

async fn dump_all(
    client: &Client,
    databases: &[DatabaseSelection],
    dir: &Path,
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    let targets = targets(databases, dir)?;
    let count = targets.len();
    let mut results = Vec::with_capacity(count);
    for (index, target) in targets.iter().enumerate() {
        cancel.check()?;
        let (database, collection) = (&target.database.db, target.collection);
        folder::create_database_dir(&target.db_dir, database)?;
        let label = collection_label(database, collection);
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let db = client.database(database);
        let result = dump_collection(&db, collection, &target.db_dir, &target.stem, cancel, progress).await?;
        results.push(CollectionResult { collection: label, ..result });
    }
    Ok(results)
}

/// Cada colección elegida, en orden, con carpeta y archivos que no chocan aunque el sistema de
/// archivos no distinga mayúsculas.
fn targets<'a>(databases: &'a [DatabaseSelection], dir: &Path) -> Result<Vec<Target<'a>>, String> {
    let folders = format::unique_stems(databases.iter().map(|d| d.db.as_str()))?;
    let mut targets = Vec::new();
    for (database, folder) in databases.iter().zip(folders) {
        let db_dir = folder::database_dir(dir, &folder);
        let stems = format::unique_stems(database.collections.iter().map(String::as_str))?;
        for (collection, stem) in database.collections.iter().zip(stems) {
            targets.push(Target { database, collection, db_dir: db_dir.clone(), stem });
        }
    }
    Ok(targets)
}

async fn dump_collection(
    db: &Database,
    collection: &str,
    dir: &Path,
    stem: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = read_metadata(db, collection).await?;
    let metadata_path = folder::metadata_path(dir, stem)?;
    fs::write(&metadata_path, metadata.to_json()?).map_err(|e| write_error(&metadata_path, e))?;

    let coll = db.collection::<RawDocumentBuf>(collection);
    let total = coll.estimated_document_count(None).await.map_err(describe)?;
    progress(0, total);

    let data_path = folder::data_path(dir, stem)?;
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
