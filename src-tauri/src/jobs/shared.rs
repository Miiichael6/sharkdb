//! Trabajos pesados de las otras instancias de SharkDB (error 60). Cada ventana es un proceso aparte:
//! lo que una tiene en marcha (un backup, un restore, un sync o el turno de las programadas) se anota
//! en un archivo de la carpeta común, y las demás no lanzan nada mientras siga ahí. Cada instancia
//! renueva sus archivos con un latido: uno sin renovar es de una instancia caída y no cuenta.

use std::fs::{self, OpenOptions};
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant, SystemTime};

/// Cada cuánto renueva una instancia sus archivos.
pub const HEARTBEAT_EVERY: Duration = Duration::from_secs(5);
/// Un archivo sin renovar en este tiempo es de una instancia que ya no está.
const STALE_AFTER: Duration = Duration::from_secs(30);
/// Cerrojo para comprobar y anotar de una vez: dos instancias nunca se ven libres a la vez.
const LOCK_FILE: &str = ".registro.lock";
/// El cerrojo se tiene milisegundos: uno más viejo es de una instancia que cayó con él.
const LOCK_STALE_AFTER: Duration = Duration::from_secs(5);
const LOCK_WAIT: Duration = Duration::from_secs(2);
const LOCK_RETRY: Duration = Duration::from_millis(10);
const ENTRY_EXTENSION: &str = "en-curso";

/// Por qué no se anotó un trabajo.
#[derive(Debug, PartialEq)]
pub enum Refused {
    /// Otra instancia tiene en marcha lo que se describe ("un backup").
    Busy(String),
    Failed(String),
}

impl From<Refused> for String {
    fn from(refused: Refused) -> String {
        match refused {
            Refused::Busy(label) => busy_message(&label),
            Refused::Failed(error) => error,
        }
    }
}

pub fn busy_message(label: &str) -> String {
    format!("Hay {label} en curso en otra ventana de SharkDB: espera a que termine")
}

/// La carpeta común de las instancias, vista desde una de ellas (`pid`).
pub struct SharedJobs {
    dir: PathBuf,
    pid: u32,
}

/// Un trabajo anotado; se borra al soltarlo.
#[derive(Debug)]
pub struct Claim {
    path: PathBuf,
}

impl Drop for Claim {
    fn drop(&mut self) {
        let _ = fs::remove_file(&self.path);
    }
}

impl SharedJobs {
    pub fn new(dir: PathBuf) -> Self {
        Self::with_pid(dir, std::process::id())
    }

    fn with_pid(dir: PathBuf, pid: u32) -> Self {
        Self { dir, pid }
    }

    /// Anota `job` (descrito como `label`) como en curso en esta instancia, salvo que otra tenga algo en marcha.
    pub fn claim(&self, job: &str, label: &str) -> Result<Claim, Refused> {
        self.locked(|| {
            if let Some(other) = self.elsewhere().map_err(Refused::Failed)? {
                return Err(Refused::Busy(other));
            }
            let path = self.dir.join(format!("{}-{}.{ENTRY_EXTENSION}", self.pid, file_safe(job)));
            fs::write(&path, label).map_err(|e| Refused::Failed(format!("No se pudo escribir {}: {e}", path.display())))?;
            Ok(Claim { path })
        })
    }

    /// Lo que otra instancia tiene en marcha, si algo. Los archivos caducados se borran al verlos.
    pub fn elsewhere(&self) -> Result<Option<String>, String> {
        if !self.dir.is_dir() {
            return Ok(None);
        }
        let entries = fs::read_dir(&self.dir).map_err(|e| format!("No se pudo leer {}: {e}", self.dir.display()))?;
        for entry in entries.filter_map(Result::ok) {
            let path = entry.path();
            match owner(&path) {
                Some(pid) if pid != self.pid => {}
                _ => continue,
            }
            if is_stale(&path, STALE_AFTER) {
                let _ = fs::remove_file(&path);
                continue;
            }
            if let Ok(label) = fs::read_to_string(&path) {
                return Ok(Some(label));
            }
        }
        Ok(None)
    }

    /// Renueva los archivos de esta instancia: sigue viva para las demás.
    pub fn heartbeat(&self) {
        let Ok(entries) = fs::read_dir(&self.dir) else {
            return;
        };
        for path in entries.filter_map(Result::ok).map(|entry| entry.path()) {
            if owner(&path) == Some(self.pid) {
                let _ = OpenOptions::new().write(true).open(&path).and_then(|file| file.set_modified(SystemTime::now()));
            }
        }
    }

