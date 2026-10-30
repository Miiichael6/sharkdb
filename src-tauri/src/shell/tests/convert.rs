use mongodb::bson::oid::ObjectId;
use mongodb::bson::spec::BinarySubtype;
use mongodb::bson::{
    Binary, Bson, DateTime, Decimal128, JavaScriptCodeWithScope, Regex, Timestamp, doc,
};

use super::engine;
use crate::shell::convert::{bson_to_js, js_to_bson};

fn all_types() -> Vec<Bson> {
    vec![
        Bson::Double(1.5),
        Bson::Double(3.0),
        Bson::String("hola".into()),
        Bson::Boolean(true),
        Bson::Null,
        Bson::Int32(-7),
        Bson::Int64(9_007_199_254_740_993), // > 2^53: no cabe en un número JS
        Bson::Decimal128("123.4500".parse::<Decimal128>().unwrap()),
        Bson::ObjectId(ObjectId::parse_str("65a1b2c3d4e5f6a7b8c9d0e1").unwrap()),
        Bson::DateTime(DateTime::from_millis(1_704_164_645_123)),
        Bson::Binary(Binary {
            subtype: BinarySubtype::Generic,
            bytes: vec![0, 1, 254, 255],
        }),
        Bson::Binary(Binary {
            subtype: BinarySubtype::Uuid,
            bytes: (0..16).collect(),
        }),
        Bson::Timestamp(Timestamp {
            time: 1_700_000_000,
            increment: 3,
        }),
        Bson::RegularExpression(Regex {
            pattern: "^a.c$".into(),
            options: "im".into(),
        }),
        Bson::RegularExpression(Regex {
            pattern: "a b".into(),
            options: "ix".into(),
        }),
        Bson::JavaScriptCode("function () { return 1; }".into()),
        Bson::JavaScriptCodeWithScope(JavaScriptCodeWithScope {
            code: "x + 1".into(),
            scope: doc! { "x": 1.0 },
        }),
        Bson::MinKey,
        Bson::MaxKey,
        Bson::Array(vec![Bson::Int32(1), Bson::String("dos".into())]),
        Bson::Document(doc! { "z": 1.0, "a": { "nested": [ { "deep": Bson::Int64(5) } ] } }),
    ]
}

/// Evalúa `code` y convierte el resultado a BSON.
fn eval_to_bson(code: &str) -> Bson {
    let outcome = engine().run(code);
    assert_eq!(outcome.error, None, "script: {code}");
    outcome.value.expect("valor")
}

#[test]
fn every_bson_type_survives_round_trip() {
    let engine = engine();
    engine.with_context(|ctx| {
        for original in all_types() {
            let js = bson_to_js(&ctx, &original).unwrap();
            assert_eq!(js_to_bson(&ctx, &js).unwrap(), original);
        }
    });
}

#[test]
fn documents_keep_key_order() {
    let original = doc! { "b": 1.0, "a": 2.0, "c": { "y": 1.0, "x": 2.0 } };
    engine().with_context(|ctx| {
        let js = bson_to_js(&ctx, &Bson::Document(original.clone())).unwrap();
        let Bson::Document(back) = js_to_bson(&ctx, &js).unwrap() else {
            panic!()
        };
        assert_eq!(back.keys().collect::<Vec<_>>(), ["b", "a", "c"]);
        assert_eq!(back, original);
    });
}

#[test]
fn js_numbers_become_doubles_like_the_shell() {
    assert_eq!(
        eval_to_bson("({ n: 5, f: 2.5 })"),
        Bson::Document(doc! { "n": 5.0, "f": 2.5 })
    );
    assert_eq!(eval_to_bson("NumberInt(5)"), Bson::Int32(5));
    assert_eq!(
        eval_to_bson("NumberLong('9223372036854775807')"),
        Bson::Int64(i64::MAX)
    );
}

#[test]
fn shell_constructors_build_bson_types() {
    assert_eq!(
        eval_to_bson("ObjectId('65A1B2C3D4E5F6A7B8C9D0E1')"),
        Bson::ObjectId(ObjectId::parse_str("65a1b2c3d4e5f6a7b8c9d0e1").unwrap())
    );
    // Sin zona horaria se interpreta en UTC, como el shell.
    assert_eq!(
        eval_to_bson("ISODate('2024-01-02T03:04:05')"),
        Bson::DateTime(DateTime::parse_rfc3339_str("2024-01-02T03:04:05Z").unwrap())
    );
    assert_eq!(
        eval_to_bson("UUID('00112233-4455-6677-8899-aabbccddeeff')"),
        Bson::Binary(Binary {
            subtype: BinarySubtype::Uuid,
            bytes: (0..16).map(|i| i * 0x11).collect(),
        })
    );
    assert_eq!(
        eval_to_bson("/ab+c/gi"),
        Bson::RegularExpression(Regex {
            pattern: "ab+c".into(),
            options: "i".into()
        })
    );
    assert_eq!(eval_to_bson("MinKey() === MinKey()"), Bson::Boolean(true));
    assert_eq!(
        eval_to_bson("({ u: undefined })"),
        Bson::Document(doc! { "u": Bson::Null })
    );
}

#[test]
fn invalid_constructor_arguments_throw() {
    for code in [
        "ObjectId('xyz')",
        "ISODate('no es fecha')",
        "NumberLong('99999999999999999999')",
        "NumberDecimal('abc')",
        "UUID('123')",
        "BinData(300, '')",
    ] {
        let outcome = engine().run(code);
        assert!(outcome.error.is_some(), "debería fallar: {code}");
    }
}

#[test]
fn circular_objects_are_rejected_not_overflowed() {
    let outcome = engine().run("var a = {}; a.self = a; a");
    let error = outcome.error.expect("error de conversión");
    assert!(error.message.contains("anidado"), "{}", error.message);
}
