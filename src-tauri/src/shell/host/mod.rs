//! Globales del shell clásico que no son de la base de datos: `sleep(ms)` (cancelable),
//! `load(ruta)`, `hex_md5(texto)` y `Object.bsonsize(doc)`. La carpeta del script abierto, para
//! las rutas relativas de `load`, se fija antes de cada ejecución.

mod script_path;

use std::cell::RefCell;
use std::path::PathBuf;
use std::rc::Rc;
use std::time::Duration;

use md5::{Digest, Md5};
use mongodb::bson::{Bson, RawDocumentBuf};
use rquickjs::context::EvalOptions;
use rquickjs::{Ctx, Exception, Function, Object, Value};

use super::convert::js_to_bson;
use super::module::ShellModule;
use super::watchdog::Watchdog;

const INTERRUPTED: &str = "sleep: ejecución interrumpida";
const NOT_A_DOCUMENT: &str = "Object.bsonsize: se esperaba un documento";

#[derive(Clone)]
pub struct Host {
    watchdog: Watchdog,
    script_dir: Rc<RefCell<Option<PathBuf>>>,
}

impl Host {
    pub fn new(watchdog: Watchdog) -> Self {
        Self {
            watchdog,
            script_dir: Rc::default(),
        }
    }

    /// Carpeta del script de la pestaña (`None` si no está guardado en disco).
    pub fn set_script_dir(&self, dir: Option<PathBuf>) {
        *self.script_dir.borrow_mut() = dir;
    }

    fn load<'js>(&self, ctx: &Ctx<'js>, path: &str) -> rquickjs::Result<bool> {
        let path = script_path::resolve(self.script_dir.borrow().as_deref(), path)
            .map_err(|e| Exception::throw_message(ctx, &e))?;
        let code = std::fs::read_to_string(&path).map_err(|e| {
            Exception::throw_message(ctx, &format!("load: no se pudo leer {}: {e}", path.display()))
        })?;
        let mut options = EvalOptions::default();
        options.global = true;
        options.filename = Some(path.display().to_string());
        ctx.eval_with_options::<Value, _>(code, options)?;
        Ok(true)
    }
}

impl ShellModule for Host {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let globals = ctx.globals();

        let watchdog = self.watchdog.clone();
        let sleep = move |ctx: Ctx<'_>, ms: f64| {
            watchdog
                .sleep(Duration::from_millis(ms.max(0.0) as u64))
                .map_err(|_| Exception::throw_message(&ctx, INTERRUPTED))
        };
        globals.set("sleep", Function::new(ctx.clone(), sleep)?)?;

        let host = self.clone();
        let load = move |ctx: Ctx<'_>, path: String| host.load(&ctx, &path);
        globals.set("load", Function::new(ctx.clone(), load)?)?;

        let hex_md5 = |text: String| format!("{:x}", Md5::digest(text.as_bytes()));
        globals.set("hex_md5", Function::new(ctx.clone(), hex_md5)?)?;

        let object: Object = globals.get("Object")?;
        object.set("bsonsize", Function::new(ctx.clone(), bson_size)?)?;
        Ok(())
    }
}

/// Bytes que ocupa el documento en BSON, como `Object.bsonsize` del shell clásico.
fn bson_size<'js>(ctx: Ctx<'js>, value: Value<'js>) -> rquickjs::Result<f64> {
    let Bson::Document(document) = js_to_bson(&ctx, &value)? else {
        return Err(Exception::throw_type(&ctx, NOT_A_DOCUMENT));
    };
    let raw = RawDocumentBuf::from_document(&document)
        .map_err(|e| Exception::throw_message(&ctx, &e.to_string()))?;
    Ok(raw.as_bytes().len() as f64)
}
