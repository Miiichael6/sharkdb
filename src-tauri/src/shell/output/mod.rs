//! `print`, `printjson` y `tojson`: cada línea impresa se acumula como `ScriptOutput::Print` en
//! un buffer que el motor vacía tras cada sentencia, atribuyendo lo impreso a esa sentencia.

use std::cell::RefCell;
use std::rc::Rc;

use rquickjs::{Ctx, Function};

use super::module::ShellModule;
use super::outcome::ScriptOutput;

const SOURCE: &str = include_str!("output.js");

#[derive(Default, Clone)]
pub struct Output {
    results: Rc<RefCell<Vec<ScriptOutput>>>,
}

impl Output {
    /// Devuelve lo impreso desde la última llamada y vacía el buffer.
    pub fn take(&self) -> Vec<ScriptOutput> {
        self.results.take()
    }
}

impl ShellModule for Output {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let results = self.results.clone();
        let emit = Function::new(ctx.clone(), move |text: String| {
            results.borrow_mut().push(ScriptOutput::Print { text })
        })?;
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((emit,))
    }
}
