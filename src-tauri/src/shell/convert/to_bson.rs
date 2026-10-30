//! JS → BSON. Los objetos con `_bsontype` se decodifican según su tipo; el resto son documentos.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::spec::BinarySubtype;
use mongodb::bson::{
    Binary, Bson, DateTime, Decimal128, Document, JavaScriptCodeWithScope, Regex, Timestamp,
};
use rquickjs::function::This;
use rquickjs::{Coerced, Ctx, Exception, FromJs, Function, Object, Type, Value};

use crate::shell::bson_types::{BsonTag, field};

/// Límite de anidamiento de BSON; evita recursión infinita con objetos cíclicos.
const MAX_DEPTH: usize = 100;
/// Opciones de regex BSON válidas (las de JS como `g` o `y` no se guardan).
const BSON_REGEX_OPTIONS: &str = "ilmsux";

pub fn js_to_bson<'js>(ctx: &Ctx<'js>, value: &Value<'js>) -> rquickjs::Result<Bson> {
    to_bson(ctx, value, 0)
}

fn to_bson<'js>(ctx: &Ctx<'js>, value: &Value<'js>, depth: usize) -> rquickjs::Result<Bson> {
    if depth > MAX_DEPTH {
        return Err(Exception::throw_range(
            ctx,
            "documento demasiado anidado (¿referencia circular?)",
        ));
    }
    match value.type_of() {
        Type::Uninitialized | Type::Undefined | Type::Null => Ok(Bson::Null),
        Type::Bool => Ok(Bson::Boolean(value.as_bool().unwrap_or_default())),
        Type::Int | Type::Float => Ok(Bson::Double(value.as_number().unwrap_or_default())),
        Type::String => Ok(Bson::String(String::from_js(ctx, value.clone())?)),
        Type::BigInt => big_int(ctx, value),
        Type::Array => array(ctx, value, depth),
        Type::Function | Type::Constructor => {
            let Coerced(source) = Coerced::<String>::from_js(ctx, value.clone())?;
            Ok(Bson::JavaScriptCode(source))
        }
        Type::Object | Type::Exception | Type::Proxy | Type::Promise => {
            let obj = value.as_object().expect("type_of indica objeto");
            match obj.get::<_, Option<String>>(field::TAG)? {
                Some(tag) => tagged(ctx, obj, &tag, depth),
                None => document(ctx, obj, depth).map(Bson::Document),
            }
        }
        other => Err(Exception::throw_type(
            ctx,
            &format!("no se puede convertir a BSON un valor {other}"),
        )),
    }
}

fn big_int<'js>(ctx: &Ctx<'js>, value: &Value<'js>) -> rquickjs::Result<Bson> {
    match value.as_big_int().map(|n| n.clone().to_i64()) {
        Some(Ok(n)) => Ok(Bson::Int64(n)),
        _ => Err(Exception::throw_range(
            ctx,
            "BigInt fuera del rango de 64 bits",
        )),
    }
}

fn array<'js>(ctx: &Ctx<'js>, value: &Value<'js>, depth: usize) -> rquickjs::Result<Bson> {
    let array = value.as_array().expect("type_of indica array");
    let items = (0..array.len())
        .map(|i| to_bson(ctx, &array.get(i)?, depth + 1))
        .collect::<rquickjs::Result<_>>()?;
    Ok(Bson::Array(items))
}

fn document<'js>(ctx: &Ctx<'js>, obj: &Object<'js>, depth: usize) -> rquickjs::Result<Document> {
    let mut document = Document::new();
    for entry in obj.props::<String, Value>() {
        let (key, value) = entry?;
        document.insert(key, to_bson(ctx, &value, depth + 1)?);
    }
    Ok(document)
}

