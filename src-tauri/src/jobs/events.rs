//! Integración de los trabajos con Tauri: el progreso sale como evento y se cancelan por comando.

use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

use super::Jobs;
use super::report::Progress;

/// Evento con el avance de un trabajo; el frontend filtra por `job`.
const PROGRESS_EVENT: &str = "job-progress";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressEvent<'a> {
    job: &'a str,
    #[serde(flatten)]
    progress: Progress,
}

/// Emite el progreso del trabajo `job`.
pub fn emitter<'a>(app: &'a AppHandle, job: &'a str) -> impl Fn(Progress) + 'a {
    move |progress| {
        // Perder un aviso de progreso no debe tumbar el trabajo.
        let _ = app.emit(PROGRESS_EVENT, ProgressEvent { job, progress });
    }
}

#[tauri::command]
pub fn cancel_job(jobs: State<'_, Jobs>, job: String) {
    jobs.cancel(&job);
}
