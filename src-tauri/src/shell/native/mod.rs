//! Puente real con el servidor: las funciones `native.*` que usa `prelude.js`, sobre el driver.
//! Se ejecutan en el hilo del script; cada espera al servidor se hace con `Handle::block_on`
//! (nunca desde un worker de tokio) y se corta si el watchdog salta. Las escrituras pasan antes
//! por el safe mode de la sesión: es la sesión, no la UI, la que decide si se permiten.
//!
//! `find` y `aggregate` no esperan: lanzan la consulta en una tarea y devuelven el id al
//! momento; se espera al leer el cursor. Así varias sentencias seguidas consultan en paralelo.
//! Las escrituras esperan antes a las consultas en curso, para no adelantarse a ellas.
//!
//! Cortar una espera no para al servidor: un comando que escribe va en una sesión propia y, si se
//! corta, se le pide al servidor que la mate (`killSessions`), para que un `updateMany` cancelado
//! no siga escribiendo. Una agregación con `$out`/`$merge` no muere con su sesión: lleva un
//! `comment` con el que se la busca en `currentOp` y se mata con `killOp`.

mod cursors;
mod options;
mod query_clock;

use std::cell::RefCell;
use std::collections::HashMap;
use std::future::Future;
use std::rc::Rc;
use std::time::Duration;

use mongodb::bson::oid::ObjectId;
use mongodb::bson::{Bson, Document, doc};
use mongodb::{Client, ClientSession, Cursor};
use rquickjs::{Array, Ctx, Exception, Function, Object, Value};
use tokio::runtime::Handle;

use self::cursors::{CursorRegistry, Opening, Slot};
use self::options::{aggregate_options, find_options};
use self::query_clock::QueryClock;
use super::bridge::MongoBridge;
use super::convert::{bson_to_js, js_to_bson};
use super::outcome::{CursorBatch, CursorId};
use super::watchdog::{Interruption, Watchdog};
use crate::mongo::describe;
use crate::safe_mode::{
    SAFE_MODE_ERROR, SAFE_MODE_ERROR_NAME, SafeMode, is_write_command, is_write_pipeline,
};

const CANCELLED: &str = "Operación cancelada";
const TIMED_OUT: &str = "La operación superó el tiempo máximo";
const CURSOR_CLOSED: &str = "El cursor ya no está abierto";
/// Lo que se espera a que el servidor confirme que mató la escritura cortada.
const KILL_TIMEOUT: Duration = Duration::from_secs(5);
/// `name` de los errores que vienen del servidor o del driver.
const MONGO_ERROR: &str = "MongoError";

#[derive(Clone)]
pub struct MongoNatives {
    client: Client,
    safe_mode: SafeMode,
    handle: Handle,
    watchdog: Watchdog,
    cursors: Rc<RefCell<CursorRegistry<Slot>>>,
    /// Último lote que leyó el script de cada cursor, en BSON: lo que quede en el buffer de
    /// `cursor.js` al mostrar el cursor sale de aquí. Se suelta al cerrar el cursor o al acabar
    /// la ejecución (`retain_cursors`).
    script_batches: Rc<RefCell<HashMap<CursorId, Vec<Bson>>>>,
    query_clock: QueryClock,
}

impl MongoNatives {
    pub fn new(client: Client, safe_mode: SafeMode, handle: Handle, watchdog: Watchdog) -> Self {
        Self {
            client,
            safe_mode,
            handle,
            watchdog,
            cursors: Rc::default(),
            script_batches: Rc::default(),
            query_clock: QueryClock::default(),
        }
    }

    /// `wait` de una consulta: cuenta para el tiempo de consulta del script.
    fn query<T>(
        &self,
        future: impl Future<Output = mongodb::error::Result<T>>,
    ) -> Result<T, String> {
        self.query_clock.measure(|| self.wait(future))
    }

    /// Espera al servidor desde el hilo del script, cortando si hay cancelación o timeout.
    fn wait<T>(
        &self,
        future: impl Future<Output = mongodb::error::Result<T>>,
    ) -> Result<T, String> {
        self.wait_described(async { future.await.map_err(describe) })
    }

    fn wait_described<T>(
        &self,
        future: impl Future<Output = Result<T, String>>,
    ) -> Result<T, String> {
        self.wait_or_interrupted(future)
            .unwrap_or_else(|reason| Err(interruption_message(reason).into()))
    }

    /// Como `wait_described`, pero distingue el corte (Err exterior) del fallo del servidor.
    fn wait_or_interrupted<T>(
        &self,
        future: impl Future<Output = Result<T, String>>,
    ) -> Result<Result<T, String>, Interruption> {
        let watchdog = self.watchdog.clone();
        self.handle.block_on(async move {
            tokio::select! {
                output = future => Ok(output),
                reason = watchdog.interrupted() => Err(reason),
            }
        })
    }

