//! Sync de documentos sueltos (R97–R100, D25): los documentos elegidos en el visor se leen enteros
//! del origen por `_id` (nunca la proyección que mostraba el visor) y cada uno reemplaza al de su
//! mismo `_id` en la misma BD y colección del destino, o se inserta si no está (upsert). Si la BD o
//! la colección no existen en el destino, se crean al escribir.

use mongodb::Database;
use mongodb::bson::{Bson, Document, doc};
use mongodb::options::ReplaceOptions;
use serde_json::Value;

use super::target::ensure_distinct_collections;
use crate::backup::source::collection_uuid;
use crate::jobs::CancelFlag;
use crate::jobs::collections::CollectionTracker;
use crate::jobs::report::{CollectionResult, Progress, Report};
use crate::jobs::selection::collection_label;
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

const ID_FIELD: &str = "_id";
pub const NO_IDS: &str = "Elige al menos un documento con _id";
pub const NOTHING_FOUND: &str = "Ninguno de los documentos elegidos existe ya en el origen";

/// Los `_id` tal como llegan del frontend (Extended JSON), sin repetir y con al menos uno.
pub fn ids_from_json(ids: Vec<Value>) -> Result<Vec<Bson>, String> {
    let mut parsed: Vec<Bson> = Vec::with_capacity(ids.len());
    for id in ids {
        let id = Bson::try_from(id).map_err(|e| e.to_string())?;
        if !parsed.contains(&id) {
            parsed.push(id);
        }
    }
    if parsed.is_empty() { Err(NO_IDS.into()) } else { Ok(parsed) }
}

/// Los documentos con esos `_id`, completos y en el orden de `ids`; los que ya no existen faltan.
pub async fn load_full(db: &Database, collection: &str, ids: &[Bson]) -> Result<Vec<Document>, String> {
    let filter = doc! { ID_FIELD: { "$in": ids.to_vec() } };
    let mut cursor = db.collection::<Document>(collection).find(filter, None).await.map_err(describe)?;
    let mut found = Vec::new();
    while cursor.advance().await.map_err(describe)? {
        found.push(cursor.deserialize_current().map_err(describe)?);
    }
    Ok(in_order_of(found, ids))
}

fn in_order_of(mut documents: Vec<Document>, ids: &[Bson]) -> Vec<Document> {
    let position = |d: &Document| d.get(ID_FIELD).and_then(|id| ids.iter().position(|i| i == id)).unwrap_or(usize::MAX);
    documents.sort_by_key(position);
    documents
}

/// Documentos de una colección del origen (solo se lee) que van a la de su mismo nombre en el destino.
pub struct DocumentCopy {
    pub source: Database,
    pub target: Database,
    pub collection: String,
    pub ids: Vec<Bson>,
}

/// Escribe los documentos de `copy` en el destino, uno a uno, avisando el avance por documento.
/// Cancelar o activar el safe mode para antes del siguiente; los ya escritos se quedan (cada uno es
/// un reemplazo completo e independiente).
pub async fn sync_documents(
    copy: &DocumentCopy,
    safe_mode: &SafeMode,
    cancel: &CancelFlag,
    report: &impl Report,
) -> Result<Vec<CollectionResult>, String> {
    let tracker = CollectionTracker::new(report);
    let db = copy.target.name();
    let label = collection_label(db, &copy.collection);
    let progress = |done, total| {
        report.progress(Progress { collection: label.clone(), index: 0, count: 1, done, total });
        tracker.running(db, &copy.collection, done, total);
    };
    let result = copy_documents(copy, safe_mode, cancel, progress).await;
    tracker.ended_keeping_written(db, &copy.collection, &result);
    result.map(|documents| vec![CollectionResult { collection: label, documents, duplicates: 0, indexes: 0 }])
}

