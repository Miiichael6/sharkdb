//! Formato de `mongodump` para una colección: `<colección>.bson` (documentos BSON uno tras otro)
//! y `<colección>.metadata.json` (opciones e índices en extended JSON canónico). Solo IO sobre
//! `Read`/`Write`, sin servidor: se testea con ida y vuelta en memoria.

use std::io::{self, Read, Write};

use mongodb::bson::{Bson, Document, RawDocumentBuf, doc};
use serde_json::Value;

pub const DATA_EXTENSION: &str = "bson";
pub const METADATA_SUFFIX: &str = ".metadata.json";

/// Prefijo de longitud (i32 little-endian) con el que empieza cada documento BSON.
const LENGTH_PREFIX: usize = 4;
/// El documento vacío ocupa 5 bytes: la longitud y el terminador.
const MIN_DOCUMENT_LEN: usize = 5;
/// Tope del servidor (16 MiB) más margen para lo que `mongodump` pueda haber volcado.
const MAX_DOCUMENT_LEN: usize = 16 * 1024 * 1024 + 16 * 1024;

const ID_INDEX_NAME: &str = "_id_";
const COLLECTION_TYPE: &str = "collection";

/// Caracteres que no pueden ir en un nombre de archivo (Windows es el más estricto).
const FORBIDDEN_FILE_CHARS: &[char] = &['/', '\\', ':', '*', '?', '"', '<', '>', '|'];

/// Nombre base de los archivos de una colección; falla si el nombre no sirve como archivo.
pub fn file_stem(collection: &str) -> Result<&str, String> {
    let valid = !collection.is_empty()
        && !collection.contains(FORBIDDEN_FILE_CHARS)
        && !collection.chars().any(char::is_control);
    if valid {
        Ok(collection)
    } else {
        Err(format!("La colección “{collection}” no se puede guardar como archivo"))
    }
}

pub fn data_file_name(collection: &str) -> Result<String, String> {
    Ok(format!("{}.{DATA_EXTENSION}", file_stem(collection)?))
}

pub fn metadata_file_name(collection: &str) -> Result<String, String> {
    Ok(format!("{}{METADATA_SUFFIX}", file_stem(collection)?))
}

/// Escribe un documento tal cual llegó del servidor: sin pasar por tipos de Rust, no se pierde nada.
pub fn write_document(out: &mut impl Write, document: &[u8]) -> io::Result<()> {
    out.write_all(document)
}

/// Lee los documentos de un `.bson` uno a uno, sin cargar el archivo entero.
pub struct DocumentReader<R> {
    input: R,
}

impl<R: Read> DocumentReader<R> {
    pub fn new(input: R) -> Self {
        Self { input }
    }

    /// El siguiente documento, o `None` al final del archivo.
    pub fn next_document(&mut self) -> Result<Option<RawDocumentBuf>, String> {
        let mut prefix = [0u8; LENGTH_PREFIX];
        if !read_prefix(&mut self.input, &mut prefix)? {
            return Ok(None);
        }
        let len = usize::try_from(i32::from_le_bytes(prefix)).unwrap_or(0);
        if !(MIN_DOCUMENT_LEN..=MAX_DOCUMENT_LEN).contains(&len) {
            return Err(format!("Archivo BSON dañado: documento de {len} bytes"));
        }
        let mut bytes = vec![0u8; len];
        bytes[..LENGTH_PREFIX].copy_from_slice(&prefix);
        self.input
            .read_exact(&mut bytes[LENGTH_PREFIX..])
            .map_err(|_| "Archivo BSON dañado: termina a mitad de un documento".to_string())?;
        RawDocumentBuf::from_bytes(bytes)
            .map(Some)
            .map_err(|e| format!("Archivo BSON dañado: {e}"))
    }
}

