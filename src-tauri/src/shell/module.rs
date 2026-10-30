//! Contrato de los módulos que el motor instala en cada contexto JS nuevo (tipos BSON,
//! `print`...). El motor solo conoce esta interfaz, así añadir globales no lo toca.

use rquickjs::Ctx;

pub trait ShellModule {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()>;
}
