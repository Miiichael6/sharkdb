//! Contrato entre `bson_types.js` y `convert`: el `_bsontype` de cada prototipo y las
//! propiedades donde cada instancia guarda su contenido.

/// Valor de `_bsontype` en el prototipo de cada tipo.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BsonTag {
    ObjectId,
    Date,
    RegExp,
    BsonRegExp,
    NumberLong,
    NumberInt,
    Double,
    NumberDecimal,
    BinData,
    Timestamp,
    Code,
    MinKey,
    MaxKey,
}

const ALL: [BsonTag; 13] = [
    BsonTag::ObjectId,
    BsonTag::Date,
    BsonTag::RegExp,
    BsonTag::BsonRegExp,
    BsonTag::NumberLong,
    BsonTag::NumberInt,
    BsonTag::Double,
    BsonTag::NumberDecimal,
    BsonTag::BinData,
    BsonTag::Timestamp,
    BsonTag::Code,
    BsonTag::MinKey,
    BsonTag::MaxKey,
];

impl BsonTag {
    pub fn parse(tag: &str) -> Option<Self> {
        ALL.into_iter().find(|t| t.name() == tag)
    }

    /// Valor de `_bsontype` y nombre del constructor global que crea el tipo.
    pub fn name(self) -> &'static str {
        match self {
            Self::ObjectId => "ObjectId",
            Self::Date => "Date",
            Self::RegExp => "RegExp",
            Self::BsonRegExp => "BSONRegExp",
            Self::NumberLong => "NumberLong",
            Self::NumberInt => "NumberInt",
            Self::Double => "Double",
            Self::NumberDecimal => "NumberDecimal",
            Self::BinData => "BinData",
            Self::Timestamp => "Timestamp",
            Self::Code => "Code",
            Self::MinKey => "MinKey",
            Self::MaxKey => "MaxKey",
        }
    }
}

/// Propiedades de las instancias (ver `bson_types.js`).
pub mod field {
    pub const TAG: &str = "_bsontype";
    pub const OBJECT_ID_HEX: &str = "str";
    pub const VALUE: &str = "_value";
    pub const PATTERN: &str = "_pattern";
    pub const OPTIONS: &str = "_options";
    pub const SUBTYPE: &str = "_subtype";
    pub const BASE64: &str = "_base64";
    pub const TIME: &str = "_t";
    pub const INCREMENT: &str = "_i";
    pub const CODE: &str = "_code";
    pub const SCOPE: &str = "_scope";
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_tag_parses_back_from_its_name() {
        for tag in ALL {
            assert_eq!(BsonTag::parse(tag.name()), Some(tag));
        }
        assert_eq!(BsonTag::parse("Nope"), None);
    }
}
