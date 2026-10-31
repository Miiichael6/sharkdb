//! Comandos Tauri del sync: finos, resuelven las sesiones, vuelven a comprobar que el destino se
//! puede modificar (D7) y delegan en `copy`.

use serde::Deserialize;
use tauri::{AppHandle, State};

use super::catalog::{self, DatabaseCatalog};
use super::copy::{DatabaseCopy, SyncEnds, sync};
use super::target::ensure_distinct_connections;
use crate::backup::commands::require_collections;
use crate::jobs::Jobs;
use crate::jobs::events::emitter;
use crate::jobs::report::CollectionResult;
use crate::mongo::{self, Sessions};
use crate::store;

const PROTECTED: &str = "La conexión de destino está protegida o es de producción: nunca se sincroniza sobre ella";

/// Colecciones de una BD del origen; van a la BD del mismo nombre en el destino.
#[derive(Deserialize)]
pub struct DatabaseSelection {
    db: String,
    collections: Vec<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    source_sid: String,
    target_sid: String,
    databases: Vec<DatabaseSelection>,
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
    let SyncRequest { source_sid, target_sid, databases } = request;
    let databases: Vec<_> = databases.into_iter().filter(|d| !d.collections.is_empty()).collect();
    require_collections(&databases.iter().flat_map(|d| d.collections.clone()).collect::<Vec<_>>())?;
    ensure_distinct_connections(&source_sid, &target_sid)?;
    // No basta con que la UI no lo ofrezca: se comprueba con lo guardado en disco.
    if store::is_protected(&app, &target_sid)? {
        return Err(PROTECTED.into());
    }
    let (target_client, safe_mode) = mongo::session_with_safe_mode(&sessions, &target_sid).await?;
    safe_mode.ensure_writable()?;
    // Del origen solo se lee: puede estar protegido o en safe mode.
    let (source_client, _) = mongo::session_with_safe_mode(&sessions, &source_sid).await?;
    let running = jobs.start(&job)?;
    let copies: Vec<DatabaseCopy> = databases
        .into_iter()
        .map(|d| DatabaseCopy {
            source: source_client.database(&d.db),
            target: target_client.database(&d.db),
            collections: d.collections,
        })
        .collect();
    let ends = SyncEnds { target_client: &target_client, safe_mode: &safe_mode };
    sync(&ends, &copies, running.cancel_flag(), emitter(&app, &job)).await
}
