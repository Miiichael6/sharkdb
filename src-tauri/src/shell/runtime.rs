//! Hilo propio por sesión de shell: recibe trabajos por canal (scripts, lotes de cursor), los
//! ejecuta en su `ShellSession` y responde por un `oneshot`. La cancelación se hace desde fuera
//! con una bandera atómica.

use std::path::PathBuf;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::thread;

use tokio::runtime::Handle;
use tokio::sync::oneshot;

use super::bridge::MongoBridge;
use super::engine::EngineLimits;
use super::outcome::{CursorBatch, CursorId, ScriptOutcome};
use super::session::ShellSession;
use super::watchdog::Watchdog;

const THREAD_NAME: &str = "sharkdb-shell";
const STOPPED: &str = "El motor de la sesión se ha detenido";

enum Job {
    Run {
        db: String,
        code: String,
        script_dir: Option<PathBuf>,
        reply: oneshot::Sender<ScriptOutcome>,
    },
    NextBatch {
        cursor: CursorId,
        size: usize,
        reply: oneshot::Sender<Result<CursorBatch, String>>,
    },
    CloseCursor {
        cursor: CursorId,
    },
}

pub struct ShellRuntime {
    jobs: mpsc::Sender<Job>,
    cancel: Arc<AtomicBool>,
}

impl ShellRuntime {
    /// Arranca el hilo; termina (cerrando sus cursores) cuando se suelta el `ShellRuntime`.
    /// El hilo entra en el contexto de `handle` porque el driver lo necesita para cerrar cursores.
    pub fn spawn<B>(limits: EngineLimits, handle: Handle, make_bridge: B) -> Result<Self, String>
    where
        B: FnOnce(Watchdog) -> Rc<dyn MongoBridge> + Send + 'static,
    {
        let cancel = Arc::new(AtomicBool::new(false));
        let (jobs, inbox) = mpsc::channel::<Job>();
        let (ready, started) = mpsc::channel::<Result<(), String>>();
        let flag = cancel.clone();
        thread::Builder::new()
            .name(THREAD_NAME.into())
            .spawn(move || {
                let _runtime_context = handle.enter();
                let watchdog = Watchdog::new(flag);
                let bridge = make_bridge(watchdog.clone());
                let mut session = match ShellSession::new(limits, watchdog, bridge) {
                    Ok(session) => session,
                    Err(e) => return drop(ready.send(Err(e.to_string()))),
                };
                let _ = ready.send(Ok(()));
                for job in inbox {
                    handle_job(&mut session, job);
                }
            })
            .map_err(|e| e.to_string())?;
        started.recv().map_err(|e| e.to_string())??;
        Ok(Self { jobs, cancel })
    }

    /// Ejecuta un script; los trabajos de una misma sesión se hacen en orden, uno a uno.
    /// `script_dir` es la carpeta del fichero abierto en la pestaña, para `load`.
    pub async fn run(
        &self,
        db: String,
        code: String,
        script_dir: Option<PathBuf>,
    ) -> Result<ScriptOutcome, String> {
        let (reply, outcome) = oneshot::channel();
        self.send(Job::Run {
            db,
            code,
            script_dir,
            reply,
        })?;
        outcome.await.map_err(|_| STOPPED.to_string())
    }

    pub async fn next_batch(&self, cursor: CursorId, size: usize) -> Result<CursorBatch, String> {
        let (reply, batch) = oneshot::channel();
        self.send(Job::NextBatch {
            cursor,
            size,
            reply,
        })?;
        batch.await.map_err(|_| STOPPED.to_string())?
    }

    pub fn close_cursor(&self, cursor: CursorId) -> Result<(), String> {
        self.send(Job::CloseCursor { cursor })
    }

    /// Corta el trabajo en curso (si lo hay): el script en el próximo punto de interrupción de
    /// QuickJS y una espera al servidor en el acto.
    pub fn cancel(&self) {
        self.cancel.store(true, Ordering::SeqCst);
    }

    fn send(&self, job: Job) -> Result<(), String> {
        self.jobs.send(job).map_err(|_| STOPPED.to_string())
    }
}

impl Drop for ShellRuntime {
    /// Sin esto, un script largo mantendría vivo el hilo (y sus cursores) tras desconectar.
    fn drop(&mut self) {
        self.cancel();
    }
}

fn handle_job(session: &mut ShellSession, job: Job) {
    match job {
        Job::Run {
            db,
            code,
            script_dir,
            reply,
        } => drop(reply.send(session.run(&db, &code, script_dir))),
        Job::NextBatch {
            cursor,
            size,
            reply,
        } => drop(reply.send(session.next_batch(cursor, size))),
        Job::CloseCursor { cursor } => session.close_cursor(cursor),
    }
}
