//! Trabajos largos (backup, restore, sync) en marcha y su cancelación: como en el shell (03), una
//! bandera atómica que el trabajo mira entre lote y lote y que otro comando pone a `true`.
//!
//! - `report`: el progreso y el resultado por colección.
//! - `events`: el progreso como evento Tauri y el comando `cancel_job`.
//! - `selection`: las colecciones de varias BDs que elige un trabajo.
//! - `shared`: lo que tienen en marcha las otras instancias de SharkDB (error 60).

pub mod events;
pub mod report;
pub mod selection;
pub mod shared;

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard, OnceLock};

use shared::{Claim, Refused, SharedJobs};

pub const CANCELLED: &str = "Operación cancelada";

#[derive(Clone, Debug, Default)]
pub struct CancelFlag(Arc<AtomicBool>);

impl CancelFlag {
    pub fn cancel(&self) {
        self.0.store(true, Ordering::SeqCst);
    }

    /// Error `CANCELLED` si ya se pidió cancelar.
    pub fn check(&self) -> Result<(), String> {
        if self.0.load(Ordering::SeqCst) {
            Err(CANCELLED.into())
        } else {
            Ok(())
        }
    }
}

/// Trabajos en marcha, por el id que les da el frontend. Con `share_between_instances`, también los
/// de las otras instancias: mientras una tenga algo en marcha, en esta no empieza nada (error 60).
#[derive(Default)]
pub struct Jobs {
    running: Mutex<HashMap<String, CancelFlag>>,
    shared: OnceLock<SharedJobs>,
    /// Turnos tomados (el de las programadas), hasta que se sueltan.
    turns: Mutex<HashMap<String, Option<Claim>>>,
}

impl Jobs {
    /// Comparte los trabajos con las otras instancias a través de `dir`; sin esto solo se ve esta.
    pub fn share_between_instances(&self, dir: PathBuf) {
        let _ = self.shared.set(SharedJobs::new(dir));
    }

    /// Registra un trabajo (descrito como `label`, "un backup"); se da de baja solo al soltar el
    /// guardián. Falla si otra instancia tiene algo en marcha.
    pub fn start(&self, job: &str, label: &str) -> Result<JobGuard<'_>, String> {
        let flag = CancelFlag::default();
        let mut jobs = self.lock();
        if jobs.contains_key(job) {
            return Err(format!("Ya hay un trabajo con id {job}"));
        }
        let claim = self.claim(job, label)?;
        jobs.insert(job.to_string(), flag.clone());
        Ok(JobGuard { jobs: self, job: job.to_string(), flag, _claim: claim })
    }

    /// Toma el turno `name` hasta `release_turn`: `false` si ya lo tiene esta instancia o si otra
    /// tiene algo en marcha (lo intentará más tarde).
    pub fn take_turn(&self, name: &str, label: &str) -> Result<bool, String> {
        let mut turns = self.turns.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
        if turns.contains_key(name) {
            return Ok(false);
        }
        match self.claim(name, label) {
            Ok(claim) => {
                turns.insert(name.to_string(), claim);
                Ok(true)
            }
            Err(Refused::Busy(_)) => Ok(false),
            Err(refused) => Err(refused.into()),
        }
    }

    pub fn release_turn(&self, name: &str) {
        self.turns.lock().unwrap_or_else(|poisoned| poisoned.into_inner()).remove(name);
    }

    /// Por qué no puede empezar nada aquí ahora: lo que otra instancia tiene en marcha.
    pub fn busy_elsewhere(&self) -> Result<Option<String>, String> {
        let Some(shared) = self.shared.get() else {
            return Ok(None);
        };
        Ok(shared.elsewhere()?.map(|label| shared::busy_message(&label)))
    }

    /// Renueva lo que esta instancia tiene anotado: sigue viva para las demás.
    pub fn heartbeat(&self) {
        if let Some(shared) = self.shared.get() {
            shared.heartbeat();
        }
    }

    fn claim(&self, job: &str, label: &str) -> Result<Option<Claim>, Refused> {
        self.shared.get().map(|shared| shared.claim(job, label)).transpose()
    }

    /// Pide parar un trabajo; si ya terminó no hace nada.
    pub fn cancel(&self, job: &str) {
        if let Some(flag) = self.lock().get(job) {
            flag.cancel();
        }
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, CancelFlag>> {
        self.running.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

pub struct JobGuard<'a> {
    jobs: &'a Jobs,
    job: String,
    flag: CancelFlag,
    /// Lo que ven las otras instancias; se borra con el guardián.
    _claim: Option<Claim>,
}

impl JobGuard<'_> {
    pub fn cancel_flag(&self) -> &CancelFlag {
        &self.flag
    }
}

impl Drop for JobGuard<'_> {
    fn drop(&mut self) {
        self.jobs.lock().remove(&self.job);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn cancelling_reaches_the_running_job_until_it_ends() {
        let jobs = Jobs::default();
        let guard = jobs.start("a", "un backup").unwrap();
        assert!(jobs.start("a", "un backup").is_err());
        assert_eq!(guard.cancel_flag().check(), Ok(()));

        jobs.cancel("a");
        assert_eq!(guard.cancel_flag().check(), Err(CANCELLED.into()));

        drop(guard);
        jobs.cancel("a");
        assert!(jobs.start("a", "un backup").unwrap().cancel_flag().check().is_ok());
    }

    #[test]
    fn a_turn_is_held_once_until_released() {
        let jobs = Jobs::default();
        assert_eq!(jobs.take_turn("t", "un backup programado"), Ok(true));
        assert_eq!(jobs.take_turn("t", "un backup programado"), Ok(false));
        jobs.release_turn("t");
        assert_eq!(jobs.take_turn("t", "un backup programado"), Ok(true));
    }

    #[test]
    fn nothing_starts_while_another_instance_runs_something() {
        let dir = std::env::temp_dir().join(format!("sharkdb-jobs-shared-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let here = Jobs::default();
        here.share_between_instances(dir.clone());
        // Otra instancia: otro pid. Se simula con un archivo ajeno escrito a mano.
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("0-ajeno.en-curso"), "un sync").unwrap();

        let refused = here.start("a", "un backup").map(|_| ()).unwrap_err();
        assert!(refused.starts_with("Hay un sync en curso en otra ventana"), "{refused}");
        assert_eq!(here.take_turn("t", "un backup programado"), Ok(false));
        assert_eq!(here.busy_elsewhere().unwrap().as_deref(), Some(refused.as_str()));

        std::fs::remove_file(dir.join("0-ajeno.en-curso")).unwrap();
        let guard = here.start("a", "un backup").unwrap();
        // Lo de esta instancia no la bloquea a ella misma.
        assert_eq!(here.take_turn("t", "un backup programado"), Ok(true));
        assert_eq!(here.busy_elsewhere(), Ok(None));
        drop(guard);
        std::fs::remove_dir_all(dir).unwrap();
    }
}
