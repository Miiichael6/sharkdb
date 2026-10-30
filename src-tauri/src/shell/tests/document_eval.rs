use mongodb::bson::oid::ObjectId;
use mongodb::bson::{Bson, DateTime, doc};

use crate::shell::document_eval::evaluate;

#[test]
fn shell_constructors_keep_their_bson_types() {
    let eval = evaluate(
        "{\n  _id: ObjectId(\"65a1b2c3d4e5f6a7b8c9d0e1\"),\n  at: ISODate(\"2024-01-02T00:00:00Z\"),\n  n: NumberInt(5),\n  big: NumberLong(7),\n  x: 1.5\n}",
    );
    assert_eq!(eval.error, None);
    assert_eq!(
        eval.document,
        Some(Bson::Document(doc! {
            "_id": ObjectId::parse_str("65a1b2c3d4e5f6a7b8c9d0e1").unwrap(),
            "at": DateTime::from_millis(1_704_153_600_000),
            "n": 5_i32,
            "big": 7_i64,
            "x": 1.5,
        }))
    );
}

#[test]
fn accepts_a_trailing_semicolon_and_comment() {
    let eval = evaluate("{ a: 1 }; // fin");
    assert_eq!(eval.error, None);
    assert_eq!(eval.document, Some(Bson::Document(doc! { "a": 1.0 })));
}

#[test]
fn syntax_error_points_at_its_line() {
    let error = evaluate("{\n  a: 1,\n  b: \n}").error.expect("error");
    assert_eq!(error.line, Some(4));
    assert!(evaluate("{ a: }").error.unwrap().column >= Some(1));
}

#[test]
fn rejects_anything_but_a_document() {
    for text in ["[1, 2]", "42", "ObjectId()", ""] {
        let eval = evaluate(text);
        assert_eq!(eval.document, None, "{text}");
        assert!(eval.error.is_some(), "{text}");
    }
}

#[test]
fn has_no_database_access() {
    let error = evaluate("db.x.drop()").error.expect("error");
    assert!(error.message.contains("db"), "{}", error.message);
}
