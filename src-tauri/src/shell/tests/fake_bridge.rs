//! `MongoBridge` de prueba: las nativas son el objeto JS de `fake_natives.js` y el lado Rust
//! recuerda qué cursores pidió conservar la sesión y lee de ese objeto los lotes resultado.

use std::cell::RefCell;
use std::rc::Rc;
use std::time::Duration;

use rquickjs::{Ctx, Function, Object, Value};

use crate::shell::bridge::MongoBridge;
use crate::shell::convert::js_to_bson;
use crate::shell::outcome::{CursorBatch, CursorId};

const FAKE_NATIVES: &str = include_str!("fake_natives.js");
const NOT_SUPPORTED: &str = "el puente falso no pagina desde Rust";
/// Global donde `fake_natives.js` deja su objeto de nativas.
const NATIVES_GLOBAL: &str = "__natives";

#[derive(Default)]
pub struct FakeBridge {
    pub retained: RefCell<Vec<CursorId>>,
}

impl FakeBridge {
    pub fn shared() -> Rc<Self> {
        Rc::new(Self::default())
    }
}

impl MongoBridge for FakeBridge {
    fn natives<'js>(&self, ctx: &Ctx<'js>) -> rquickjs::Result<Object<'js>> {
        ctx.eval(FAKE_NATIVES)
    }

    fn next_batch(&self, _: CursorId, _: usize) -> Result<CursorBatch, String> {
        Err(NOT_SUPPORTED.into())
    }

    fn result_batch<'js>(
        &self,
        ctx: &Ctx<'js>,
        cursor: CursorId,
        size: usize,
    ) -> Result<CursorBatch, String> {
        read_from_js(ctx, cursor, size).map_err(|e| e.to_string())
    }

    fn close_cursor(&self, _: CursorId) {}

    fn retain_cursors(&self, keep: &[CursorId]) {
        *self.retained.borrow_mut() = keep.to_vec();
    }

    fn take_query_time(&self) -> Option<Duration> {
        None
    }
}

fn read_from_js<'js>(
    ctx: &Ctx<'js>,
    cursor: CursorId,
    size: usize,
) -> rquickjs::Result<CursorBatch> {
    let natives: Object = ctx.globals().get(NATIVES_GLOBAL)?;
    let cursor_next: Function = natives.get("cursorNext")?;
    let batch: Object = cursor_next.call((cursor, size))?;
    let documents: Vec<Value> = batch.get("documents")?;
    Ok(CursorBatch {
        documents: documents
            .iter()
            .map(|document| js_to_bson(ctx, document))
            .collect::<rquickjs::Result<_>>()?,
        exhausted: batch.get("exhausted")?,
    })
}
