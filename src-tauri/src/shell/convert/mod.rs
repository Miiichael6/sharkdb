//! Conversión exacta entre valores JS del motor y BSON. Los números JS se guardan como Double
//! (igual que el shell); Int32/Int64/Decimal128 viajan como `NumberInt`/`NumberLong`/`NumberDecimal`.

mod to_bson;
mod to_js;

pub use to_bson::js_to_bson;
pub use to_js::bson_to_js;
