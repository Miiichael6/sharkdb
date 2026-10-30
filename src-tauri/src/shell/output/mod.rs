//! `print`, `printjson` y `tojson`: las líneas impresas se acumulan en un buffer que el motor
//! vacía en el `ScriptOutcome` de cada ejecución.

use std::cell::RefCell;
use std::rc::Rc;

use rquickjs::{Ctx, Function};

use super::module::ShellModule;

const SOURCE: &str = include_str!("output.js");

#[derive(Default, Clone)]
pub struct Output {
    lines: Rc<RefCell<Vec<String>>>,
}

impl Output {
    /// Devuelve lo impreso desde la última llamada y vacía el buffer.
    pub fn take(&self) -> Vec<String> {
        self.lines.take()
    }
}

impl ShellModule for Output {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let lines = self.lines.clone();
        let emit = Function::new(ctx.clone(), move |line: String| {
            lines.borrow_mut().push(line)
        })?;
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((emit,))
    }
}
