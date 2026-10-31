//! Reglas sobre el destino de un sync que no dependen del servidor: nunca es el origen.

use mongodb::bson::Bson;

pub const SAME_CONNECTION: &str = "El destino no puede ser la conexión de origen";
pub const SAME_COLLECTION: &str =
    "El destino es la misma colección que el origen (las dos conexiones apuntan al mismo servidor)";

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
    fn the_same_physical_collection_is_rejected() {
        assert_eq!(ensure_distinct_collections(Some(&uuid(1)), Some(&uuid(1))), Err(SAME_COLLECTION.into()));
        assert!(ensure_distinct_collections(Some(&uuid(1)), Some(&uuid(2))).is_ok());
        // El destino aún no existe, o un servidor antiguo no da UUID.
        assert!(ensure_distinct_collections(Some(&uuid(1)), None).is_ok());
        assert!(ensure_distinct_collections(None, None).is_ok());
    }
}