    /// Lanza la apertura de un cursor sin esperarla.
    fn open(
        &self,
        future: impl Future<Output = mongodb::error::Result<Cursor<Document>>> + Send + 'static,
    ) -> CursorId {
        let task = self
            .handle
            .spawn(async move { future.await.map_err(describe) });
        self.cursors
            .borrow_mut()
            .insert(Slot::Opening(Opening::new(task)))
    }

    /// El cursor abierto: si la consulta sigue en curso, la espera (cuenta como tiempo de
    /// consulta).
    fn resolve(&self, slot: Slot) -> Result<Cursor<Document>, String> {
        match slot {
            Slot::Open(cursor) => Ok(*cursor),
            Slot::Failed(message) => Err(message),
            Slot::Opening(opening) => self
                .query_clock
                .measure(|| self.wait_described(opening.finish())),
        }
    }

    /// Espera a las consultas en curso antes de una escritura. Las que fallan se quedan con su
    /// error para quien las lea, y la escritura no se hace: el script ya habría parado ahí.
    fn settle(&self) -> Result<(), String> {
        let opening = self.cursors.borrow().ids_where(Slot::is_opening);
        let mut first_error = None;
        for id in opening {
            let Some(slot) = self.cursors.borrow_mut().take(id) else {
                continue;
            };
            let slot = match self.resolve(slot) {
                Ok(cursor) => Slot::Open(Box::new(cursor)),
                Err(message) => {
                    first_error.get_or_insert_with(|| message.clone());
                    Slot::Failed(message)
                }
            };
            self.cursors.borrow_mut().insert_at(id, slot);
        }
        first_error.map_or(Ok(()), Err)
    }

    fn find(
        &self,
        db: &str,
        coll: &str,
        filter: Document,
        options: &Document,
    ) -> Result<CursorId, String> {
        let options = find_options(options)?;
        let collection = self.client.database(db).collection::<Document>(coll);
        Ok(self.open(async move { collection.find(filter, options).await }))
    }

    fn aggregate(
        &self,
        db: &str,
        coll: &str,
        pipeline: Vec<Document>,
        options: &Document,
    ) -> Result<CursorId, String> {
        self.safe_mode.check_pipeline(&pipeline)?;
        let mut options = aggregate_options(options)?;
        let collection = self.client.database(db).collection::<Document>(coll);
        if !is_write_pipeline(&pipeline) {
            return Ok(self.open(async move { collection.aggregate(pipeline, options).await }));
        }
        self.settle()?;
        // La marca con la que encontrarla en `currentOp` si se corta (o el `comment` del usuario).
        let tag = options
            .comment_bson
            .get_or_insert_with(|| Bson::String(format!("sharkdb:{}", ObjectId::new())))
            .clone();
        let write = async { collection.aggregate(pipeline, options).await.map_err(describe) };
        let outcome = self.query_clock.measure(|| self.wait_or_interrupted(write));
        let cursor = outcome.unwrap_or_else(|reason| {
            self.stop_aggregate_on_server(db, coll, tag);
            Err(interruption_message(reason).into())
        })?;
        Ok(self.cursors.borrow_mut().insert(Slot::Open(Box::new(cursor))))
    }

    fn run_command(&self, db: &str, command: Document) -> Result<Document, String> {
        self.safe_mode.check_command(&command)?;
        if !is_write_command(&command) {
            return self.query(self.client.database(db).run_command(command, None));
        }
        self.settle()?;
        let database = self.client.database(db);
        // Elegir servidor para la sesión también espera: se corta igual que una consulta.
        let started = self
            .wait_or_interrupted(async { Ok(self.client.start_session(None).await) })
            .map_err(|reason| interruption_message(reason).to_string())?;
        let Ok(Ok(mut session)) = started else {
            return self.query(database.run_command(command, None));
        };
        let write = async { database.run_command_with_session(command, None, &mut session).await.map_err(describe) };
        let outcome = self.query_clock.measure(|| self.wait_or_interrupted(write));
        outcome.unwrap_or_else(|reason| {
            self.stop_on_server(&session);
            Err(interruption_message(reason).into())
        })
    }

    /// Mata en el servidor lo que hace `session` (una escritura cortada) y anota el resultado para
    /// el mensaje del script. El watchdog ya saltó, así que se espera con un plazo propio.
    fn stop_on_server(&self, session: &ClientSession) {
        let admin = self.client.database("admin");
        let command = doc! { "killSessions": [session.id().clone()] };
        let killed = self.handle.block_on(async {
            tokio::time::timeout(KILL_TIMEOUT, async { admin.run_command(command, None).await.map(|_| true) }).await
        });
        self.note_stopped(killed);
    }

