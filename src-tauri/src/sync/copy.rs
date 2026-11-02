//! Sync: reemplaza colecciones de una o varias BDs del destino con las del origen, leyendo por cursor y escribiendo
//! por lotes (el `writer` del restore de 14), sin pasar por disco.
//!
//! Cada colección se copia en una provisional del destino que solo al final reemplaza a la original
//! (`backup::staging`): un fallo o una cancelación dejan el destino como estaba.

use mongodb::Database;
use mongodb::bson::RawDocumentBuf;
use mongodb::options::FindOptions;

use super::target::ensure_distinct_collections;
use crate::backup::source::{collection_uuid, read_metadata};
use crate::backup::staging::{Destination, Replacements, new_run, staging_name};
use crate::backup::writer::{self, BatchWriter};
use crate::jobs::CancelFlag;
use crate::jobs::report::{CollectionResult, Progress};
use crate::jobs::selection::{collection_label, each_collection};
use crate::mongo::describe;

const FIND_BATCH_SIZE: u32 = 1000;

/// Colecciones de una BD del origen (solo se lee) que reemplazan a las de una BD del destino.
pub struct DatabaseCopy {
    pub source: Database,
    pub target: Database,
    pub collections: Vec<String>,
}

/// Reemplaza las colecciones de cada `copies` en el destino, en un solo trabajo: no se reemplaza
/// ninguna hasta que todas se copiaron.
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
    let mut results = Vec::with_capacity(count);
    for (index, (copy, collection)) in collections.into_iter().enumerate() {
        cancel.check()?;
        destination.safe_mode.ensure_writable()?;
        let label = collection_label(copy.target.name(), collection);
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let result = sync_collection(replacements, destination, copy, collection, &run, cancel, progress).await?;
        results.push(CollectionResult { collection: label, ..result });
    }
    cancel.check()?;
    Ok(results)
}

async fn sync_collection(
    replacements: &mut Replacements<'_>,
    destination: &Destination<'_>,
    copy: &DatabaseCopy,
    collection: &str,
    run: &str,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<CollectionResult, String> {
    let target = &copy.target;
    ensure_distinct_collections(
        collection_uuid(&copy.source, collection).await?.as_ref(),
        collection_uuid(target, collection).await?.as_ref(),
    )?;
    let staging = staging_name(collection, run);
    let fill = copy_into(destination, &copy.source, target, collection, &staging, cancel, progress);
    replacements.stage(target, collection, &staging, fill).await
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
