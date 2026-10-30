//! Puente real con el servidor: las funciones `native.*` que usa `prelude.js`, sobre el driver.
//! Se ejecutan en el hilo del script; cada espera al servidor se hace con `Handle::block_on`
//! (nunca desde un worker de tokio) y se corta si el watchdog salta.

mod cursors;
mod options;

use std::cell::RefCell;
use std::future::Future;
use std::rc::Rc;

use mongodb::bson::{Bson, Document};
use mongodb::{Client, Cursor};
use rquickjs::{Array, Ctx, Exception, Function, Object, Value};
use tokio::runtime::Handle;

use self::cursors::CursorRegistry;
use self::options::{aggregate_options, find_options};
use super::bridge::MongoBridge;
use super::convert::{bson_to_js, js_to_bson};
use super::outcome::{CursorBatch, CursorId};
use super::watchdog::{Interruption, Watchdog};
use crate::mongo::describe;

const CANCELLED: &str = "Operación cancelada";
const TIMED_OUT: &str = "La operación superó el tiempo máximo";
const CURSOR_CLOSED: &str = "El cursor ya no está abierto";
/// `name` de los errores que vienen del servidor o del driver.
const MONGO_ERROR: &str = "MongoError";

#[derive(Clone)]
pub struct MongoNatives {
    client: Client,
    handle: Handle,
    watchdog: Watchdog,
    cursors: Rc<RefCell<CursorRegistry<Cursor<Document>>>>,
}

impl MongoNatives {
    pub fn new(client: Client, handle: Handle, watchdog: Watchdog) -> Self {
        Self {
            client,
            handle,
            watchdog,
            cursors: Rc::default(),
        }
    }

    /// Espera al servidor desde el hilo del script, cortando si hay cancelación o timeout.
    fn wait<T>(
        &self,
        future: impl Future<Output = mongodb::error::Result<T>>,
    ) -> Result<T, String> {
        let watchdog = self.watchdog.clone();
        let outcome = self.handle.block_on(async move {
            tokio::select! {
                output = future => Ok(output),
                reason = watchdog.interrupted() => Err(reason),
            }
        });
        match outcome {
            Ok(result) => result.map_err(describe),
            Err(Interruption::Cancelled) => Err(CANCELLED.into()),
            Err(Interruption::Timeout) => Err(TIMED_OUT.into()),
        }
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
        let cursor = self.wait(collection.find(filter, options))?;
        Ok(self.cursors.borrow_mut().insert(cursor))
    }

    fn aggregate(
        &self,
        db: &str,
        coll: &str,
        pipeline: Vec<Document>,
        options: &Document,
    ) -> Result<CursorId, String> {
        let options = aggregate_options(options)?;
        let collection = self.client.database(db).collection::<Document>(coll);
        let cursor = self.wait(collection.aggregate(pipeline, options))?;
        Ok(self.cursors.borrow_mut().insert(cursor))
    }

    fn run_command(&self, db: &str, command: Document) -> Result<Document, String> {
        self.wait(self.client.database(db).run_command(command, None))
    }

    /// Lee hasta `size` documentos. Un cursor agotado, o que falla, se suelta (y se cierra).
    fn read(&self, id: CursorId, size: usize) -> Result<CursorBatch, String> {
        let mut cursor = self.cursors.borrow_mut().take(id).ok_or(CURSOR_CLOSED)?;
        let (documents, exhausted) = self.wait(read_batch(&mut cursor, size))?;
        if !exhausted {
            self.cursors.borrow_mut().insert_at(id, cursor);
        }
        Ok(CursorBatch {
            documents: documents.into_iter().map(Bson::Document).collect(),
            exhausted,
        })
    }
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
            batch_to_js(&ctx, &batch)
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

    fn close_cursor(&self, cursor: CursorId) {
        let closed = self.cursors.borrow_mut().take(cursor);
        drop(closed);
    }

    fn retain_cursors(&self, keep: &[CursorId]) {
        self.cursors.borrow_mut().retain(keep);
    }
}

/// Error JS con `name = MongoError`, para distinguirlo de los fallos del propio script.
fn throw(ctx: &Ctx<'_>, message: &str) -> rquickjs::Error {
    match Exception::from_message(ctx.clone(), message) {
        Ok(exception) => match exception.set("name", MONGO_ERROR) {
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
