//! Puerto entre la API del shell (`prelude.js`) y la base de datos. En producción lo implementa
//! `native::MongoNatives` con el driver; en los tests, un objeto JS falso.

use std::time::Duration;

use mongodb::bson::Bson;
use rquickjs::{Ctx, Object};

use super::outcome::{CursorBatch, CursorId};

pub trait MongoBridge {
    /// Objeto `native` que recibe `prelude.js`: `find`, `aggregate`, `runCommand`, `cursorNext`
    /// y `cursorClose`.
    fn natives<'js>(&self, ctx: &Ctx<'js>) -> rquickjs::Result<Object<'js>>;

    /// Siguiente lote de un cursor que quedó abierto como resultado de un script.
    fn next_batch(&self, cursor: CursorId, size: usize) -> Result<CursorBatch, String>;

    /// Primer lote del cursor que queda como valor de una sentencia, leído durante el script y
    /// sin pasar sus documentos por JS.
    fn result_batch<'js>(
        &self,
        ctx: &Ctx<'js>,
        cursor: CursorId,
        size: usize,
    ) -> Result<CursorBatch, String>;

    /// Los últimos `count` documentos del último lote que leyó el script de `cursor`, tal como
    /// llegaron del servidor: lo que aún tenía en el buffer, sin pasar por JS (que no distingue
    /// `5.0` de `5`). `None` si no se guardó ese lote.
    fn buffered(&self, cursor: CursorId, count: usize) -> Option<Vec<Bson>>;

    fn close_cursor(&self, cursor: CursorId);

    /// Cierra todos los cursores salvo los indicados (los que el frontend va a paginar).
    fn retain_cursors(&self, keep: &[CursorId]);

    /// Tiempo esperando la respuesta del servidor desde la última llamada; `None` si no hubo
    /// consultas.
    fn take_query_time(&self) -> Option<Duration>;
}
