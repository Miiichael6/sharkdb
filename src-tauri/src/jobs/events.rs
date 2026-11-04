//! Integración de los trabajos con Tauri: el progreso sale como evento, se cancelan por comando y
//! se ve lo que tienen en marcha las otras instancias.

use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager, State};

use super::Jobs;
use super::report::{CollectionProgress, Progress, Report};

/// Eventos con el avance de un trabajo; el frontend filtra por `job`. `job-progress` es el agregado
/// (la barra de la fila) y `job-collection`, el de cada colección.
const PROGRESS_EVENT: &str = "job-progress";
const COLLECTION_EVENT: &str = "job-collection";

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct JobEvent<'a, T> {
    job: &'a str,
    #[serde(flatten)]
    payload: T,
}

/// Emite como eventos lo que cuenta el trabajo `job`.
pub struct JobEvents<'a> {
    app: &'a AppHandle,
    job: &'a str,
}

pub fn emitter<'a>(app: &'a AppHandle, job: &'a str) -> JobEvents<'a> {
    JobEvents { app, job }
}

impl JobEvents<'_> {
    fn emit<T: Serialize + Clone>(&self, event: &str, payload: T) {
        // Perder un aviso de progreso no debe tumbar el trabajo.
        let _ = self.app.emit(event, JobEvent { job: self.job, payload });
    }
}

impl Report for JobEvents<'_> {
    fn progress(&self, progress: Progress) {
        self.emit(PROGRESS_EVENT, progress);
    }

    fn collection(&self, update: CollectionProgress) {
        self.emit(COLLECTION_EVENT, update);
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
