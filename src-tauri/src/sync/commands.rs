//! Comandos Tauri del sync: finos, resuelven las sesiones, vuelven a comprobar que el destino se
//! puede modificar (D7) y delegan en `copy`.

use serde::Deserialize;
use tauri::{AppHandle, State};

use super::catalog;
use super::copy::{DatabaseCopy, sync};
use super::target::ensure_distinct_connections;
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
    // No basta con que la UI no lo ofrezca: se comprueba con lo guardado en disco.
    if store::is_protected(&app, &target_sid)? {
        return Err(PROTECTED.into());
    }
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
    sync(&destination, &copies, running.cancel_flag(), emitter(&app, &job)).await
}
