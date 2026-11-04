//! Restore: reemplaza colecciones de una o varias BDs con las de una carpeta de backup (formato
//! `mongodump`). Como el sync, cada colección se escribe en una provisional y solo cuando todas
//! están llenas reemplazan a las originales (`staging`): un fallo o una cancelación mientras se
//! escriben dejan el destino como estaba.

use std::collections::HashMap;
use std::fs::File;
use std::io::BufReader;
use std::path::{Path, PathBuf};

use mongodb::Database;

use super::folder::{self, BackupEntry};
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
    // Los archivos de cada colección, buscados antes de escribir nada: su nombre puede no ser el
    // de la colección (`Users~1.bson`, error 36), y si falta una se sabe antes de empezar.
    let mut found = HashMap::new();
    for restore in restores {
        found.insert(restore.dir.as_path(), folder::list_entries(&restore.dir)?);
    }
    let entries = collections
        .iter()
        .map(|(restore, collection)| folder::find_entry(&found[restore.dir.as_path()], collection))
        .collect::<Result<Vec<_>, _>>()?;
    let count = collections.len();
    let mut results = Vec::with_capacity(count);
    for (index, ((restore, collection), entry)) in collections.into_iter().zip(entries).enumerate() {
        cancel.check()?;
        destination.safe_mode.ensure_writable()?;
        let label = collection_label(restore.target.name(), collection);
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let staging = staging_name(collection, &run);
        let fill = restore_into(destination, &restore.dir, &restore.target, entry, &staging, cancel, progress);
        let result = replacements.stage(&restore.target, collection, &staging, fill).await?;
        results.push(CollectionResult { collection: label, ..result });
    }
    cancel.check()?;
    Ok(results)
}

/// Escribe documentos e índices de `entry` (de la carpeta `dir`) en `staging`. El progreso va en bytes del `.bson`.
async fn restore_into(
    destination: &Destination<'_>,
    dir: &Path,
    target: &Database,
    entry: &BackupEntry,
    staging: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let metadata = folder::read_metadata(dir, entry)?;
    let data_path = folder::data_path(dir, &entry.stem)?;
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
        collection: entry.collection.clone(),
        documents: writer.inserted(),
        duplicates: writer.duplicates(),
        indexes: indexes.len(),
    })
}
