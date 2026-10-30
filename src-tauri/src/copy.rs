//! Copia de una colección entre dos conexiones abiertas distintas (en el mismo servidor la hace el
//! propio servidor con `$out`, desde el frontend). Lee el origen por lotes y los inserta en una
//! colección provisional del destino que, al terminar, sustituye a la de destino con un
//! `renameCollection` (`dropTarget`). Así un fallo a medias no deja el destino a medio copiar, y si
//! las dos conexiones apuntan al mismo servidor y colección el origen nunca se borra antes de leerse.
//!
//! Es una vía de escritura propia, aparte de `run_command`: el destino se pide con
//! `writable_session`, que la rechaza si esa sesión está en safe mode.

use std::pin::pin;

use futures::{Stream, StreamExt};
use mongodb::bson::{Document, doc};
use mongodb::options::FindOptions;
use mongodb::{Client, Collection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::mongo::{Sessions, describe, session_with_safe_mode, writable_session};

/// Evento con el avance de una copia. Debe coincidir con `tauriCollectionCopier.ts`.
const PROGRESS_EVENT: &str = "copy-progress";
/// Documentos por lote leído e insertado (el driver parte cada `insert_many` según el tamaño máximo
/// de mensaje del servidor, así que basta con acotar el número).
const BATCH_SIZE: usize = 1000;
const STAGING_SUFFIX: &str = ".robo3b-copy-";
/// `renameCollection` solo se acepta en la base de datos `admin`.
const ADMIN_DB: &str = "admin";

#[derive(Deserialize, Debug, Clone, PartialEq)]
pub struct CollectionRef {
    sid: String,
    db: String,
    coll: String,
}

#[derive(Serialize, Clone, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
struct CopyProgress<'a> {
    copy_id: &'a str,
    copied: u64,
    total: u64,
}

/// Dónde van los lotes de documentos copiados.
pub(crate) trait DocumentSink {
    async fn insert(&mut self, docs: Vec<Document>) -> Result<(), String>;
}

struct CollectionSink(Collection<Document>);

impl DocumentSink for CollectionSink {
    async fn insert(&mut self, docs: Vec<Document>) -> Result<(), String> {
        self.0.insert_many(docs, None).await.map(|_| ()).map_err(describe)
    }
}

/// Pasa los documentos de `source` a `sink` en lotes de `batch_size`, avisando a `on_batch` con el
/// total copiado tras cada lote. Devuelve cuántos documentos se copiaron.
pub(crate) async fn copy_in_batches(
    source: impl Stream<Item = Result<Document, String>>,
    sink: &mut impl DocumentSink,
    batch_size: usize,
    mut on_batch: impl FnMut(u64),
) -> Result<u64, String> {
    let mut source = pin!(source);
    let mut batch = Vec::with_capacity(batch_size);
    let mut copied = 0;
    while let Some(document) = source.next().await {
        batch.push(document?);
        if batch.len() == batch_size {
            copied += flush(sink, &mut batch).await?;
            on_batch(copied);
        }
    }
    if !batch.is_empty() {
        copied += flush(sink, &mut batch).await?;
        on_batch(copied);
    }
    Ok(copied)
}

async fn flush(sink: &mut impl DocumentSink, batch: &mut Vec<Document>) -> Result<u64, String> {
    let documents = std::mem::take(batch);
    let count = documents.len() as u64;
    sink.insert(documents).await?;
    Ok(count)
}

/// Nombre de la colección provisional donde se copia antes de sustituir el destino.
fn staging_name(coll: &str, copy_id: &str) -> String {
    format!("{coll}{STAGING_SUFFIX}{copy_id}")
}

/// `renameCollection` que sustituye `to` por `from` dentro de la base de datos `db`.
fn replace_command(db: &str, from: &str, to: &str) -> Document {
    doc! { "renameCollection": format!("{db}.{from}"), "to": format!("{db}.{to}"), "dropTarget": true }
}

#[tauri::command]
pub async fn copy_collection(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    copy_id: String,
    source: CollectionRef,
    target: CollectionRef,
) -> Result<u64, String> {
    if source == target {
        return Err("El destino es la misma colección que el origen".into());
    }
    let origin = session_with_safe_mode(&sessions, &source.sid).await?.0.database(&source.db).collection(&source.coll);
    let destination = writable_session(&sessions, &target.sid).await?;
    let total = origin.estimated_document_count(None).await.map_err(describe)?;
    let report = |copied| {
        // Un aviso perdido no debe cortar la copia: el siguiente lote lo corrige.
        let _ = app.emit(PROGRESS_EVENT, CopyProgress { copy_id: &copy_id, copied, total });
    };
    report(0);
    copy_via_staging(&origin, &destination, &target, &copy_id, report).await
}

