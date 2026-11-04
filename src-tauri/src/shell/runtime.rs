//! Hilo propio por sesión de shell: recibe trabajos por canal (scripts, lotes de cursor), los
//! ejecuta en su `ShellSession` y responde por un `oneshot`. La cancelación se hace desde fuera
//! con una bandera atómica. Solo hay un script a la vez: otro mientras tanto se rechaza, no se
//! encola (correría después sin verse en la UI, y la cancelación del primero no lo frenaría).

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
use super::session::{RunOptions, ShellSession};
use super::watchdog::Watchdog;

const THREAD_NAME: &str = "sharkdb-shell";
const STOPPED: &str = "El motor de la sesión se ha detenido";
pub const BUSY: &str = "Ya hay un script en ejecución en esta pestaña";

enum Job {
    Run {
        db: String,
        code: String,
        script_dir: Option<PathBuf>,
        options: RunOptions,
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
    /// Hay un script enviado al hilo que aún no ha terminado; lo suelta el hilo al acabarlo.
    busy: Arc<AtomicBool>,
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
        let busy = Arc::new(AtomicBool::new(false));
        let done = busy.clone();
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
                    handle_job(&mut session, job, &done);
                }
            })
            .map_err(|e| e.to_string())?;
        started.recv().map_err(|e| e.to_string())??;
        Ok(Self { jobs, cancel, busy })
    }

    /// Ejecuta un script; los trabajos de una misma sesión se hacen en orden, uno a uno. Si ya hay
    /// un script en curso, falla con `BUSY` sin enviarlo.
    /// `script_dir` es la carpeta del fichero abierto en la pestaña, para `load`; `options`, las
    /// preferencias vigentes, que valen también para las páginas que se lean después.
    pub async fn run(
        &self,
        db: String,
        code: String,
        script_dir: Option<PathBuf>,
        options: RunOptions,
    ) -> Result<ScriptOutcome, String> {
        if self
            .busy
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err(BUSY.to_string());
        }
        let (reply, outcome) = oneshot::channel();
        let sent = self.send(Job::Run {
            db,
            code,
            script_dir,
            options,
            reply,
        });
        if sent.is_err() {
            self.busy.store(false, Ordering::SeqCst);
        }
        sent?;
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

fn handle_job(session: &mut ShellSession, job: Job, busy: &AtomicBool) {
    match job {
        Job::Run {
            db,
            code,
            script_dir,
            options,
            reply,
        } => {
            session.configure(options);
            let outcome = session.run(&db, &code, script_dir);
            // Antes de responder: quien espera la respuesta ya puede lanzar el siguiente.
            busy.store(false, Ordering::SeqCst);
            drop(reply.send(outcome))
        }
        Job::NextBatch {
            cursor,
            size,
            reply,
        } => drop(reply.send(session.next_batch(cursor, size))),
        Job::CloseCursor { cursor } => session.close_cursor(cursor),
    }
}
