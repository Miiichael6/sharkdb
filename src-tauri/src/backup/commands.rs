//! Comandos Tauri de backup/restore: finos, solo resuelven la sesión, registran el trabajo para
//! poder cancelarlo (`crate::jobs`) y emiten el progreso como evento.

use std::path::PathBuf;

use serde::Deserialize;
use tauri::{AppHandle, State};

use super::dump::dump;
use super::folder::{self, BackupEntry};
use super::restore::{RestoreTarget, restore};
use crate::jobs::Jobs;
use crate::jobs::events::emitter;
use crate::jobs::report::CollectionResult;
use crate::mongo::{self, Sessions};
use crate::store;

pub const NO_COLLECTIONS: &str = "Elige al menos una colección";
const PROTECTED: &str = "La conexión de destino está protegida o es de producción: no se restaura sobre ella";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRequest {
    sid: String,
    db: String,
    collections: Vec<String>,
    /// Carpeta de la base de datos (`<salida>/<bd>`), como la deja `mongodump`.
    dir: PathBuf,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    /// Conexión y base de datos de destino.
    sid: String,
    db: String,
    dir: PathBuf,
    collections: Vec<String>,
    drop_before: bool,
}

pub fn require_collections(collections: &[String]) -> Result<(), String> {
    if collections.is_empty() { Err(NO_COLLECTIONS.into()) } else { Ok(()) }
}

#[tauri::command]
pub async fn backup_database(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: BackupRequest,
) -> Result<Vec<CollectionResult>, String> {
    let BackupRequest { sid, db, collections, dir } = request;
    require_collections(&collections)?;
    // Un backup solo lee: se permite con safe mode activo.
    let (client, _) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    let running = jobs.start(&job)?;
    dump(&client.database(&db), &collections, &dir, running.cancel_flag(), emitter(&app, &job)).await
}

#[tauri::command]
pub async fn restore_database(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: RestoreRequest,
) -> Result<Vec<CollectionResult>, String> {
    let RestoreRequest { sid, db, dir, collections, drop_before } = request;
    require_collections(&collections)?;
    if store::is_protected(&app, &sid)? {
        return Err(PROTECTED.into());
    }
    let (client, safe_mode) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    safe_mode.ensure_writable()?;
    let running = jobs.start(&job)?;
    let database = client.database(&db);
    let target = RestoreTarget { db: &database, safe_mode: &safe_mode, drop_before };
    restore(&target, &collections, &dir, running.cancel_flag(), emitter(&app, &job)).await
}

/// Colecciones que hay en una carpeta de backup.
#[tauri::command]
pub fn read_backup_folder(dir: PathBuf) -> Result<Vec<BackupEntry>, String> {
    folder::list_entries(&dir)
}
