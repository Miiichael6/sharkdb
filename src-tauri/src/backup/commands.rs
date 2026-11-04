//! Comandos Tauri de backup/restore: finos, solo resuelven la sesión, registran el trabajo para
//! poder cancelarlo (`crate::jobs`) y emiten el progreso como evento.

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use mongodb::Client;
use serde::Deserialize;
use tauri::{AppHandle, State};

use super::dump;
use super::folder;
use super::leftovers::{self, Leftover};
use super::restore::{self, DatabaseRestore};
use super::staging::Destination;
use crate::jobs::Jobs;
use crate::jobs::events::emitter;
use crate::jobs::report::CollectionResult;
use crate::jobs::selection::{DatabaseCatalog, DatabaseSelection, non_empty};
use crate::mongo::{self, Sessions};
use crate::store;

const PROTECTED: &str = "La conexión de destino está protegida, es de producción o apunta al mismo servidor que una que lo es: no se restaura sobre ella";

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupRequest {
    sid: String,
    /// Carpeta de salida: cada BD va a `<dir>/<bd>`, como la deja `mongodump --out`.
    dir: PathBuf,
    databases: Vec<DatabaseSelection>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreRequest {
    dir: PathBuf,
    target_sid: String,
    /// Cada BD del backup va a la de su mismo nombre en el destino.
    databases: Vec<DatabaseSelection>,
}

#[tauri::command]
pub async fn backup_databases(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: BackupRequest,
) -> Result<Vec<CollectionResult>, String> {
    // Antes de cualquier `await`: si no, un "Cancelar" que llegue mientras se conecta se pierde.
    let running = jobs.start(&job, "un backup")?;
    let BackupRequest { sid, dir, databases } = request;
    let databases = non_empty(databases)?;
    // Un backup solo lee: se permite con safe mode activo y sobre conexiones protegidas.
    let (client, _) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    dump::dump_databases(&client, &databases, &dir, running.cancel_flag(), emitter(&app, &job)).await
}

/// Bases de datos y colecciones que se pueden restaurar de una carpeta de backup.
#[tauri::command]
pub fn read_backup_catalog(dir: PathBuf) -> Result<Vec<DatabaseCatalog>, String> {
    folder::read_catalog(&dir)
}

/// Abre en el explorador del sistema la carpeta de un backup. Solo carpetas: nunca abre (ejecuta) un archivo.
#[tauri::command]
pub fn open_backup_folder(dir: PathBuf) -> Result<(), String> {
    if !dir.is_dir() {
        return Err(format!("La carpeta {} ya no existe", dir.display()));
    }
    tauri_plugin_opener::open_path(&dir, None::<&str>).map_err(|e| format!("No se pudo abrir la carpeta: {e}"))
}

#[tauri::command]
pub async fn restore_databases(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    jobs: State<'_, Jobs>,
    job: String,
    request: RestoreRequest,
) -> Result<Vec<CollectionResult>, String> {
    // Antes de cualquier `await`: si no, un "Cancelar" que llegue mientras se conecta se pierde.
    let running = jobs.start(&job, "un restore")?;
    let RestoreRequest { dir, target_sid, databases } = request;
    let databases = non_empty(databases)?;
    // No basta con que la UI no lo ofrezca: se comprueba con lo guardado en disco.
    ensure_restorable(store::is_protected(&app, &target_sid)?)?;
    let (client, safe_mode) = mongo::session_with_safe_mode(&sessions, &target_sid).await?;
    safe_mode.ensure_writable()?;
    let restores = restores_from(&client, &dir, databases)?;
    let destination = Destination { client: &client, safe_mode: &safe_mode };
    restore::restore_databases(&destination, &restores, running.cancel_flag(), emitter(&app, &job)).await
}

/// Provisionales que dejaron en la conexión trabajos cortados a mitad, para ofrecer borrarlas.
#[tauri::command]
pub async fn find_leftovers(sessions: State<'_, Sessions>, sid: String) -> Result<Vec<Leftover>, String> {
    let (client, _) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    leftovers::find(&client, SystemTime::now()).await
}

#[tauri::command]
pub async fn drop_leftovers(
    app: AppHandle,
    sessions: State<'_, Sessions>,
    sid: String,
    leftovers: Vec<Leftover>,
) -> Result<(), String> {
    // Como el restore: una conexión protegida o de producción nunca se modifica.
    ensure_restorable(store::is_protected(&app, &sid)?)?;
    let (client, safe_mode) = mongo::session_with_safe_mode(&sessions, &sid).await?;
    leftovers::drop_all(&Destination { client: &client, safe_mode: &safe_mode }, &leftovers).await
}

/// Nunca se restaura sobre una conexión protegida o de producción.
fn ensure_restorable(protected: bool) -> Result<(), String> {
    if protected { Err(PROTECTED.into()) } else { Ok(()) }
}

/// Cada BD elegida, con su carpeta dentro del backup y la BD del mismo nombre en el destino.
fn restores_from(client: &Client, dir: &Path, databases: Vec<DatabaseSelection>) -> Result<Vec<DatabaseRestore>, String> {
    let found = folder::backup_databases(dir)?;
    databases
        .into_iter()
        .map(|selection| {
            let source = found
                .iter()
                .find(|d| d.name == selection.db)
                .ok_or_else(|| format!("La carpeta no tiene la base de datos “{}”", selection.db))?;
            Ok(DatabaseRestore {
                dir: source.dir.clone(),
                target: client.database(&selection.db),
                collections: selection.collections,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_protected_or_production_target_is_rejected() {
        assert_eq!(ensure_restorable(true), Err(PROTECTED.into()));
        assert_eq!(ensure_restorable(false), Ok(()));
    }
}
