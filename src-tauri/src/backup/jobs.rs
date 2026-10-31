//! Trabajos de backup/restore en marcha y su cancelación: como en el shell (03), una bandera
//! atómica que el trabajo mira entre lote y lote y que otro comando pone a `true`.

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex, MutexGuard};

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

/// Trabajos en marcha, por el id que les da el frontend.
#[derive(Default)]
pub struct BackupJobs(Mutex<HashMap<String, CancelFlag>>);

impl BackupJobs {
    /// Registra un trabajo; se da de baja solo al soltar el guardián.
    pub fn start(&self, job: &str) -> Result<JobGuard<'_>, String> {
        let flag = CancelFlag::default();
        let mut jobs = self.lock();
        if jobs.contains_key(job) {
            return Err(format!("Ya hay un trabajo con id {job}"));
        }
        jobs.insert(job.to_string(), flag.clone());
        Ok(JobGuard { jobs: self, job: job.to_string(), flag })
    }

    /// Pide parar un trabajo; si ya terminó no hace nada.
    pub fn cancel(&self, job: &str) {
        if let Some(flag) = self.lock().get(job) {
            flag.cancel();
        }
    }

    fn lock(&self) -> MutexGuard<'_, HashMap<String, CancelFlag>> {
        self.0.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

pub struct JobGuard<'a> {
    jobs: &'a BackupJobs,
    job: String,
    flag: CancelFlag,
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
        let jobs = BackupJobs::default();
        let guard = jobs.start("a").unwrap();
        assert!(jobs.start("a").is_err());
        assert_eq!(guard.cancel_flag().check(), Ok(()));

        jobs.cancel("a");
        assert_eq!(guard.cancel_flag().check(), Err(CANCELLED.into()));

        drop(guard);
        jobs.cancel("a");
        assert!(jobs.start("a").unwrap().cancel_flag().check().is_ok());
    }
}
