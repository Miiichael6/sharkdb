//! Hilo propio por sesión de shell: recibe scripts por canal, los ejecuta en su `Engine` y
//! responde con el `ScriptOutcome`. La cancelación se hace desde fuera con una bandera atómica.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::thread;

use tokio::sync::oneshot;

use super::engine::{Engine, EngineLimits};
use super::outcome::ScriptOutcome;

const THREAD_NAME: &str = "robo3b-shell";
const STOPPED: &str = "El motor de la sesión se ha detenido";

struct Job {
    code: String,
    reply: oneshot::Sender<ScriptOutcome>,
}

pub struct ShellRuntime {
    jobs: mpsc::Sender<Job>,
    cancel: Arc<AtomicBool>,
}

impl ShellRuntime {
    /// Arranca el hilo; el hilo termina cuando se suelta el `ShellRuntime`.
    pub fn spawn(limits: EngineLimits) -> Result<Self, String> {
        let cancel = Arc::new(AtomicBool::new(false));
        let (jobs, inbox) = mpsc::channel::<Job>();
        let (ready, started) = mpsc::channel::<Result<(), String>>();
        let flag = cancel.clone();
        thread::Builder::new()
            .name(THREAD_NAME.into())
            .spawn(move || {
                let mut engine = match Engine::new(limits, flag) {
                    Ok(engine) => engine,
                    Err(e) => return drop(ready.send(Err(e.to_string()))),
                };
                let _ = ready.send(Ok(()));
                for job in inbox {
                    let _ = job.reply.send(engine.run(&job.code));
                }
            })
            .map_err(|e| e.to_string())?;
        started.recv().map_err(|e| e.to_string())??;
        Ok(Self { jobs, cancel })
    }

    /// Ejecuta un script; los scripts de una misma sesión se ejecutan en orden, uno a uno.
    pub async fn run(&self, code: String) -> Result<ScriptOutcome, String> {
        let (reply, outcome) = oneshot::channel();
        self.jobs
            .send(Job { code, reply })
            .map_err(|_| STOPPED.to_string())?;
        outcome.await.map_err(|_| STOPPED.to_string())
    }

    /// Corta el script en curso (si lo hay) en el próximo punto de interrupción de QuickJS.
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }
}
