//! API del shell (`db`, colecciones, cursores, bulk, `rs`/`sh`). Las clases viven en los `.js`
//! de esta carpeta, uno por área; aquí se instalan sobre las nativas de un `MongoBridge` y se
//! traducen los ganchos de cada ejecución.

mod cursor_result;

use std::rc::Rc;

use rquickjs::{Ctx, Function, Object, Value};

use self::cursor_result::cursor_result;
use super::bridge::MongoBridge;
use super::errors::{describe_thrown, to_bson_reported};
use super::module::{RunHooks, ShellModule};
use super::outcome::{ScriptError, ScriptErrorKind, ScriptOutput};

/// Piezas del prelude en orden de dependencia: cada una deja en `lib` lo que usan las siguientes.
const SOURCES: [&str; 8] = [
    include_str!("common.js"),
    include_str!("writes.js"),
    include_str!("cursor.js"),
    include_str!("bulk.js"),
    include_str!("collection.js"),
    include_str!("database.js"),
    include_str!("cluster.js"),
    include_str!("shell.js"),
];
/// Global oculto con los ganchos que define `shell.js`.
const SHELL_GLOBAL: &str = "__shell";

pub struct Prelude {
    bridge: Rc<dyn MongoBridge>,
}

impl Prelude {
    pub fn new(bridge: Rc<dyn MongoBridge>) -> Self {
        Self { bridge }
    }
}

impl ShellModule for Prelude {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let natives = self.bridge.natives(ctx)?;
        let lib = Object::new(ctx.clone())?;
        SOURCES.iter().try_for_each(|source| {
            let setup: Function = ctx.eval(*source)?;
            setup.call((natives.clone(), lib.clone()))
        })
    }
}

/// Una ejecución sobre la base de datos `db`; el valor final que sea un cursor se entrega con
/// un primer lote de `first_batch` documentos, leído de `bridge`.
pub struct ShellRun<'a> {
    pub db: &'a str,
    pub first_batch: usize,
    pub bridge: &'a dyn MongoBridge,
}

impl RunHooks for ShellRun<'_> {
    fn before_run(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        hook(ctx, "beginRun")?.call((self.db,))
    }

    fn final_result<'js>(
        &self,
        ctx: &Ctx<'js>,
        value: Value<'js>,
    ) -> Result<Option<ScriptOutput>, ScriptError> {
        let script_error = || describe_thrown(ctx, ctx.catch(), ScriptErrorKind::Script);
        let described: Value = hook(ctx, "describe")
            .and_then(|describe| describe.call((value, self.first_batch)))
            .map_err(|_| script_error())?;
        let Some(described) = described.into_object() else {
            return Ok(None);
        };
        let field = |name: &str| described.get::<_, Value>(name).map_err(|_| script_error());
        let kind: String = described.get("kind").map_err(|_| script_error())?;
        let result = match kind.as_str() {
            "cursor" => cursor_result(ctx, &described, self.bridge)?,
            "write" => ScriptOutput::Write {
                value: to_bson_reported(ctx, &field("value")?)?,
            },
            _ => ScriptOutput::Value {
                value: to_bson_reported(ctx, &field("value")?)?,
            },
        };
        Ok(Some(result))
    }
}

fn hook<'js>(ctx: &Ctx<'js>, name: &str) -> rquickjs::Result<Function<'js>> {
    ctx.globals().get::<_, Object>(SHELL_GLOBAL)?.get(name)
}
