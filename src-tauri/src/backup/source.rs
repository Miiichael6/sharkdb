//! Lo que se lee del servidor sobre una colección antes de copiarla: sus opciones e índices.

use mongodb::Database;
use mongodb::bson::{Bson, Document, doc};

use super::format::CollectionMetadata;
use crate::mongo::describe;

const COLLECTION_TYPE: &str = "collection";

/// Opciones (de `listCollections`) e índices (de `listIndexes`) de una colección.
pub async fn read_metadata(db: &Database, collection: &str) -> Result<CollectionMetadata, String> {
    let info = collection_info(db, collection)
        .await?
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

/// UUID con el que el servidor identifica la colección, si existe: dos conexiones que apuntan al
/// mismo servidor ven el mismo.
pub async fn collection_uuid(db: &Database, collection: &str) -> Result<Option<Bson>, String> {
    let info = collection_info(db, collection).await?;
    Ok(info.and_then(|i| i.get_document("info").ok()?.get("uuid").cloned()))
}

/// La entrada de `listCollections` de una colección.
async fn collection_info(db: &Database, collection: &str) -> Result<Option<Document>, String> {
    let listed = first_batch(db, doc! { "listCollections": 1, "filter": { "name": collection } }).await?;
    Ok(listed.into_iter().next())
}

/// Documentos del primer lote de un comando con cursor; los que se usan aquí caben en uno.
pub async fn first_batch(db: &Database, command: Document) -> Result<Vec<Document>, String> {
    let reply = db.run_command(command, None).await.map_err(describe)?;
    let batch = reply
        .get_document("cursor")
        .and_then(|c| c.get_array("firstBatch"))
        .map_err(|e| e.to_string())?;
    Ok(batch.iter().filter_map(|d| d.as_document().cloned()).collect())
}
