//! API del shell (`db`, colecciones, cursores). Las clases viven en `prelude.js`; aquí se
//! instalan sobre las nativas de un `MongoBridge` y se traducen los ganchos de cada ejecución.

use std::rc::Rc;

use rquickjs::{Ctx, Function, Object, Value};

use super::bridge::MongoBridge;
use super::convert::js_to_bson;
use super::errors::{describe_thrown, to_bson_reported};
use super::module::{RunHooks, ShellModule};
use super::outcome::{CursorId, ScriptError, ScriptErrorKind, ScriptOutput};

const SOURCE: &str = include_str!("prelude.js");
/// Global oculto con los ganchos que define `prelude.js`.
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
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((self.bridge.natives(ctx)?,))
    }
}

/// Una ejecución sobre la base de datos `db`; el valor final que sea un cursor se entrega con
/// un primer lote de `first_batch` documentos.
pub struct ShellRun<'a> {
    pub db: &'a str,
    pub first_batch: usize,
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
            "cursor" => cursor_result(ctx, &described).map_err(|_| script_error())?,
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

fn cursor_result<'js>(ctx: &Ctx<'js>, described: &Object<'js>) -> rquickjs::Result<ScriptOutput> {
    let documents: Vec<Value> = described.get("documents")?;
    Ok(ScriptOutput::Cursor {
        ns: described.get("ns")?,
        cursor_id: described.get::<_, Option<CursorId>>("id")?,
        documents: documents
            .iter()
            .map(|doc| js_to_bson(ctx, doc))
            .collect::<rquickjs::Result<_>>()?,
        exhausted: described.get("exhausted")?,
    })
}
