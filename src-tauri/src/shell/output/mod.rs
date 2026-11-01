//! `print`, `printjson` y `tojson`: cada línea impresa se acumula como `ScriptOutput::Print` en
//! un buffer que el motor vacía tras cada sentencia, atribuyendo lo impreso a esa sentencia.

use std::cell::RefCell;
use std::rc::Rc;

use mongodb::bson::Bson;
use rquickjs::function::Opt;
use rquickjs::{Ctx, Function, Value};

use super::convert::js_to_bson;

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
    fn install<'js>(&self, ctx: &Ctx<'js>) -> rquickjs::Result<()> {
        let results = self.results.clone();
        let emit = Function::new(
            ctx.clone(),
            move |ctx: Ctx<'js>, text: String, values: Opt<Value<'js>>, json: Opt<bool>| {
                let values = values.0.map(|v| printed_values(&ctx, &v)).unwrap_or_default();
                let json = json.0.unwrap_or_default();
                results.borrow_mut().push(ScriptOutput::Print { text, values, json })
            },
        )?;
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((emit,))
    }
}

/// Los argumentos de `print` como BSON; vacío si alguno no se puede convertir (queda solo el texto).
fn printed_values<'js>(ctx: &Ctx<'js>, values: &Value<'js>) -> Vec<Bson> {
    match js_to_bson(ctx, values) {
        Ok(Bson::Array(items)) => items,
        _ => {
            // La conversión fallida deja una excepción pendiente que no es del script.
            ctx.catch();
            Vec::new()
        }
    }
}