/// Rellena el prefijo de longitud; `false` si el archivo acaba justo antes (fin normal).
fn read_prefix(input: &mut impl Read, prefix: &mut [u8; LENGTH_PREFIX]) -> Result<bool, String> {
    let mut filled = 0;
    while filled < LENGTH_PREFIX {
        match input.read(&mut prefix[filled..]) {
            Ok(0) if filled == 0 => return Ok(false),
            Ok(0) => return Err("Archivo BSON dañado: termina a mitad de un documento".into()),
            Ok(n) => filled += n,
            Err(e) if e.kind() == io::ErrorKind::Interrupted => {}
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(true)
}

/// Lo que `mongodump` guarda de una colección además de sus documentos.
#[derive(Debug, Clone, PartialEq)]
pub struct CollectionMetadata {
    pub collection: String,
    /// Opciones de creación (`capped`, `validator`, `collation`...), como las da `listCollections`.
    pub options: Document,
    /// Índices tal como los da `listIndexes`, incluido `_id_`.
    pub indexes: Vec<Document>,
}

impl CollectionMetadata {
    pub fn to_json(&self) -> Result<String, String> {
        let indexes: Vec<Bson> = self.indexes.iter().cloned().map(Bson::Document).collect();
        let metadata = doc! {
            "options": self.options.clone(),
            "indexes": indexes,
            "collectionName": &self.collection,
            "type": COLLECTION_TYPE,
        };
        serde_json::to_string(&Bson::Document(metadata).into_canonical_extjson()).map_err(|e| e.to_string())
    }

    /// Lee un `.metadata.json`; `collection` es el nombre que dice el archivo de datos.
    pub fn from_json(collection: &str, json: &str) -> Result<Self, String> {
        let invalid = |e: String| format!("{collection}{METADATA_SUFFIX} inválido: {e}");
        let value: Value = serde_json::from_str(json).map_err(|e| invalid(e.to_string()))?;
        let Bson::Document(metadata) = Bson::try_from(value).map_err(|e| invalid(e.to_string()))? else {
            return Err(invalid("no es un objeto".into()));
        };
        let options = metadata.get_document("options").cloned().unwrap_or_default();
        let indexes = match metadata.get_array("indexes") {
            Ok(list) => list.iter().filter_map(|ix| ix.as_document().cloned()).collect(),
            Err(_) => Vec::new(),
        };
        Ok(Self {
            collection: collection.to_string(),
            options,
            indexes,
        })
    }

    /// Índices a recrear al restaurar: `_id_` lo crea el servidor solo, y `ns` (servidores
    /// anteriores a 4.4) no lo aceptan los actuales.
    pub fn restorable_indexes(&self) -> Vec<Document> {
        self.indexes
            .iter()
            .filter(|ix| ix.get_str("name").ok() != Some(ID_INDEX_NAME))
            .map(|ix| {
                let mut ix = ix.clone();
                ix.remove("ns");
                ix
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::oid::ObjectId;
    use mongodb::bson::{Binary, DateTime, Decimal128, spec::BinarySubtype};
    use std::io::Cursor;

    fn raw(document: Document) -> RawDocumentBuf {
        RawDocumentBuf::from_document(&document).unwrap()
    }

    #[test]
    fn documents_round_trip_keeping_bson_types() {
        let documents = [
            raw(doc! {
                "_id": ObjectId::new(),
                "at": DateTime::from_millis(1_700_000_000_000),
                "n": 9_007_199_254_740_993_i64,
                "price": Decimal128::from_bytes([1; 16]),
                "uuid": Binary { subtype: BinarySubtype::Uuid, bytes: vec![7; 16] },
            }),
            raw(doc! {}),
            raw(doc! { "nested": { "list": [1, "two", 3.5] } }),
        ];
        let mut file = Vec::new();
        for d in &documents {
            write_document(&mut file, d.as_bytes()).unwrap();
        }

        let mut reader = DocumentReader::new(Cursor::new(file));
        for expected in &documents {
            assert_eq!(reader.next_document().unwrap().as_ref(), Some(expected));
        }
        assert_eq!(reader.next_document().unwrap(), None);
    }

    #[test]
    fn truncated_or_corrupt_files_are_errors() {
        let mut file = Vec::new();
        write_document(&mut file, raw(doc! { "a": 1 }).as_bytes()).unwrap();
        let truncated = &file[..file.len() - 2];
        assert!(DocumentReader::new(Cursor::new(truncated)).next_document().is_err());
        assert!(DocumentReader::new(Cursor::new(&file[..2])).next_document().is_err());
        let bogus_length = [0xff, 0xff, 0xff, 0x7f, 0];
        assert!(DocumentReader::new(Cursor::new(bogus_length)).next_document().is_err());
    }

    #[test]
    fn metadata_round_trips_as_canonical_extended_json() {
        let metadata = CollectionMetadata {
            collection: "orders".into(),
            options: doc! { "capped": true, "size": 4096_i64 },
            indexes: vec![
                doc! { "v": 2, "key": { "_id": 1 }, "name": "_id_" },
                doc! { "v": 2, "key": { "b": 1, "a": -1 }, "name": "b_1_a_-1", "unique": true },
            ],
        };
        let json = metadata.to_json().unwrap();
        // Canónico, como mongodump: los enteros llevan su tipo.
        assert!(json.contains(r#""$numberInt":"2""#), "{json}");
        let back = CollectionMetadata::from_json("orders", &json).unwrap();
        assert_eq!(back, metadata);
        let keys: Vec<&String> = back.indexes[1].get_document("key").unwrap().keys().collect();
        assert_eq!(keys, ["b", "a"]);
    }

    #[test]
    fn reads_mongodump_metadata_and_skips_the_id_index() {
        let json = r#"{"indexes":[{"v":{"$numberInt":"2"},"key":{"_id":{"$numberInt":"1"}},"name":"_id_","ns":"shop.orders"},
            {"v":{"$numberInt":"2"},"key":{"sku":{"$numberInt":"1"}},"name":"sku_1","ns":"shop.orders"}],
            "uuid":"5f1c...","collectionName":"orders","type":"collection"}"#;
        let metadata = CollectionMetadata::from_json("orders", json).unwrap();
        assert_eq!(metadata.options, doc! {});
        assert_eq!(
            metadata.restorable_indexes(),
            [doc! { "v": 2, "key": { "sku": 1 }, "name": "sku_1" }]
        );
        assert!(CollectionMetadata::from_json("orders", "[1]").is_err());
    }

    #[test]
    fn file_names_reject_names_that_are_not_valid_files() {
        assert_eq!(data_file_name("orders.2024").unwrap(), "orders.2024.bson");
        assert_eq!(metadata_file_name("orders").unwrap(), "orders.metadata.json");
        for name in ["", "a/b", "a\\b", "a:b", "a?b", "a\nb"] {
            assert!(file_stem(name).is_err(), "{name:?}");
        }
    }
}