async fn copy_documents(
    copy: &DocumentCopy,
    safe_mode: &SafeMode,
    cancel: &CancelFlag,
    progress: impl Fn(u64, u64),
) -> Result<u64, String> {
    cancel.check()?;
    safe_mode.ensure_writable()?;
    let collection = copy.collection.as_str();
    ensure_distinct_collections(
        collection_uuid(&copy.source, collection).await?.as_ref(),
        collection_uuid(&copy.target, collection).await?.as_ref(),
    )?;
    let documents = load_full(&copy.source, collection, &copy.ids).await?;
    if documents.is_empty() {
        return Err(NOTHING_FOUND.into());
    }
    let total = documents.len() as u64;
    progress(0, total);
    let target = copy.target.collection::<Document>(collection);
    let upsert = ReplaceOptions::builder().upsert(true).build();
    for (written, document) in documents.into_iter().enumerate() {
        cancel.check()?;
        safe_mode.ensure_writable()?;
        let id = document.get(ID_FIELD).cloned().unwrap_or(Bson::Null);
        target.replace_one(doc! { ID_FIELD: id }, document, upsert.clone()).await.map_err(describe)?;
        progress(written as u64 + 1, total);
    }
    Ok(total)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn ids_arrive_as_extended_json_without_repeats() {
        let ids = ids_from_json(vec![json!({ "$oid": "65a1b2c3d4e5f60718293a4b" }), json!(7), json!(7)]).unwrap();
        assert_eq!(ids.len(), 2);
        assert!(matches!(ids[0], Bson::ObjectId(_)));
        assert_eq!(ids_from_json(vec![]), Err(NO_IDS.into()));
    }

    #[test]
    fn documents_come_back_in_the_order_they_were_picked() {
        let ids = [Bson::Int32(2), Bson::Int32(1)];
        let ordered = in_order_of(vec![doc! { "_id": 1 }, doc! { "_id": 2 }], &ids);
        assert_eq!(ordered, [doc! { "_id": 2 }, doc! { "_id": 1 }]);
    }

    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_documents_arrive_whole_and_replace_the_existing_ones() {
        use crate::jobs::CANCELLED;
        use crate::jobs::report::CollectionState;
        use crate::jobs::report::testing::Recorder;
        use crate::safe_mode::SAFE_MODE_ERROR;
        use mongodb::Client;

        let client = Client::with_uri_str("mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000").await.unwrap();
        let names = ["robo3b_it_docsync_prod", "robo3b_it_docsync_qa"];
        let [prod, qa] = names.map(|n| client.database(n));
        for db in [&prod, &qa] {
            db.drop(None).await.unwrap();
        }
        let source = prod.collection::<Document>("orders");
        let full = |id: i32| doc! { "_id": id, "name": format!("pedido {id}"), "lines": [{ "sku": "a", "qty": id }], "hidden": true };
        source.insert_many([full(1), full(2), full(3)], None).await.unwrap();
        // En QA el 1 existe con otro contenido y el 9 no se elige: se reemplaza uno y el otro queda.
        let target = qa.collection::<Document>("orders");
        target.insert_many([doc! { "_id": 1, "stale": true }, doc! { "_id": 9 }], None).await.unwrap();

        // El visor mostraba una proyección; aquí llegan solo los _id (el 4 ya no existe en el origen).
        let copy = DocumentCopy { source: prod.clone(), target: qa.clone(), collection: "orders".into(), ids: ids_from_json(vec![serde_json::json!(2), serde_json::json!(1), serde_json::json!(4)]).unwrap() };
        let loaded = load_full(&prod, "orders", &copy.ids).await.unwrap();
        assert_eq!(loaded, [full(2), full(1)]);

        let reports = Recorder::new();
        let results = sync_documents(&copy, &SafeMode::new(false), &CancelFlag::default(), &reports).await.unwrap();
        assert_eq!(results[0].documents, 2);
        assert_eq!(target.find_one(doc! { "_id": 1 }, None).await.unwrap(), Some(full(1)));
        assert_eq!(target.find_one(doc! { "_id": 2 }, None).await.unwrap(), Some(full(2)));
        assert_eq!(target.count_documents(doc! {}, None).await.unwrap(), 3);
        assert!(reports.collections().iter().any(|u| u.state == CollectionState::Applied));

        // La misma colección como destino, el safe mode y cancelar se rechazan sin escribir.
        let same = DocumentCopy { target: prod.clone(), ..copy };
        assert!(sync_documents(&same, &SafeMode::new(false), &CancelFlag::default(), &Recorder::new()).await.is_err());
        let copy = DocumentCopy { target: qa.clone(), ..same };
        assert_eq!(sync_documents(&copy, &SafeMode::new(true), &CancelFlag::default(), &Recorder::new()).await, Err(SAFE_MODE_ERROR.into()));
        let cancelled = CancelFlag::default();
        cancelled.cancel();
        assert_eq!(sync_documents(&copy, &SafeMode::new(false), &cancelled, &Recorder::new()).await, Err(CANCELLED.into()));
        // Cancelar a mitad: lo ya escrito se queda y el panel lo ve como aplicado, "2 de 3".
        let fresh = DocumentCopy { ids: ids_from_json(vec![serde_json::json!(3), serde_json::json!(1), serde_json::json!(2)]).unwrap(), source: prod.clone(), target: qa.clone(), collection: "orders".into() };
        target.delete_many(doc! { "_id": { "$in": [3, 2] } }, None).await.unwrap();
        let halfway = CancelFlag::default();
        let stopper = halfway.clone();
        let reports = Recorder::reacting(move |p: &crate::jobs::report::Progress| {
            if p.done == 2 {
                stopper.cancel();
            }
        });
        assert_eq!(sync_documents(&fresh, &SafeMode::new(false), &halfway, &reports).await, Err(CANCELLED.into()));
        assert!(target.find_one(doc! { "_id": 3 }, None).await.unwrap().is_some());
        assert!(target.find_one(doc! { "_id": 1 }, None).await.unwrap().is_some());
        assert!(target.find_one(doc! { "_id": 2 }, None).await.unwrap().is_none());
        let last = reports.collections().pop().unwrap();
        assert_eq!((last.state, last.done, last.total), (CollectionState::Applied, 2, 3));
        let gone = DocumentCopy { ids: vec![Bson::Int32(4)], ..copy };
        assert_eq!(sync_documents(&gone, &SafeMode::new(false), &CancelFlag::default(), &Recorder::new()).await, Err(NOTHING_FOUND.into()));

        for db in [prod, qa] {
            db.drop(None).await.unwrap();
        }
    }
}
