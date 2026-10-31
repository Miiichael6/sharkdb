//! Carpeta de un backup: una base de datos, con un `.bson` y un `.metadata.json` por colección
//! (la misma carpeta `<salida>/<bd>/` que deja `mongodump`).

use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

use super::format::{self, CollectionMetadata, DATA_EXTENSION};

/// Una colección guardada en la carpeta.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupEntry {
    pub collection: String,
    /// Tamaño del `.bson`, para medir el progreso del restore.
    pub bytes: u64,
    pub has_metadata: bool,
}

pub fn data_path(dir: &Path, collection: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::data_file_name(collection)?))
}

pub fn metadata_path(dir: &Path, collection: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::metadata_file_name(collection)?))
}

/// Colecciones de la carpeta, por nombre: cada `<colección>.bson` es una.
pub fn list_entries(dir: &Path) -> Result<Vec<BackupEntry>, String> {
    let read_error = |e: std::io::Error| format!("No se pudo leer {}: {e}", dir.display());
    let mut entries = Vec::new();
    for file in fs::read_dir(dir).map_err(read_error)? {
        let path = file.map_err(read_error)?.path();
        if path.extension().and_then(|e| e.to_str()) != Some(DATA_EXTENSION) || !path.is_file() {
            continue;
        }
        let Some(collection) = path.file_stem().and_then(|s| s.to_str()) else {
            continue;
        };
        entries.push(BackupEntry {
            collection: collection.to_string(),
            bytes: fs::metadata(&path).map_err(read_error)?.len(),
            has_metadata: metadata_path(dir, collection)?.is_file(),
        });
    }
    entries.sort_by(|a, b| a.collection.cmp(&b.collection));
    Ok(entries)
}

/// Metadatos de una colección; sin `.metadata.json` se restaura sin opciones ni índices.
pub fn read_metadata(dir: &Path, collection: &str) -> Result<CollectionMetadata, String> {
    let path = metadata_path(dir, collection)?;
    if !path.is_file() {
        return Ok(CollectionMetadata {
            collection: collection.to_string(),
            options: Default::default(),
            indexes: Vec::new(),
        });
    }
    let json = fs::read_to_string(&path).map_err(|e| format!("No se pudo leer {}: {e}", path.display()))?;
    CollectionMetadata::from_json(collection, &json)
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    fn temp_dir(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("robo3b-backup-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn lists_each_bson_file_as_a_collection() {
        let dir = temp_dir("list");
        fs::write(dir.join("orders.bson"), [0u8; 10]).unwrap();
        fs::write(dir.join("orders.metadata.json"), "{}").unwrap();
        fs::write(dir.join("a.b.bson"), []).unwrap();
        fs::write(dir.join("notes.txt"), "x").unwrap();
        fs::create_dir(dir.join("nested.bson")).unwrap();

        let entries = list_entries(&dir).unwrap();
        assert_eq!(
            entries,
            [
                BackupEntry { collection: "a.b".into(), bytes: 0, has_metadata: false },
                BackupEntry { collection: "orders".into(), bytes: 10, has_metadata: true },
            ]
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn metadata_is_optional() {
        let dir = temp_dir("metadata");
        assert_eq!(read_metadata(&dir, "x").unwrap().indexes, Vec::new());

        let saved = CollectionMetadata {
            collection: "x".into(),
            options: doc! { "capped": true, "size": 1024 },
            indexes: vec![doc! { "v": 2, "key": { "a": 1 }, "name": "a_1" }],
        };
        fs::write(metadata_path(&dir, "x").unwrap(), saved.to_json().unwrap()).unwrap();
        assert_eq!(read_metadata(&dir, "x").unwrap(), saved);
        fs::remove_dir_all(dir).unwrap();
    }
}
