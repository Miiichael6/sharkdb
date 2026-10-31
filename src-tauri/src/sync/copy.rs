//! Sync: reemplaza colecciones de una o varias BDs del destino con las del origen, leyendo por cursor y escribiendo
//! por lotes (el `writer` del restore de 14), sin pasar por disco.
//!
//! Cada colección se copia en una provisional del destino y, solo si todo fue bien, se renombra
//! encima de la original (`dropTarget`). Un fallo o una cancelación dejan el destino como estaba.

use mongodb::bson::{RawDocumentBuf, doc, oid::ObjectId};
use mongodb::options::FindOptions;
use mongodb::{Client, Database};

use super::target::{ensure_distinct_collections, staging_name};
use crate::backup::source::{collection_uuid, read_metadata};
use crate::backup::writer::{self, BatchWriter};
use crate::jobs::CancelFlag;
use crate::jobs::report::{CollectionResult, Progress};
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

const FIND_BATCH_SIZE: u32 = 1000;
const ADMIN_DB: &str = "admin";

/// El destino de un sync, con su safe mode, que se vuelve a mirar antes de cada lote y antes de reemplazar.
pub struct SyncEnds<'a> {
    pub target_client: &'a Client,
    pub safe_mode: &'a SafeMode,
}

/// Colecciones de una BD del origen (solo se lee) que reemplazan a las de una BD del destino.
pub struct DatabaseCopy {
    pub source: Database,
    pub target: Database,
    pub collections: Vec<String>,
}

/// Reemplaza las colecciones de cada `copies` en el destino, en un solo trabajo: el progreso
/// cuenta las colecciones de todas las BDs y cada resultado se nombra `bd.colección`.
pub async fn sync(
    ends: &SyncEnds<'_>,
    copies: &[DatabaseCopy],
    cancel: &CancelFlag,
    report: impl Fn(Progress),
) -> Result<Vec<CollectionResult>, String> {
    // Distingue las provisionales de este trabajo de las de otro que corra a la vez.
    let run = ObjectId::new().to_hex();
    let count = copies.iter().map(|c| c.collections.len()).sum();
    // Reunidas antes del bucle: un iterador de closures vivo entre `await`s no es `Send`.
    let collections: Vec<(&DatabaseCopy, &str)> =
        copies.iter().flat_map(|copy| copy.collections.iter().map(move |c| (copy, c.as_str()))).collect();
    let mut results = Vec::with_capacity(count);
    for (index, (copy, collection)) in collections.into_iter().enumerate() {
        cancel.check()?;
        ends.safe_mode.ensure_writable()?;
        let label = format!("{}.{collection}", copy.target.name());
        let progress = |done, total| report(Progress { collection: label.clone(), index, count, done, total });
        let result = sync_collection(ends, copy, collection, &run, cancel, progress).await?;
        results.push(CollectionResult { collection: label, ..result });
    }
    Ok(results)
}

async fn sync_collection(
    ends: &SyncEnds<'_>,
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
    match copy_into(ends, &copy.source, target, collection, &staging, cancel, progress).await {
        Ok(result) => {
            replace_with(ends, target.name(), collection, &staging).await?;
            Ok(result)
        }
        Err(e) => {
            // Lo provisional no debe quedarse en el destino; si el borrado falla, manda el error original.
            let _ = target.collection::<RawDocumentBuf>(&staging).drop(None).await;
            Err(e)
        }
    }
}

/// Copia documentos e índices de `collection` del origen a `staging` en el destino.
async fn copy_into(
    ends: &SyncEnds<'_>,
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
    let mut writer = BatchWriter::new(target, staging, ends.safe_mode, cancel);
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

/// Pone `staging` en el lugar de `collection`, eliminando la anterior, en una sola operación.
async fn replace_with(ends: &SyncEnds<'_>, db: &str, collection: &str, staging: &str) -> Result<(), String> {
    ends.safe_mode.ensure_writable()?;
    let namespace = |name: &str| format!("{db}.{name}");
    let command = doc! { "renameCollection": namespace(staging), "to": namespace(collection), "dropTarget": true };
    ends.target_client
        .database(ADMIN_DB)
        .run_command(command, None)
        .await
        .map(|_| ())
        .map_err(|e| format!("No se pudo reemplazar “{collection}”: {}", describe(e)))
}
