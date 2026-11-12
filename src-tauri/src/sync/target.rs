//! Reglas sobre el destino de un sync que no dependen del servidor: nunca es el origen y, para
//! documentos sueltos, siempre es de un entorno de menor nivel (D26).

use mongodb::bson::Bson;

pub const SAME_CONNECTION: &str = "El destino no puede ser la conexión de origen";
pub const SAME_COLLECTION: &str =
    "El destino es la misma colección que el origen (las dos conexiones apuntan al mismo servidor)";

pub const NOT_LOWER_LEVEL: &str =
    "Solo se sincronizan documentos hacia un entorno de menor nivel: prod → QA o local, QA → local";

const PRODUCTION_LEVEL: u8 = 3;
const QA_LEVEL: u8 = 2;
const LOCAL_LEVEL: u8 = 1;

/// Nivel del entorno por su etiqueta, como en el frontend (`environmentLevel.ts`): `production` 3,
/// `testing`/`staging` 2, `local`/`development` 1. Sin etiqueta conocida, None: no se sincroniza.
pub fn environment_level(tag: Option<&str>) -> Option<u8> {
    match tag? {
        "production" => Some(PRODUCTION_LEVEL),
        "testing" | "staging" => Some(QA_LEVEL),
        "local" | "development" => Some(LOCAL_LEVEL),
        _ => None,
    }
}

/// Error salvo que el destino sea de un nivel menor que el origen (R104): nunca el mismo ni uno superior.
pub fn ensure_lower_level(source_tag: Option<&str>, target_tag: Option<&str>) -> Result<(), String> {
    match (environment_level(source_tag), environment_level(target_tag)) {
        (Some(source), Some(target)) if target < source => Ok(()),
        _ => Err(NOT_LOWER_LEVEL.into()),
    }
}

/// Error si origen y destino son la misma conexión: cada BD va a la de su mismo nombre, así que sería ella misma.
pub fn ensure_distinct_connections(source_sid: &str, target_sid: &str) -> Result<(), String> {
    if source_sid == target_sid { Err(SAME_CONNECTION.into()) } else { Ok(()) }
}

/// Error si la colección de destino es la de origen vista por otra conexión (mismo UUID).
pub fn ensure_distinct_collections(source: Option<&Bson>, target: Option<&Bson>) -> Result<(), String> {
    match (source, target) {
        (Some(source), Some(target)) if source == target => Err(SAME_COLLECTION.into()),
        _ => Ok(()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::{Binary, spec::BinarySubtype};

    fn uuid(byte: u8) -> Bson {
        Bson::Binary(Binary { subtype: BinarySubtype::Uuid, bytes: vec![byte; 16] })
    }

    #[test]
    fn the_source_connection_is_rejected_as_destination() {
        assert_eq!(ensure_distinct_connections("prod", "prod"), Err(SAME_CONNECTION.into()));
        assert!(ensure_distinct_connections("prod", "qa").is_ok());
    }

    #[test]
    fn documents_only_go_to_a_lower_environment() {
        for (source, target) in [("production", "testing"), ("production", "local"), ("staging", "development"), ("testing", "local")] {
            assert!(ensure_lower_level(Some(source), Some(target)).is_ok(), "{source} → {target}");
        }
        for (source, target) in [("testing", "production"), ("local", "testing"), ("testing", "staging"), ("local", "local"), ("production", "production")] {
            assert_eq!(ensure_lower_level(Some(source), Some(target)), Err(NOT_LOWER_LEVEL.into()), "{source} → {target}");
        }
        assert!(ensure_lower_level(None, Some("local")).is_err());
        assert!(ensure_lower_level(Some("production"), Some("other")).is_err());
    }

    #[test]
    fn the_same_physical_collection_is_rejected() {
        assert_eq!(ensure_distinct_collections(Some(&uuid(1)), Some(&uuid(1))), Err(SAME_COLLECTION.into()));
        assert!(ensure_distinct_collections(Some(&uuid(1)), Some(&uuid(2))).is_ok());
        // El destino aún no existe, o un servidor antiguo no da UUID.
        assert!(ensure_distinct_collections(Some(&uuid(1)), None).is_ok());
        assert!(ensure_distinct_collections(None, None).is_ok());
    }
}
