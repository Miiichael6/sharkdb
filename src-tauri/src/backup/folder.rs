//! Carpeta de un backup, con el formato de `mongodump --out`: una subcarpeta por base de datos y,
//! dentro, un `.bson` y un `.metadata.json` por colección. También se lee la carpeta de una sola BD
//! (la que guardaba la tarea 14, o `mongodump --db`). Un backup en curso, fallido o cancelado lleva
//! la marca `INCOMPLETE_MARK`: no se restaura ni cuenta para la retención (error 46).

use std::fs;
use std::path::{Path, PathBuf};

use super::format::{self, CollectionMetadata, DATA_EXTENSION};
use crate::jobs::selection::{DatabaseCatalog, is_system_collection, is_system_database};

/// Archivo que marca un backup sin terminar: se crea al empezar y se borra solo si acaba bien.
pub const INCOMPLETE_MARK: &str = "BACKUP_INCOMPLETO.txt";
const INCOMPLETE_TEXT: &str = "Este backup no terminó bien (falló o se canceló): no se puede restaurar.
";
pub const INCOMPLETE_ERROR: &str = "Este backup no terminó bien (falló o se canceló): no se puede restaurar";

/// Una colección guardada en la carpeta de una base de datos.
#[derive(Debug, Clone, PartialEq)]
pub struct BackupEntry {
    pub collection: String,
    /// Tamaño del `.bson`.
    pub bytes: u64,
}

/// Una base de datos del backup y la carpeta con sus colecciones.
#[derive(Debug, Clone, PartialEq)]
pub struct BackupDatabase {
    pub name: String,
    pub dir: PathBuf,
}

/// Carpeta donde se guarda la base de datos `db` dentro de la del backup.
pub fn database_dir(dir: &Path, db: &str) -> PathBuf {
    dir.join(db)
}

/// Marca `dir` como backup sin terminar (la crea si no existe).
pub fn mark_incomplete(dir: &Path) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("No se pudo crear {}: {e}", dir.display()))?;
    let mark = dir.join(INCOMPLETE_MARK);
    fs::write(&mark, INCOMPLETE_TEXT).map_err(|e| format!("No se pudo escribir {}: {e}", mark.display()))
}

/// Quita la marca: el backup de `dir` terminó bien.
pub fn mark_complete(dir: &Path) -> Result<(), String> {
    let mark = dir.join(INCOMPLETE_MARK);
    match fs::remove_file(&mark) {
        Err(e) if e.kind() != std::io::ErrorKind::NotFound => Err(format!("No se pudo borrar {}: {e}", mark.display())),
        _ => Ok(()),
    }
}

/// Si `dir` lleva la marca de backup sin terminar.
pub fn is_marked_incomplete(dir: &Path) -> bool {
    dir.join(INCOMPLETE_MARK).is_file()
}

/// Bases de datos de la carpeta `dir`, por nombre. Con `.bson` en la raíz es la carpeta de una sola
/// BD, que se llama como ella; si no, cada subcarpeta con `.bson` es una. Las de sistema no se ofrecen.
/// Un backup sin terminar es un error, también si `dir` es la carpeta de una de sus BDs.
pub fn backup_databases(dir: &Path) -> Result<Vec<BackupDatabase>, String> {
    if is_marked_incomplete(dir) || dir.parent().is_some_and(is_marked_incomplete) {
        return Err(INCOMPLETE_ERROR.into());
    }
    if !list_entries(dir)?.is_empty() {
        let name = dir.file_name().and_then(|n| n.to_str()).unwrap_or_default().to_string();
        return Ok(vec![BackupDatabase { name, dir: dir.to_path_buf() }]);
    }
    let mut databases = Vec::new();
    for sub in fs::read_dir(dir).map_err(|e| read_error(dir, e))? {
        let path = sub.map_err(|e| read_error(dir, e))?.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()).map(str::to_string) else {
            continue;
        };
        if path.is_dir() && !is_system_database(&name) && !list_entries(&path)?.is_empty() {
            databases.push(BackupDatabase { name, dir: path });
        }
    }
    databases.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(databases)
}

/// Lo que se puede restaurar de la carpeta `dir`, como el catálogo de un servidor.
pub fn read_catalog(dir: &Path) -> Result<Vec<DatabaseCatalog>, String> {
    backup_databases(dir)?
        .into_iter()
        .map(|database| {
            let entries: Vec<_> = list_entries(&database.dir)?
                .into_iter()
                .filter(|e| !is_system_collection(&e.collection))
                .collect();
            Ok(DatabaseCatalog {
                name: database.name,
                size_on_disk: entries.iter().map(|e| e.bytes).sum(),
                collections: entries.into_iter().map(|e| e.collection).collect(),
            })
        })
        .collect()
}

pub fn data_path(dir: &Path, collection: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::data_file_name(collection)?))
}

pub fn metadata_path(dir: &Path, collection: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::metadata_file_name(collection)?))
}

/// Colecciones de la carpeta, por nombre: cada `<colección>.bson` es una.
pub fn list_entries(dir: &Path) -> Result<Vec<BackupEntry>, String> {
    let read_error = |e| read_error(dir, e);
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
    let json = fs::read_to_string(&path).map_err(|e| read_error(&path, e))?;
    CollectionMetadata::from_json(collection, &json)
}

fn read_error(path: &Path, e: std::io::Error) -> String {
    format!("No se pudo leer {}: {e}", path.display())
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
                BackupEntry { collection: "a.b".into(), bytes: 0 },
                BackupEntry { collection: "orders".into(), bytes: 10 },
            ]
        );
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn each_subfolder_with_collections_is_a_database() {
        let dir = temp_dir("out");
        for (db, collection) in [("shop", "orders"), ("shop", "system.js"), ("logs", "events"), ("admin", "system.version")] {
            fs::create_dir_all(dir.join(db)).unwrap();
            fs::write(dir.join(db).join(format!("{collection}.bson")), [0u8; 4]).unwrap();
        }
        fs::create_dir(dir.join("empty")).unwrap();

        let catalog = read_catalog(&dir).unwrap();
        let names: Vec<_> = catalog.iter().map(|d| (d.name.as_str(), d.collections.clone(), d.size_on_disk)).collect();
        assert_eq!(names, [("logs", vec!["events".to_string()], 4), ("shop", vec!["orders".to_string()], 4)]);
        assert_eq!(backup_databases(&dir).unwrap()[1].dir, database_dir(&dir, "shop"));
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_folder_with_bson_files_is_one_database_named_after_it() {
        let dir = temp_dir("single").join("sales");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("orders.bson"), [0u8; 3]).unwrap();

        assert_eq!(backup_databases(&dir).unwrap(), [BackupDatabase { name: "sales".into(), dir: dir.clone() }]);
        assert_eq!(read_catalog(&dir).unwrap()[0].collections, ["orders"]);
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }

    #[test]
    fn an_unfinished_backup_is_not_restored() {
        let dir = temp_dir("incomplete");
        fs::create_dir_all(dir.join("shop")).unwrap();
        fs::write(dir.join("shop").join("orders.bson"), [0u8; 4]).unwrap();
        mark_incomplete(&dir).unwrap();

        assert!(is_marked_incomplete(&dir));
        assert_eq!(read_catalog(&dir), Err(INCOMPLETE_ERROR.into()));
        assert_eq!(backup_databases(&dir.join("shop")), Err(INCOMPLETE_ERROR.into()));

        mark_complete(&dir).unwrap();
        assert!(!is_marked_incomplete(&dir));
        assert_eq!(read_catalog(&dir).unwrap()[0].collections, ["orders"]);
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
