//! Conversión exacta entre valores JS del motor y BSON. Los números JS se guardan como mongosh:
//! Int32 si son enteros de 32 bits y Double si no; Int32/Int64/Decimal128 leídos viajan como
//! `NumberInt`/`NumberLong`/`NumberDecimal`.

mod to_bson;
mod to_js;

pub use to_bson::js_to_bson;
pub use to_js::bson_to_js;
