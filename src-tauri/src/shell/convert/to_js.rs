//! BSON → JS. Los tipos sin equivalente nativo se crean con los constructores del shell.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use mongodb::bson::{Bson, Document};
use rquickjs::function::{Constructor, IntoArgs};
use rquickjs::{Array, Ctx, Exception, Object, Value};

use crate::shell::bson_types::BsonTag;

/// Opciones de regex BSON que también entiende `RegExp` de JS.
const JS_REGEX_OPTIONS: &str = "imsu";

pub fn bson_to_js<'js>(ctx: &Ctx<'js>, bson: &Bson) -> rquickjs::Result<Value<'js>> {
    Ok(match bson {
        Bson::Double(n) => Value::new_float(ctx.clone(), *n),
        Bson::String(s) | Bson::Symbol(s) => {
            rquickjs::String::from_str(ctx.clone(), s)?.into_value()
        }
        Bson::Boolean(b) => Value::new_bool(ctx.clone(), *b),
        Bson::Null => Value::new_null(ctx.clone()),
        Bson::Undefined => Value::new_undefined(ctx.clone()),
        Bson::Array(items) => array(ctx, items)?,
        Bson::Document(document) => document_to_js(ctx, document)?.into_value(),
        Bson::RegularExpression(regex) => {
            let tag = if regex.options.chars().all(|c| JS_REGEX_OPTIONS.contains(c)) {
                BsonTag::RegExp
            } else {
                BsonTag::BsonRegExp
            };
            construct(ctx, tag, (regex.pattern.as_str(), regex.options.as_str()))?
        }
        Bson::JavaScriptCode(code) => construct(ctx, BsonTag::Code, (code.as_str(),))?,
        Bson::JavaScriptCodeWithScope(code) => construct(
            ctx,
            BsonTag::Code,
            (code.code.as_str(), document_to_js(ctx, &code.scope)?),
        )?,
        Bson::Int32(n) => construct(ctx, BsonTag::NumberInt, (*n,))?,
        Bson::Int64(n) => construct(ctx, BsonTag::NumberLong, (n.to_string(),))?,
        Bson::Timestamp(ts) => construct(ctx, BsonTag::Timestamp, (ts.time, ts.increment))?,
        Bson::Binary(binary) => construct(
            ctx,
            BsonTag::BinData,
            (u8::from(binary.subtype), BASE64.encode(&binary.bytes)),
        )?,
        Bson::ObjectId(oid) => construct(ctx, BsonTag::ObjectId, (oid.to_hex(),))?,
        Bson::DateTime(date) => construct(ctx, BsonTag::Date, (date.timestamp_millis() as f64,))?,
        Bson::Decimal128(decimal) => {
            construct(ctx, BsonTag::NumberDecimal, (decimal.to_string(),))?
        }
        Bson::MinKey => construct(ctx, BsonTag::MinKey, ())?,
        Bson::MaxKey => construct(ctx, BsonTag::MaxKey, ())?,
        Bson::DbPointer(_) => {
            return Err(Exception::throw_type(
                ctx,
                "el tipo BSON DBPointer no está soportado",
            ));
        }
    })
}

fn construct<'js>(
    ctx: &Ctx<'js>,
    tag: BsonTag,
    args: impl IntoArgs<'js>,
) -> rquickjs::Result<Value<'js>> {
    let constructor: Constructor = ctx.globals().get(tag.name())?;
    constructor.construct(args)
}

fn array<'js>(ctx: &Ctx<'js>, items: &[Bson]) -> rquickjs::Result<Value<'js>> {
    let array = Array::new(ctx.clone())?;
    for (i, item) in items.iter().enumerate() {
        array.set(i, bson_to_js(ctx, item)?)?;
    }
    Ok(array.into_value())
}

fn document_to_js<'js>(ctx: &Ctx<'js>, document: &Document) -> rquickjs::Result<Object<'js>> {
    let obj = Object::new(ctx.clone())?;
    for (key, value) in document {
        obj.set(key.as_str(), bson_to_js(ctx, value)?)?;
    }
    Ok(obj)
}
