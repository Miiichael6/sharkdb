//! Integración de los trabajos con Tauri: el progreso sale como evento, se cancelan por comando y
//! se ve lo que tienen en marcha las otras instancias.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

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

/// Lo que otra instancia tiene en marcha, si algo: aquí no se puede lanzar nada hasta que termine (error 60).
#[tauri::command]
pub fn busy_elsewhere(jobs: State<'_, Jobs>) -> Result<Option<String>, String> {
    jobs.busy_elsewhere()
}

/// Mantiene vivo lo que esta instancia tiene anotado mientras la app siga abierta.
pub fn start_heartbeat(app: AppHandle) {
    std::thread::spawn(move || loop {
        std::thread::sleep(super::shared::HEARTBEAT_EVERY);
        app.state::<Jobs>().heartbeat();
    });
}