    fn locked<T>(&self, f: impl FnOnce() -> Result<T, Refused>) -> Result<T, Refused> {
        fs::create_dir_all(&self.dir).map_err(|e| Refused::Failed(format!("No se pudo crear {}: {e}", self.dir.display())))?;
        let lock = self.dir.join(LOCK_FILE);
        let started = Instant::now();
        loop {
            match OpenOptions::new().write(true).create_new(true).open(&lock) {
                Ok(_) => break,
                Err(e) if e.kind() == ErrorKind::AlreadyExists => {
                    if is_stale(&lock, LOCK_STALE_AFTER) {
                        let _ = fs::remove_file(&lock);
                    } else if started.elapsed() > LOCK_WAIT {
                        return Err(Refused::Failed("No se pudo comprobar si otra ventana tiene una operación en curso".into()));
                    } else {
                        thread::sleep(LOCK_RETRY);
                    }
                }
                Err(e) => return Err(Refused::Failed(format!("No se pudo crear {}: {e}", lock.display()))),
            }
        }
        let result = f();
        let _ = fs::remove_file(&lock);
        result
    }
}

/// La instancia de un archivo `<pid>-<trabajo>.en-curso`.
fn owner(path: &Path) -> Option<u32> {
    if path.extension().and_then(|e| e.to_str()) != Some(ENTRY_EXTENSION) {
        return None;
    }
    let name = path.file_name()?.to_str()?;
    name.split_once('-')?.0.parse().ok()
}

fn is_stale(path: &Path, after: Duration) -> bool {
    fs::metadata(path)
        .and_then(|m| m.modified())
        .is_ok_and(|modified| modified.elapsed().is_ok_and(|age| age > after))
}

/// Los ids de trabajo son UUIDs: cualquier otro carácter no llega al nombre del archivo.
fn file_safe(job: &str) -> String {
    job.chars().map(|c| if c.is_ascii_alphanumeric() || c == '-' { c } else { '_' }).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sharkdb-shared-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn another_instance_cannot_start_while_one_runs() {
        let dir = temp_dir("busy");
        let a = SharedJobs::with_pid(dir.clone(), 1);
        let b = SharedJobs::with_pid(dir.clone(), 2);

        let running = a.claim("job-1", "un backup").unwrap();
        // La misma instancia sí puede lanzar más: dentro de una ventana manda el frontend.
        let second = a.claim("job-2", "un sync").unwrap();
        assert!(matches!(b.elsewhere().unwrap().as_deref(), Some("un backup" | "un sync")));
        assert!(matches!(b.claim("job-3", "un restore"), Err(Refused::Busy(_))));
        assert_eq!(a.elsewhere(), Ok(None));

        drop(running);
        drop(second);
        assert_eq!(b.elsewhere(), Ok(None));
        let theirs = b.claim("job-3", "un restore").unwrap();
        assert_eq!(a.claim("job-4", "un backup").map(|_| ()), Err(Refused::Busy("un restore".into())));
        drop(theirs);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn what_a_fallen_instance_left_does_not_count() {
        let dir = temp_dir("stale");
        let a = SharedJobs::with_pid(dir.clone(), 1);
        let b = SharedJobs::with_pid(dir.clone(), 2);
        let left = a.claim("job-1", "un backup").unwrap();
        let old = SystemTime::now() - STALE_AFTER - Duration::from_secs(1);
        OpenOptions::new().write(true).open(&left.path).unwrap().set_modified(old).unwrap();

        assert_eq!(b.elsewhere(), Ok(None));
        assert!(!left.path.exists());
        drop(left);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn the_heartbeat_keeps_its_own_jobs_alive() {
        let dir = temp_dir("heartbeat");
        let a = SharedJobs::with_pid(dir.clone(), 1);
        let b = SharedJobs::with_pid(dir.clone(), 2);
        let running = a.claim("job-1", "un backup").unwrap();
        let old = SystemTime::now() - STALE_AFTER - Duration::from_secs(1);
        OpenOptions::new().write(true).open(&running.path).unwrap().set_modified(old).unwrap();

        // El latido de otra instancia no renueva lo ajeno.
        b.heartbeat();
        assert!(is_stale(&running.path, STALE_AFTER));
        a.heartbeat();
        assert_eq!(b.elsewhere(), Ok(Some("un backup".into())));
        drop(running);
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_lock_left_by_a_fallen_instance_is_taken() {
        let dir = temp_dir("lock");
        fs::create_dir_all(&dir).unwrap();
        let lock = dir.join(LOCK_FILE);
        fs::write(&lock, "").unwrap();
        let old = SystemTime::now() - LOCK_STALE_AFTER - Duration::from_secs(1);
        OpenOptions::new().write(true).open(&lock).unwrap().set_modified(old).unwrap();

        let claim = SharedJobs::with_pid(dir.clone(), 1).claim("job-1", "un backup").unwrap();
        assert!(!lock.exists());
        drop(claim);
        fs::remove_dir_all(dir).unwrap();
    }
}