    /// Como `stop_on_server`, para una agregación con `$out`/`$merge` cortada: no va atada a una
    /// sesión que se pueda matar, así que se busca en `currentOp` por su `comment` y se mata con
    /// `killOp`.
    fn stop_aggregate_on_server(&self, db: &str, coll: &str, tag: Bson) {
        let filter = doc! { "command.aggregate": coll, "command.$db": db, "command.comment": tag };
        let killed = self.handle.block_on(async {
            tokio::time::timeout(KILL_TIMEOUT, kill_ops(&self.client, filter)).await
        });
        self.note_stopped(killed);
    }

    /// Anota para el mensaje del script si la escritura cortada se detuvo en el servidor.
    fn note_stopped(&self, killed: Result<mongodb::error::Result<bool>, tokio::time::error::Elapsed>) {
        let note = match killed {
            Ok(Ok(true)) => "La escritura en curso se detuvo en el servidor; lo que ya hubiera aplicado no se deshace".into(),
            Ok(Ok(false)) => "No se encontró la escritura en curso en el servidor: puede que ya hubiera terminado".into(),
            Ok(Err(e)) => format!(
                "La escritura en curso puede seguir ejecutándose en el servidor (no se pudo detener: {})",
                describe(e)
            ),
            Err(_) => "La escritura en curso puede seguir ejecutándose en el servidor (no respondió al pedir que se detuviera)".into(),
        };
        self.watchdog.note_cut_write(note);
    }

    /// Lee hasta `size` documentos. Un cursor agotado, o que falla, se suelta (y se cierra).
    fn read(&self, id: CursorId, size: usize) -> Result<CursorBatch, String> {
        let slot = self.cursors.borrow_mut().take(id).ok_or(CURSOR_CLOSED)?;
        let mut cursor = self.resolve(slot)?;
        let (documents, exhausted) = self.wait(read_batch(&mut cursor, size))?;
        if !exhausted {
            self.cursors.borrow_mut().insert_at(id, Slot::Open(Box::new(cursor)));
        }
        Ok(CursorBatch {
            documents: documents.into_iter().map(Bson::Document).collect(),
            exhausted,
        })
    }
}

/// Mata con `killOp` las operaciones de `currentOp` que cumplen `filter`; `false` si no había
/// ninguna. Sin permiso para ver las de todos (`inprog`), se buscan solo entre las propias
/// (`$ownOps`), que cualquier usuario puede matar.
async fn kill_ops(client: &Client, filter: Document) -> mongodb::error::Result<bool> {
    let admin = client.database("admin");
    let mut current = doc! { "currentOp": 1 };
    current.extend(filter);
    let reply = match admin.run_command(current.clone(), None).await {
        Ok(reply) => reply,
        Err(_) => {
            current.insert("$ownOps", true);
            admin.run_command(current, None).await?
        }
    };
    let ops: Vec<Bson> = reply
        .get_array("inprog")
        .map(|ops| ops.iter().filter_map(|op| op.as_document()?.get("opid").cloned()).collect())
        .unwrap_or_default();
    for op in &ops {
        admin.run_command(doc! { "killOp": 1, "op": op.clone() }, None).await?;
    }
    Ok(!ops.is_empty())
}

async fn read_batch(
    cursor: &mut Cursor<Document>,
    size: usize,
) -> mongodb::error::Result<(Vec<Document>, bool)> {
    let mut documents = Vec::with_capacity(size);
    while documents.len() < size {
        if !cursor.advance().await? {
            return Ok((documents, true));
        }
        documents.push(cursor.deserialize_current()?);
    }
    Ok((documents, false))
}

