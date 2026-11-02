//! Contratos entre el motor y lo que se le enchufa. El motor solo conoce estas interfaces, así
//! añadir globales o cambiar cómo se interpreta el valor final no lo toca.

use rquickjs::{Ctx, Object, Value};

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

    /// Como `final_result`, pero lo que haya que esperar del servidor puede quedar pendiente:
    /// el motor lanza las sentencias siguientes y lo completa después con `finish_result`, así
    /// sus consultas van en paralelo.
    fn begin_result<'js>(
        &self,
        ctx: &Ctx<'js>,
        value: Value<'js>,
    ) -> Result<Option<BegunResult<'js>>, ScriptError> {
        Ok(self.final_result(ctx, value)?.map(BegunResult::Ready))
    }

    /// Completa un `BegunResult::Pending`; solo lo llaman los ganchos que los dejan.
    fn finish_result<'js>(
        &self,
        _ctx: &Ctx<'js>,
        _pending: Object<'js>,
    ) -> Result<ScriptOutput, ScriptError> {
        unreachable!("estos ganchos no dejan resultados pendientes")
    }
}

pub enum BegunResult<'js> {
    Ready(ScriptOutput),
    /// Lo que describe el valor, para `RunHooks::finish_result`.
    Pending(Object<'js>),
}
