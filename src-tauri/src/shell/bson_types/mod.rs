//! Constructores BSON del shell (`ObjectId`, `ISODate`, `NumberLong`...). Las clases viven en
//! `bson_types.js`; `natives.rs` aporta lo que JS no sabe hacer y `tag.rs` el contrato con
//! `convert`.

mod natives;
mod tag;

use rquickjs::{Ctx, Function};

pub use tag::{BsonTag, field};

use super::module::ShellModule;

const SOURCE: &str = include_str!("bson_types.js");

pub struct BsonTypes;

impl ShellModule for BsonTypes {
    fn install(&self, ctx: &Ctx<'_>) -> rquickjs::Result<()> {
        let setup: Function = ctx.eval(SOURCE)?;
        setup.call((natives::natives(ctx)?,))
    }
}
