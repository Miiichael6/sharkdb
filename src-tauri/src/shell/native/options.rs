//! Opciones de `find` y `aggregate` tal como las pasa `prelude.js` (un documento con los
//! nombres del shell: `skip`, `batchSize`, `maxTimeMS`...) → opciones del driver.

use std::time::Duration;

use mongodb::bson::{Bson, Document};
use mongodb::options::{AggregateOptions, FindOptions, Hint};

pub fn find_options(spec: &Document) -> Result<FindOptions, String> {
    let mut options = FindOptions::default();
    for (key, value) in present(spec) {
        match key {
            "projection" => options.projection = Some(document(key, value)?),
            "sort" => options.sort = Some(document(key, value)?),
            "skip" => options.skip = Some(non_negative(key, value)?),
            "limit" => options.limit = Some(integer(key, value)?),
            "batchSize" => options.batch_size = Some(batch_size(value)?),
            "hint" => options.hint = Some(hint(value)?),
            "maxTimeMS" => options.max_time = Some(max_time(value)?),
            other => return Err(unsupported("find", other)),
        }
    }
    Ok(options)
}

pub fn aggregate_options(spec: &Document) -> Result<AggregateOptions, String> {
    let mut options = AggregateOptions::default();
    for (key, value) in present(spec) {
        match key {
            "allowDiskUse" => options.allow_disk_use = Some(boolean(key, value)?),
            "batchSize" => options.batch_size = Some(batch_size(value)?),
            "hint" => options.hint = Some(hint(value)?),
            "maxTimeMS" => options.max_time = Some(max_time(value)?),
            other => return Err(unsupported("aggregate", other)),
        }
    }
    Ok(options)
}

/// Las opciones a `null` se tratan como ausentes.
fn present(spec: &Document) -> impl Iterator<Item = (&str, &Bson)> {
    spec.iter()
        .filter(|(_, value)| !matches!(value, Bson::Null))
        .map(|(key, value)| (key.as_str(), value))
}

fn unsupported(operation: &str, option: &str) -> String {
    format!("{operation}: opción no soportada \"{option}\"")
}

fn document(key: &str, value: &Bson) -> Result<Document, String> {
    match value {
        Bson::Document(doc) => Ok(doc.clone()),
        _ => Err(format!("{key}: se esperaba un objeto")),
    }
}

fn boolean(key: &str, value: &Bson) -> Result<bool, String> {
    value
        .as_bool()
        .ok_or_else(|| format!("{key}: se esperaba true o false"))
}

/// Los números de JS llegan como Double; se aceptan si son enteros.
fn integer(key: &str, value: &Bson) -> Result<i64, String> {
    let not_integer = || format!("{key}: se esperaba un número entero");
    match value {
        Bson::Int32(n) => Ok(i64::from(*n)),
        Bson::Int64(n) => Ok(*n),
        Bson::Double(n) if n.fract() == 0.0 && n.is_finite() => Ok(*n as i64),
        _ => Err(not_integer()),
    }
}

fn non_negative(key: &str, value: &Bson) -> Result<u64, String> {
    u64::try_from(integer(key, value)?).map_err(|_| format!("{key}: no puede ser negativo"))
}

fn batch_size(value: &Bson) -> Result<u32, String> {
    let key = "batchSize";
    u32::try_from(non_negative(key, value)?).map_err(|_| format!("{key}: demasiado grande"))
}

fn max_time(value: &Bson) -> Result<Duration, String> {
    non_negative("maxTimeMS", value).map(Duration::from_millis)
}

fn hint(value: &Bson) -> Result<Hint, String> {
    match value {
        Bson::String(name) => Ok(Hint::Name(name.clone())),
        Bson::Document(keys) => Ok(Hint::Keys(keys.clone())),
        _ => Err("hint: se esperaba el nombre del índice o sus claves".into()),
    }
}

#[cfg(test)]
mod tests {
    use mongodb::bson::doc;

    use super::*;

    #[test]
    fn maps_shell_names_and_js_numbers() {
        let options = find_options(&doc! {
            "sort": { "_id": -1.0 },
            "skip": 10.0,
            "limit": 5.0,
            "batchSize": 50,
            "hint": "a_1",
            "maxTimeMS": 1500.0,
            "projection": null,
        })
        .unwrap();
        assert_eq!(options.sort, Some(doc! { "_id": -1.0 }));
        assert_eq!(options.skip, Some(10));
        assert_eq!(options.limit, Some(5));
        assert_eq!(options.batch_size, Some(50));
        assert!(matches!(options.hint, Some(Hint::Name(ref n)) if n == "a_1"));
        assert_eq!(options.max_time, Some(Duration::from_millis(1500)));
        assert_eq!(options.projection, None);
    }

    #[test]
    fn rejects_invalid_or_unknown_options() {
        assert!(find_options(&doc! { "skip": -1.0 }).is_err());
        assert!(find_options(&doc! { "limit": 1.5 }).is_err());
        assert!(find_options(&doc! { "sort": "a" }).is_err());
        assert!(find_options(&doc! { "nope": 1 }).is_err());
        assert!(aggregate_options(&doc! { "skip": 1 }).is_err());
        assert_eq!(
            aggregate_options(&doc! { "allowDiskUse": true })
                .unwrap()
                .allow_disk_use,
            Some(true)
        );
    }
}