impl MongoBridge for MongoNatives {
    fn natives<'js>(&self, ctx: &Ctx<'js>) -> rquickjs::Result<Object<'js>> {
        let natives = Object::new(ctx.clone())?;

        let me = self.clone();
        let find = move |ctx: Ctx<'js>,
                         db: String,
                         coll: String,
                         filter: Value<'js>,
                         options: Value<'js>| {
            let filter = to_document(&ctx, &filter)?;
            let options = to_document(&ctx, &options)?;
            me.find(&db, &coll, filter, &options)
                .map_err(|e| throw(&ctx, &e))
        };
        natives.set("find", Function::new(ctx.clone(), find)?)?;

        let me = self.clone();
        let aggregate = move |ctx: Ctx<'js>,
                              db: String,
                              coll: String,
                              pipeline: Value<'js>,
                              options: Value<'js>| {
            let pipeline = to_documents(&ctx, &pipeline)?;
            let options = to_document(&ctx, &options)?;
            me.aggregate(&db, &coll, pipeline, &options)
                .map_err(|e| throw(&ctx, &e))
        };
        natives.set("aggregate", Function::new(ctx.clone(), aggregate)?)?;

        let me = self.clone();
        let run_command = move |ctx: Ctx<'js>, db: String, command: Value<'js>| {
            let command = to_document(&ctx, &command)?;
            let reply = me.run_command(&db, command).map_err(|e| throw(&ctx, &e))?;
            bson_to_js(&ctx, &Bson::Document(reply))
        };
        natives.set("runCommand", Function::new(ctx.clone(), run_command)?)?;

        let me = self.clone();
        let cursor_next = move |ctx: Ctx<'js>, id: CursorId, size: usize| {
            let batch = me.read(id, size).map_err(|e| throw(&ctx, &e))?;
            let documents = batch_to_js(&ctx, &batch)?;
            me.script_batches.borrow_mut().insert(id, batch.documents);
            Ok::<_, rquickjs::Error>(documents)
        };
        natives.set("cursorNext", Function::new(ctx.clone(), cursor_next)?)?;

        let me = self.clone();
        let cursor_close = move |id: CursorId| me.close_cursor(id);
        natives.set("cursorClose", Function::new(ctx.clone(), cursor_close)?)?;

        Ok(natives)
    }

    fn next_batch(&self, cursor: CursorId, size: usize) -> Result<CursorBatch, String> {
        self.read(cursor, size)
    }

    fn result_batch(
        &self,
        _: &Ctx<'_>,
        cursor: CursorId,
        size: usize,
    ) -> Result<CursorBatch, String> {
        self.read(cursor, size)
    }

    fn buffered(&self, cursor: CursorId, count: usize) -> Option<Vec<Bson>> {
        let mut batch = self.script_batches.borrow_mut().remove(&cursor)?;
        let start = batch.len().checked_sub(count)?;
        Some(batch.split_off(start))
    }

    fn close_cursor(&self, cursor: CursorId) {
        self.script_batches.borrow_mut().remove(&cursor);
        let closed = self.cursors.borrow_mut().take(cursor);
        drop(closed);
    }

    fn retain_cursors(&self, keep: &[CursorId]) {
        self.script_batches.borrow_mut().clear();
        self.cursors.borrow_mut().retain(keep);
    }

    fn take_query_time(&self) -> Option<Duration> {
        self.query_clock.take()
    }
}

fn interruption_message(reason: Interruption) -> &'static str {
    match reason {
        Interruption::Cancelled => CANCELLED,
        Interruption::Timeout => TIMED_OUT,
    }
}

/// Error JS con `name = MongoError` (o `SafeModeError` si lo frenó safe mode), para distinguirlo
/// de los fallos del propio script.
fn throw(ctx: &Ctx<'_>, message: &str) -> rquickjs::Error {
    let name = if message == SAFE_MODE_ERROR { SAFE_MODE_ERROR_NAME } else { MONGO_ERROR };
    match Exception::from_message(ctx.clone(), message) {
        Ok(exception) => match exception.set("name", name) {
            Ok(()) => ctx.throw(exception.into_value()),
            Err(e) => e,
        },
        Err(e) => e,
    }
}

/// `undefined`/`null` cuentan como documento vacío (filtro u opciones omitidos).
fn to_document<'js>(ctx: &Ctx<'js>, value: &Value<'js>) -> rquickjs::Result<Document> {
    match js_to_bson(ctx, value)? {
        Bson::Document(document) => Ok(document),
        Bson::Null => Ok(Document::new()),
        _ => Err(Exception::throw_type(ctx, "se esperaba un objeto")),
    }
}

fn to_documents<'js>(ctx: &Ctx<'js>, value: &Value<'js>) -> rquickjs::Result<Vec<Document>> {
    let Bson::Array(items) = js_to_bson(ctx, value)? else {
        return Err(Exception::throw_type(ctx, "se esperaba un array de etapas"));
    };
    items
        .into_iter()
        .map(|item| match item {
            Bson::Document(stage) => Ok(stage),
            _ => Err(Exception::throw_type(ctx, "cada etapa debe ser un objeto")),
        })
        .collect()
}

fn batch_to_js<'js>(ctx: &Ctx<'js>, batch: &CursorBatch) -> rquickjs::Result<Object<'js>> {
    let documents = Array::new(ctx.clone())?;
    for (i, document) in batch.documents.iter().enumerate() {
        documents.set(i, bson_to_js(ctx, document)?)?;
    }
    let result = Object::new(ctx.clone())?;
    result.set("documents", documents)?;
    result.set("exhausted", batch.exhausted)?;
    Ok(result)
}