fn tagged<'js>(
    ctx: &Ctx<'js>,
    obj: &Object<'js>,
    tag: &str,
    depth: usize,
) -> rquickjs::Result<Bson> {
    let Some(tag) = BsonTag::parse(tag) else {
        return Err(Exception::throw_type(
            ctx,
            &format!("tipo BSON desconocido: {tag}"),
        ));
    };
    let invalid = |what: &str| Exception::throw_type(ctx, &format!("{}: {what}", tag.name()));
    Ok(match tag {
        BsonTag::ObjectId => {
            let hex: String = obj.get(field::OBJECT_ID_HEX)?;
            Bson::ObjectId(ObjectId::parse_str(hex).map_err(|_| invalid("hexadecimal no válido"))?)
        }
        BsonTag::Date => Bson::DateTime(date(obj).ok_or_else(|| invalid("fecha no válida"))??),
        BsonTag::RegExp => regex(obj.get("source")?, &obj.get::<_, String>("flags")?),
        BsonTag::BsonRegExp => regex(
            obj.get(field::PATTERN)?,
            &obj.get::<_, String>(field::OPTIONS)?,
        ),
        BsonTag::NumberLong => {
            let text: String = obj.get(field::VALUE)?;
            Bson::Int64(text.parse().map_err(|_| invalid("entero no válido"))?)
        }
        BsonTag::NumberInt => Bson::Int32(obj.get(field::VALUE)?),
        BsonTag::NumberDecimal => {
            let text: String = obj.get(field::VALUE)?;
            Bson::Decimal128(
                text.parse::<Decimal128>()
                    .map_err(|_| invalid("decimal no válido"))?,
            )
        }
        BsonTag::BinData => {
            let subtype: u8 = obj.get(field::SUBTYPE)?;
            let text: String = obj.get(field::BASE64)?;
            let bytes = BASE64
                .decode(text)
                .map_err(|_| invalid("base64 no válido"))?;
            Bson::Binary(Binary {
                subtype: BinarySubtype::from(subtype),
                bytes,
            })
        }
        BsonTag::Timestamp => Bson::Timestamp(Timestamp {
            time: obj.get(field::TIME)?,
            increment: obj.get(field::INCREMENT)?,
        }),
        BsonTag::Code => code(ctx, obj, depth)?,
        BsonTag::MinKey => Bson::MinKey,
        BsonTag::MaxKey => Bson::MaxKey,
    })
}

/// `None` si la fecha es `Invalid Date`.
fn date(obj: &Object<'_>) -> Option<rquickjs::Result<DateTime>> {
    let millis = obj
        .get::<_, Function>("getTime")
        .and_then(|get_time| get_time.call::<_, f64>((This(obj.clone()),)));
    match millis {
        Ok(ms) if !ms.is_finite() => None,
        Ok(ms) => Some(Ok(DateTime::from_millis(ms as i64))),
        Err(e) => Some(Err(e)),
    }
}

fn code<'js>(ctx: &Ctx<'js>, obj: &Object<'js>, depth: usize) -> rquickjs::Result<Bson> {
    let code: String = obj.get(field::CODE)?;
    let scope: Value = obj.get(field::SCOPE)?;
    if scope.is_undefined() || scope.is_null() {
        return Ok(Bson::JavaScriptCode(code));
    }
    match to_bson(ctx, &scope, depth + 1)? {
        Bson::Document(scope) => Ok(Bson::JavaScriptCodeWithScope(JavaScriptCodeWithScope {
            code,
            scope,
        })),
        _ => Err(Exception::throw_type(
            ctx,
            "Code: el scope debe ser un objeto",
        )),
    }
}

/// BSON exige las opciones ordenadas alfabéticamente y sin las propias de JS (`g`, `y`, `d`).
fn regex(pattern: String, flags: &str) -> Bson {
    let mut options: Vec<char> = flags
        .chars()
        .filter(|c| BSON_REGEX_OPTIONS.contains(*c))
        .collect();
    options.sort_unstable();
    options.dedup();
    Bson::RegularExpression(Regex {
        pattern,
        options: options.into_iter().collect(),
    })
}
