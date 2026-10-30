//! `MongoBridge` de prueba: las nativas son el objeto JS de `fake_natives.js` y el lado Rust
//! solo recuerda qué cursores pidió conservar la sesión.

use std::cell::RefCell;
use std::rc::Rc;

use rquickjs::{Ctx, Object};

use crate::shell::bridge::MongoBridge;
use crate::shell::outcome::{CursorBatch, CursorId};

const FAKE_NATIVES: &str = include_str!("fake_natives.js");
const NOT_SUPPORTED: &str = "el puente falso no pagina desde Rust";

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

    fn close_cursor(&self, _: CursorId) {}

    fn retain_cursors(&self, keep: &[CursorId]) {
        *self.retained.borrow_mut() = keep.to_vec();
    }
}
