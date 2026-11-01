//! Contratos entre el motor y lo que se le enchufa. El motor solo conoce estas interfaces, así
//! añadir globales o cambiar cómo se interpreta el valor final no lo toca.

use rquickjs::{Ctx, Value};

use super::outcome::{ScriptError, ScriptOutput};

/// Módulo que el motor instala en cada contexto JS nuevo (tipos BSON, `print`, API `db`...).
pub trait ShellModule {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()>;
}

/// Lo que se hace antes de cada script y cómo se traduce el valor de cada sentencia.
pub trait RunHooks {
    fn before_run(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()>;

    /// `None` si la sentencia no deja nada que mostrar (`undefined`).
    fn final_result<'js>(
        &self,
        ctx: &Ctx<'js>,
        value: Value<'js>,
    ) -> Result<Option<ScriptOutput>, ScriptError>;
}
