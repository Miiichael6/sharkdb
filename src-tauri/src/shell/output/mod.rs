//! `print`, `printjson` y `tojson`: cada línea impresa se acumula como `ScriptResult::Print` en
//! un buffer que el motor vacía en el `ScriptOutcome` de cada ejecución.

use std::cell::RefCell;
use std::rc::Rc;

use rquickjs::{Ctx, Function};

use super::module::ShellModule;
use super::outcome::ScriptResult;

const SOURCE: &str = include_str!("output.js");

#[derive(Default, Clone)]
pub struct Output {
    results: Rc<RefCell<Vec<ScriptResult>>>,
}

impl Output {
    /// Devuelve lo impreso desde la última llamada y vacía el buffer.
    pub fn take(&self) -> Vec<ScriptResult> {
        self.results.take()
    }
}

impl ShellModule for Output {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let results = self.results.clone();
        let emit = Function::new(ctx.clone(), move |text: String| {
            results.borrow_mut().push(ScriptResult::Print { text })
        })?;
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((emit,))
    }
}
