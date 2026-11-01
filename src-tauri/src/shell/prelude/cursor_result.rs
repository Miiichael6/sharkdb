//! Cursor que queda como valor de una sentencia → `ScriptOutput::Cursor`. Lo que el script ya
//! había leído viene de JS; el resto del primer lote se lee del puente en BSON, sin convertir
//! los documentos a valores de QuickJS y de vuelta.

use mongodb::bson::Bson;
use rquickjs::function::This;
use rquickjs::{Ctx, Function, Object, Value};

use crate::shell::bridge::MongoBridge;
use crate::shell::convert::js_to_bson;
use crate::shell::errors::describe_thrown;
use crate::shell::outcome::{CursorId, ScriptError, ScriptErrorKind, ScriptOutput};

/// Método del `Cursor` de `cursor.js` que lo marca como agotado.
const EXHAUST: &str = "_exhaust";

/// Lo que `Cursor._take` describe: lo ya leído y cuántos documentos faltan para el primer lote.
struct DescribedCursor<'js> {
    ns: String,
    id: Option<CursorId>,
    documents: Vec<Bson>,
    exhausted: bool,
    missing: usize,
    cursor: Object<'js>,
}

impl<'js> DescribedCursor<'js> {
    fn read(ctx: &Ctx<'js>, described: &Object<'js>) -> rquickjs::Result<Self> {
        let documents: Vec<Value> = described.get("documents")?;
        Ok(Self {
            ns: described.get("ns")?,
            id: described.get("id")?,
            documents: documents
                .iter()
                .map(|doc| js_to_bson(ctx, doc))
                .collect::<rquickjs::Result<_>>()?,
            exhausted: described.get("exhausted")?,
            missing: described.get("missing")?,
            cursor: described.get("cursor")?,
        })
    }

    /// El cursor JS deja de apuntar al del servidor, que el puente ya soltó.
    fn exhaust(&mut self) -> rquickjs::Result<()> {
        let exhaust: Function = self.cursor.get(EXHAUST)?;
        exhaust.call::<_, ()>((This(self.cursor.clone()),))?;
        self.id = None;
        self.exhausted = true;
        Ok(())
    }
}

pub fn cursor_result<'js>(
    ctx: &Ctx<'js>,
    described: &Object<'js>,
    bridge: &dyn MongoBridge,
) -> Result<ScriptOutput, ScriptError> {
    let script_error = || describe_thrown(ctx, ctx.catch(), ScriptErrorKind::Script);
    let mut cursor = DescribedCursor::read(ctx, described).map_err(|_| script_error())?;
    if let Some(id) = cursor.id.filter(|_| cursor.missing > 0) {
        let batch = bridge
            .result_batch(ctx, id, cursor.missing)
            .map_err(|message| ScriptError::new(ScriptErrorKind::Script, message))?;
        cursor.documents.extend(batch.documents);
        if batch.exhausted {
            cursor.exhaust().map_err(|_| script_error())?;
        }
    }
    Ok(ScriptOutput::Cursor {
        ns: cursor.ns,
        cursor_id: cursor.id,
        documents: cursor.documents,
        exhausted: cursor.exhausted,
    })
}
