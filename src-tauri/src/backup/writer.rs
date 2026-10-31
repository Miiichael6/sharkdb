//! Escritura de una colección en el destino, común al restore y al sync: crearla con sus
//! opciones, insertar documentos por lotes y recrear sus índices.

use mongodb::bson::{Bson, Document, RawDocumentBuf, doc};
use mongodb::error::{Error, ErrorKind};
use mongodb::options::InsertManyOptions;
use mongodb::results::InsertManyResult;
use mongodb::{Collection, Database};

use crate::jobs::CancelFlag;
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

/// Un lote de `insert_many` se envía al llegar a cualquiera de los dos topes.
const BATCH_DOCUMENTS: usize = 1000;
const BATCH_BYTES: usize = 8 * 1024 * 1024;
const DUPLICATE_KEY: i32 = 11000;
const NAMESPACE_EXISTS: i32 = 48;

/// Inserta documentos por lotes en una colección. Antes de cada lote mira la cancelación y el
/// safe mode del destino: activarlo a mitad para la escritura.
pub struct BatchWriter<'a> {
    coll: Collection<RawDocumentBuf>,
    safe_mode: &'a SafeMode,
    cancel: &'a CancelFlag,
    batch: Vec<RawDocumentBuf>,
    batch_bytes: usize,
    sent_bytes: u64,
    inserted: u64,
    duplicates: u64,
}

impl<'a> BatchWriter<'a> {
    pub fn new(db: &Database, collection: &str, safe_mode: &'a SafeMode, cancel: &'a CancelFlag) -> Self {
        Self {
            coll: db.collection(collection),
            safe_mode,
            cancel,
            batch: Vec::new(),
            batch_bytes: 0,
            sent_bytes: 0,
            inserted: 0,
            duplicates: 0,
        }
    }

    /// Añade un documento; `true` si con él se llenó y envió un lote.
    pub async fn push(&mut self, document: RawDocumentBuf) -> Result<bool, String> {
        self.batch_bytes += document.as_bytes().len();
        self.batch.push(document);
        if self.batch.len() < BATCH_DOCUMENTS && self.batch_bytes < BATCH_BYTES {
            return Ok(false);
        }
        self.flush().await?;
        Ok(true)
    }

    /// Envía lo que quede en el lote.
    pub async fn flush(&mut self) -> Result<(), String> {
        if self.batch.is_empty() {
            return Ok(());
        }
        self.cancel.check()?;
        self.safe_mode.ensure_writable()?;
        // Sin orden: un `_id` repetido no corta el resto del lote, como en `mongorestore`.
        let options = InsertManyOptions::builder().ordered(false).build();
        let sent = self.batch.len() as u64;
        let duplicates = duplicates_of(self.coll.insert_many(self.batch.drain(..), options).await)?;
        self.sent_bytes += self.batch_bytes as u64;
        self.batch_bytes = 0;
        self.inserted += sent - duplicates;
        self.duplicates += duplicates;
        Ok(())
    }

    /// Bytes BSON enviados hasta ahora.
    pub fn sent_bytes(&self) -> u64 {
        self.sent_bytes
    }

    /// Documentos enviados hasta ahora, insertados o saltados por `_id` repetido.
    pub fn sent_documents(&self) -> u64 {
        self.inserted + self.duplicates
    }

    pub fn inserted(&self) -> u64 {
        self.inserted
    }

    /// Documentos que no se insertaron porque su `_id` ya existía.
    pub fn duplicates(&self) -> u64 {
        self.duplicates
    }
}

/// Cuántos documentos del lote se saltaron por `_id` repetido; cualquier otro fallo es un error.
fn duplicates_of(result: Result<InsertManyResult, Error>) -> Result<u64, String> {
    let error = match result {
        Ok(_) => return Ok(0),
        Err(error) => error,
    };
    if let ErrorKind::BulkWrite(failure) = error.kind.as_ref()
        && failure.write_concern_error.is_none()
        && let Some(errors) = &failure.write_errors
        && errors.iter().all(|e| e.code == DUPLICATE_KEY)
    {
        return Ok(errors.len() as u64);
    }
    Err(describe(error))
}

/// Crea la colección con sus opciones (capped, validator, collation...); si ya existe se deja.
pub async fn create_collection(db: &Database, collection: &str, options: &Document) -> Result<(), String> {
    let mut command = doc! { "create": collection };
    command.extend(options.clone());
    match db.run_command(command, None).await {
        Ok(_) => Ok(()),
        Err(e) if command_code(&e) == Some(NAMESPACE_EXISTS) => Ok(()),
        Err(e) => Err(describe(e)),
    }
}

pub async fn create_indexes(db: &Database, collection: &str, indexes: &[Document]) -> Result<(), String> {
    if indexes.is_empty() {
        return Ok(());
    }
    let indexes: Vec<Bson> = indexes.iter().cloned().map(Bson::Document).collect();
    db.run_command(doc! { "createIndexes": collection, "indexes": indexes }, None)
        .await
        .map(|_| ())
        .map_err(|e| format!("Índices de “{collection}”: {}", describe(e)))
}

fn command_code(error: &Error) -> Option<i32> {
    match error.kind.as_ref() {
        ErrorKind::Command(c) => Some(c.code),
        _ => None,
    }
}