/// Copia `origin` en una colección provisional de `target` y la renombra a `target.coll`,
/// sustituyendo lo que hubiera. Si la copia falla, la provisional se borra y el destino queda igual.
async fn copy_via_staging(
    origin: &Collection<Document>,
    client: &Client,
    target: &CollectionRef,
    copy_id: &str,
    report: impl FnMut(u64),
) -> Result<u64, String> {
    let destination = client.database(&target.db);
    let staging = staging_name(&target.coll, copy_id);
    let staging_coll = destination.collection::<Document>(&staging);
    let options = FindOptions::builder().batch_size(BATCH_SIZE as u32).build();
    let documents = origin.find(None, options).await.map_err(describe)?;
    let documents = documents.map(|document| document.map_err(describe));

    let mut sink = CollectionSink(staging_coll.clone());
    let copied = match copy_in_batches(documents, &mut sink, BATCH_SIZE, report).await {
        Ok(copied) => copied,
        Err(e) => {
            let _ = staging_coll.drop(None).await;
            return Err(e);
        }
    };
    if copied == 0 {
        // Nada que renombrar: se deja una colección vacía en el destino, como haría `$out`.
        destination.create_collection(&staging, None).await.map_err(describe)?;
    }
    client
        .database(ADMIN_DB)
        .run_command(replace_command(&target.db, &staging, &target.coll), None)
        .await
        .map_err(describe)?;
    Ok(copied)
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures::stream;

    #[derive(Default)]
    struct FakeSink {
        batches: Vec<usize>,
        fail_on: Option<usize>,
    }

    impl DocumentSink for FakeSink {
        async fn insert(&mut self, docs: Vec<Document>) -> Result<(), String> {
            if self.fail_on == Some(self.batches.len()) {
                return Err("insert failed".into());
            }
            self.batches.push(docs.len());
            Ok(())
        }
    }

    fn documents(n: i32) -> impl Stream<Item = Result<Document, String>> {
        stream::iter((0..n).map(|i| Ok(doc! { "_id": i })))
    }

    #[tokio::test]
    async fn copies_in_full_batches_plus_the_rest_and_reports_each_one() {
        let mut sink = FakeSink::default();
        let mut progress = Vec::new();
        let copied = copy_in_batches(documents(2500), &mut sink, 1000, |n| progress.push(n)).await.unwrap();
        assert_eq!(copied, 2500);
        assert_eq!(sink.batches, [1000, 1000, 500]);
        assert_eq!(progress, [1000, 2000, 2500]);
    }

    #[tokio::test]
    async fn an_empty_source_copies_nothing() {
        let mut sink = FakeSink::default();
        let copied = copy_in_batches(documents(0), &mut sink, 1000, |_| panic!("no batch")).await.unwrap();
        assert_eq!(copied, 0);
        assert!(sink.batches.is_empty());
    }

    #[tokio::test]
    async fn stops_at_the_first_read_or_insert_error() {
        let failing_read = stream::iter([Ok(doc! { "_id": 1 }), Err("cursor died".to_string())]);
        let mut sink = FakeSink::default();
        assert_eq!(copy_in_batches(failing_read, &mut sink, 10, |_| {}).await, Err("cursor died".into()));
        assert!(sink.batches.is_empty());

        let mut sink = FakeSink { fail_on: Some(1), ..FakeSink::default() };
        assert!(copy_in_batches(documents(25), &mut sink, 10, |_| {}).await.is_err());
        assert_eq!(sink.batches, [10]);
    }

    #[test]
    fn replaces_the_target_with_the_staging_collection() {
        let staging = staging_name("orders", "abc");
        assert_eq!(staging, "orders.robo3b-copy-abc");
        let command = replace_command("shop", &staging, "orders");
        assert_eq!(command.keys().next().map(String::as_str), Some("renameCollection"));
        assert_eq!(command.get_str("renameCollection").unwrap(), "shop.orders.robo3b-copy-abc");
        assert_eq!(command.get_str("to").unwrap(), "shop.orders");
        assert_eq!(command.get_bool("dropTarget").unwrap(), true);
    }
}
