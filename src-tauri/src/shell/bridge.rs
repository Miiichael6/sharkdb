//! Puerto entre la API del shell (`prelude.js`) y la base de datos. En producción lo implementa
//! `native::MongoNatives` con el driver; en los tests, un objeto JS falso.

use rquickjs::{Ctx, Object};

use super::outcome::{CursorBatch, CursorId};

pub trait MongoBridge {
    /// Objeto `native` que recibe `prelude.js`: `find`, `aggregate`, `runCommand`, `cursorNext`
    /// y `cursorClose`.
    fn natives<'js>(&self, ctx: &Ctx<'js>) -> rquickjs::Result<Object<'js>>;

    /// Siguiente lote de un cursor que quedó abierto como resultado de un script.
    fn next_batch(&self, cursor: CursorId, size: usize) -> Result<CursorBatch, String>;

    fn close_cursor(&self, cursor: CursorId);

    /// Cierra todos los cursores salvo los indicados (los que el frontend va a paginar).
    fn retain_cursors(&self, keep: &[CursorId]);
}
