//! Helpers nativos que usan los constructores de `bson_types.js` (generar ids, validar
//! enteros de 64 bits y decimales, base64 ↔ hex). Se pasan como argumento, nunca como global.

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64;
use mongodb::bson::oid::ObjectId;
use mongodb::bson::{Decimal128, Uuid};
use rquickjs::{Ctx, Exception, Function, Object};

pub fn natives<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<Object<'js>> {
    let natives = Object::new(ctx.clone())?;
    natives.set(
        "newObjectId",
        Function::new(ctx.clone(), || ObjectId::new().to_hex())?,
    )?;
    natives.set(
        "newUuid",
        Function::new(ctx.clone(), || hex(&Uuid::new().bytes()))?,
    )?;
    natives.set("parseInt64", Function::new(ctx.clone(), parse_int64)?)?;
    natives.set("parseDecimal", Function::new(ctx.clone(), parse_decimal)?)?;
    natives.set("base64ToHex", Function::new(ctx.clone(), base64_to_hex)?)?;
    natives.set("hexToBase64", Function::new(ctx.clone(), hex_to_base64)?)?;
    Ok(natives)
}

fn parse_int64(ctx: Ctx<'_>, text: String) -> rquickjs::Result<String> {
    text.parse::<i64>()
        .map(|n| n.to_string())
        .map_err(|_| Exception::throw_range(&ctx, "NumberLong: fuera del rango de 64 bits"))
}

fn parse_decimal(ctx: Ctx<'_>, text: String) -> rquickjs::Result<String> {
    text.parse::<Decimal128>()
        .map(|d| d.to_string())
        .map_err(|_| {
            Exception::throw_type(&ctx, &format!("NumberDecimal: valor no válido \"{text}\""))
        })
}

fn base64_to_hex(ctx: Ctx<'_>, text: String) -> rquickjs::Result<String> {
    BASE64
        .decode(text)
        .map(|bytes| hex(&bytes))
        .map_err(|_| Exception::throw_type(&ctx, "BinData: base64 no válido"))
}

fn hex_to_base64(ctx: Ctx<'_>, text: String) -> rquickjs::Result<String> {
    from_hex(&text)
        .map(|bytes| BASE64.encode(bytes))
        .ok_or_else(|| Exception::throw_type(&ctx, "hexadecimal no válido"))
}

fn hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn from_hex(text: &str) -> Option<Vec<u8>> {
    if !text.len().is_multiple_of(2) {
        return None;
    }
    (0..text.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(text.get(i..i + 2)?, 16).ok())
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_round_trip() {
        assert_eq!(hex(&[0x00, 0xab, 0xff]), "00abff");
        assert_eq!(from_hex("00ABff"), Some(vec![0x00, 0xab, 0xff]));
        assert_eq!(from_hex("abc"), None);
        assert_eq!(from_hex("zz"), None);
    }
}
