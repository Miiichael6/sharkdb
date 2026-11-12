//! Comandos Tauri del sync: finos, resuelven las sesiones, vuelven a comprobar que el destino se
//! puede modificar (D7) y delegan en `copy` (BDs y colecciones) o `documents` (documentos sueltos).

use mongodb::bson::Bson;
use serde::Deserialize;
use serde_json::Value;
use tauri::{AppHandle, State};

use super::catalog;
use super::copy::{DatabaseCopy, sync};
use super::documents::{self, DocumentCopy, ids_from_json};
use super::target::{ensure_distinct_connections, ensure_lower_level};
use crate::backup::staging::Destination;
use crate::jobs::Jobs;
use crate::jobs::events::emitter;
use crate::jobs::report::CollectionResult;
use crate::jobs::selection::{DatabaseCatalog, DatabaseSelection, non_empty};
use crate::mongo::{self, Sessions};
use crate::store;

const PROTECTED: &str = "La conexión de destino está protegida, es de producción o apunta al mismo servidor que una que lo es: nunca se sincroniza sobre ella";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    source_sid: String,
    target_sid: String,
    /// Cada BD del origen va a la de su mismo nombre en el destino.
    databases: Vec<DatabaseSelection>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentSyncRequest {
    source_sid: String,
    target_sid: String,
    /// La misma BD y colección en el origen y en el destino.
    db: String,
    collection: String,
    /// `_id` de cada documento, en Extended JSON.
    ids: Vec<Value>,
}

/// No basta con que la UI no lo ofrezca: se comprueba con lo guardado en disco.
fn ensure_not_protected(app: &AppHandle, target_sid: &str) -> Result<(), String> {
    if store::is_protected(app, target_sid)? { Err(PROTECTED.into()) } else { Ok(()) }
}

/// Bases de datos de una conexión con sus colecciones copiables; solo lee.
#[tauri::command]
pub async fn database_catalog(sessions: State<'_, Sessions>, sid: String) -> Result<Vec<DatabaseCatalog>, String> {
    let (client, _) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    catalog::database_catalog(&client).await
}

#[tauri::command]
pub async fn sync_databases(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: SyncRequest,
) -> Result<Vec<CollectionResult>, String> {
    // Antes de cualquier `await`: si no, un "Cancelar" que llegue mientras se conecta se pierde.
    let running = jobs.start(&job, "un sync")?;
    let SyncRequest { source_sid, target_sid, databases } = request;
    let databases = non_empty(databases)?;
    ensure_distinct_connections(&source_sid, &target_sid)?;
    ensure_not_protected(&app, &target_sid)?;
    let (target_client, safe_mode) = mongo::session_with_safe_mode(&sessions, &target_sid).await?;
    safe_mode.ensure_writable()?;
    // Del origen solo se lee: puede estar protegido o en safe mode.
    let (source_client, _) = mongo::session_with_safe_mode(&sessions, &source_sid).await?;
    let copies: Vec<DatabaseCopy> = databases
        .into_iter()
        .map(|d| DatabaseCopy {
            source: source_client.database(&d.db),
            target: target_client.database(&d.db),
            collections: d.collections,
        })
        .collect();
    let destination = Destination { client: &target_client, safe_mode: &safe_mode };
    sync(&destination, &copies, running.cancel_flag(), &emitter(&app, &job)).await
}

/// Los documentos con esos `_id`, completos, en Extended JSON canónico: lo que muestra la
/// confirmación del sync de documentos (R99). Solo lee.
#[tauri::command]
pub async fn load_full_documents(
    sessions: State<'_, Sessions>,
    sid: String,
    db: String,
    collection: String,
    ids: Vec<Value>,
) -> Result<Vec<Value>, String> {
    let ids = ids_from_json(ids)?;
    let (client, _) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    let found = documents::load_full(&client.database(&db), &collection, &ids).await?;
    Ok(found.into_iter().map(|d| Bson::Document(d).into_canonical_extjson()).collect())
}

/// Sincroniza documentos sueltos hacia un entorno de menor nivel (R97–R100, R104, D25).
#[tauri::command]
pub async fn sync_documents(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: DocumentSyncRequest,
) -> Result<Vec<CollectionResult>, String> {
    // Antes de cualquier `await`, como `sync_databases`.
    let running = jobs.start(&job, "un sync de documentos")?;
    let DocumentSyncRequest { source_sid, target_sid, db, collection, ids } = request;
    let ids = ids_from_json(ids)?;
    ensure_distinct_connections(&source_sid, &target_sid)?;
    ensure_not_protected(&app, &target_sid)?;
    ensure_lower_level(
        store::connection_tag(&app, &source_sid)?.as_deref(),
        store::connection_tag(&app, &target_sid)?.as_deref(),
    )?;
    let (target_client, safe_mode) = mongo::session_with_safe_mode(&sessions, &target_sid).await?;
    safe_mode.ensure_writable()?;
    let (source_client, _) = mongo::session_with_safe_mode(&sessions, &source_sid).await?;
    let copy = DocumentCopy { source: source_client.database(&db), target: target_client.database(&db), collection, ids };
    documents::sync_documents(&copy, &safe_mode, running.cancel_flag(), &emitter(&app, &job)).await
}
