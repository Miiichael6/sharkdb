//! Carpeta de un backup, con el formato de `mongodump --out`: una subcarpeta por base de datos y,
//! dentro, un `.bson` y un `.metadata.json` por colección. También se lee la carpeta de una sola BD
//! (la que guardaba la tarea 14, o `mongodump --db`). Un backup en curso, fallido o cancelado lleva
//! la marca `INCOMPLETE_MARK`: no se restaura ni cuenta para la retención (error 46).
//!
//! Los nombres reales no salen de los archivos: Windows y macOS no distinguen mayúsculas, así que
//! `Users` puede ir en `Users~1.bson` (error 36). El de una colección lo dice su `.metadata.json` y
//! el de una BD el archivo `DATABASE_NAME_FILE` de su carpeta; sin ellos, el del archivo o carpeta.

use std::fs;
use std::path::{Path, PathBuf};

use super::format::{self, CollectionMetadata, DATA_EXTENSION};
use crate::jobs::selection::{DatabaseCatalog, is_offered_collection, is_system_database};

/// Archivo que marca un backup sin terminar: se crea al empezar y se borra solo si acaba bien.
pub const INCOMPLETE_MARK: &str = "BACKUP_INCOMPLETO.txt";
const INCOMPLETE_TEXT: &str = "Este backup no terminó bien (falló o se canceló): no se puede restaurar.
";
pub const INCOMPLETE_ERROR: &str = "Este backup no terminó bien (falló o se canceló): no se puede restaurar";
/// Archivo con el nombre real de la BD, dentro de su carpeta (que puede ser `Shop~1`).
pub const DATABASE_NAME_FILE: &str = "NOMBRE_BD.txt";

/// Una colección guardada en la carpeta de una base de datos.
#[derive(Debug, Clone, PartialEq)]
pub struct BackupEntry {
    pub collection: String,
    /// Nombre base de sus archivos (`<stem>.bson`), que puede no ser el de la colección.
    pub stem: String,
    /// Tamaño del `.bson`.
    pub bytes: u64,
}

/// Una base de datos del backup y la carpeta con sus colecciones.
#[derive(Debug, Clone, PartialEq)]
pub struct BackupDatabase {
    pub name: String,
    pub dir: PathBuf,
}

/// Carpeta `folder` (de `format::unique_stems`) dentro de la del backup.
pub fn database_dir(dir: &Path, folder: &str) -> PathBuf {
    dir.join(folder)
}

/// Crea la carpeta `db_dir` de la BD `db` y anota dentro su nombre real. Siempre: aunque la carpeta
/// se llame como la BD, en Windows puede existir ya como `shop` de un backup anterior.
pub fn create_database_dir(db_dir: &Path, db: &str) -> Result<(), String> {
    fs::create_dir_all(db_dir).map_err(|e| format!("No se pudo crear {}: {e}", db_dir.display()))?;
    let file = db_dir.join(DATABASE_NAME_FILE);
    fs::write(&file, db).map_err(|e| format!("No se pudo escribir {}: {e}", file.display()))
}

/// Nombre real de la BD guardada en `db_dir`: el anotado dentro o, si no hay, el de la carpeta.
fn database_name(db_dir: &Path) -> Option<String> {
    match fs::read_to_string(db_dir.join(DATABASE_NAME_FILE)) {
        Ok(name) if !name.trim_end().is_empty() => Some(name.trim_end().to_string()),
        _ => db_dir.file_name().and_then(|n| n.to_str()).map(str::to_string),
    }
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
/// BD; si no, cada subcarpeta con `.bson` es una. Las de sistema no se ofrecen.
/// Un backup sin terminar es un error, también si `dir` es la carpeta de una de sus BDs.
pub fn backup_databases(dir: &Path) -> Result<Vec<BackupDatabase>, String> {
    if is_marked_incomplete(dir) || dir.parent().is_some_and(is_marked_incomplete) {
        return Err(INCOMPLETE_ERROR.into());
    }
    if !list_entries(dir)?.is_empty() {
        let name = database_name(dir).unwrap_or_default();
        return Ok(vec![BackupDatabase { name, dir: dir.to_path_buf() }]);
    }
    let mut databases = Vec::new();
    for sub in fs::read_dir(dir).map_err(|e| read_error(dir, e))? {
        let path = sub.map_err(|e| read_error(dir, e))?.path();
        if !path.is_dir() {
            continue;
        }
        let Some(name) = database_name(&path) else {
            continue;
        };
        if !is_system_database(&name) && !list_entries(&path)?.is_empty() {
            databases.push(BackupDatabase { name, dir: path });
        }
    }
    databases.sort_by(|a, b| a.name.cmp(&b.name));
    if let Some(pair) = databases.windows(2).find(|pair| pair[0].name == pair[1].name) {
        return Err(format!("La carpeta tiene dos copias de la base de datos “{}”: no se sabe cuál restaurar", pair[0].name));
    }
    Ok(databases)
}

/// Lo que se puede restaurar de la carpeta `dir`, como el catálogo de un servidor.
pub fn read_catalog(dir: &Path) -> Result<Vec<DatabaseCatalog>, String> {
    backup_databases(dir)?
        .into_iter()
        .map(|database| {
            let entries: Vec<_> = list_entries(&database.dir)?
                .into_iter()
                .filter(|e| is_offered_collection(&e.collection))
                .collect();
            Ok(DatabaseCatalog {
                name: database.name,
                size_on_disk: entries.iter().map(|e| e.bytes).sum(),
                collections: entries.into_iter().map(|e| e.collection).collect(),
            })
        })
        .collect()
}

pub fn data_path(dir: &Path, stem: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::data_file_name(stem)?))
}

pub fn metadata_path(dir: &Path, stem: &str) -> Result<PathBuf, String> {
    Ok(dir.join(format::metadata_file_name(stem)?))
}

/// Colecciones de la carpeta, por nombre: cada `<stem>.bson` es una, con el nombre que diga su
/// `.metadata.json` (o `stem` si no lo dice). Dos archivos de la misma colección son un error.
pub fn list_entries(dir: &Path) -> Result<Vec<BackupEntry>, String> {
    let read_error = |e| read_error(dir, e);
    let mut entries = Vec::new();
    for file in fs::read_dir(dir).map_err(read_error)? {
        let path = file.map_err(read_error)?.path();
        if path.extension().and_then(|e| e.to_str()) != Some(DATA_EXTENSION) || !path.is_file() {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|s| s.to_str()).map(str::to_string) else {
            continue;
        };
        let collection = metadata_path(dir, &stem)
            .ok()
            .and_then(|metadata| fs::read_to_string(metadata).ok())
            .and_then(|json| format::metadata_collection_name(&json))
            .unwrap_or_else(|| stem.clone());
        entries.push(BackupEntry {
            collection,
            stem,
            bytes: fs::metadata(&path).map_err(read_error)?.len(),
        });
    }
    entries.sort_by(|a, b| a.collection.cmp(&b.collection));
    if let Some(pair) = entries.windows(2).find(|pair| pair[0].collection == pair[1].collection) {
        return Err(format!(
            "{} tiene dos copias de la colección “{}” ({}.{DATA_EXTENSION} y {}.{DATA_EXTENSION}): no se sabe cuál restaurar",
            dir.display(),
            pair[0].collection,
            pair[0].stem,
            pair[1].stem
        ));
    }
    Ok(entries)
}

/// La colección `collection` entre las de una carpeta (`list_entries`).
pub fn find_entry<'a>(entries: &'a [BackupEntry], collection: &str) -> Result<&'a BackupEntry, String> {
    entries
        .iter()
        .find(|e| e.collection == collection)
        .ok_or_else(|| format!("El backup no tiene la colección “{collection}”"))
}

/// Metadatos de una colección; sin `.metadata.json` se restaura sin opciones ni índices.
pub fn read_metadata(dir: &Path, entry: &BackupEntry) -> Result<CollectionMetadata, String> {
    let path = metadata_path(dir, &entry.stem)?;
    if !path.is_file() {
        return Ok(CollectionMetadata {
            collection: entry.collection.clone(),
            options: Default::default(),
            indexes: Vec::new(),
        });
    }
    let json = fs::read_to_string(&path).map_err(|e| read_error(&path, e))?;
    CollectionMetadata::from_json(&entry.collection, &json)
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
                BackupEntry { collection: "a.b".into(), stem: "a.b".into(), bytes: 0 },
                BackupEntry { collection: "orders".into(), stem: "orders".into(), bytes: 10 },
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
        let entry = BackupEntry { collection: "x".into(), stem: "x".into(), bytes: 0 };
        assert_eq!(read_metadata(&dir, &entry).unwrap().indexes, Vec::new());

        let saved = CollectionMetadata {
            collection: "x".into(),
            options: doc! { "capped": true, "size": 1024 },
            indexes: vec![doc! { "v": 2, "key": { "a": 1 }, "name": "a_1" }],
        };
        fs::write(metadata_path(&dir, "x").unwrap(), saved.to_json().unwrap()).unwrap();
        assert_eq!(read_metadata(&dir, &entry).unwrap(), saved);
        fs::remove_dir_all(dir).unwrap();
    }

    fn save(dir: &Path, stem: &str, collection: &str, bytes: usize) {
        fs::create_dir_all(dir).unwrap();
        fs::write(data_path(dir, stem).unwrap(), vec![0u8; bytes]).unwrap();
        let metadata = CollectionMetadata { collection: collection.into(), options: doc! {}, indexes: vec![] };
        fs::write(metadata_path(dir, stem).unwrap(), metadata.to_json().unwrap()).unwrap();
    }

    #[test]
    fn collections_are_listed_with_the_name_their_metadata_gives() {
        let dir = temp_dir("case");
        save(&dir, "users", "users", 1);
        save(&dir, "Users~1", "Users", 2);

        let entries = list_entries(&dir).unwrap();
        assert_eq!(
            entries,
            [
                BackupEntry { collection: "Users".into(), stem: "Users~1".into(), bytes: 2 },
                BackupEntry { collection: "users".into(), stem: "users".into(), bytes: 1 },
            ]
        );
        assert_eq!(read_metadata(&dir, find_entry(&entries, "Users").unwrap()).unwrap().collection, "Users");
        assert!(find_entry(&entries, "USERS").is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn two_files_of_the_same_collection_are_an_error() {
        let dir = temp_dir("twice");
        save(&dir, "users", "users", 1);
        save(&dir, "users~1", "users", 1);
        let error = list_entries(&dir).unwrap_err();
        assert!(error.contains("dos copias de la colección “users”"), "{error}");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn databases_are_listed_with_the_name_noted_in_their_folder() {
        let dir = temp_dir("db-case");
        for (folder, db) in [("shop", "shop"), ("Shop~1", "Shop")] {
            let db_dir = database_dir(&dir, folder);
            create_database_dir(&db_dir, db).unwrap();
            save(&db_dir, "orders", "orders", 3);
        }
        // Carpeta de un backup anterior al arreglo: sin el archivo, el nombre es el de la carpeta.
        save(&dir.join("logs"), "events", "events", 1);

        let catalog = read_catalog(&dir).unwrap();
        let names: Vec<_> = catalog.iter().map(|d| d.name.as_str()).collect();
        assert_eq!(names, ["Shop", "logs", "shop"]);
        let shop = backup_databases(&dir).unwrap().into_iter().find(|d| d.name == "Shop").unwrap();
        assert_eq!(shop.dir, database_dir(&dir, "Shop~1"));
        // La carpeta de una sola BD también.
        assert_eq!(backup_databases(&shop.dir).unwrap()[0].name, "Shop");

        create_database_dir(&database_dir(&dir, "shop~2"), "shop").unwrap();
        save(&database_dir(&dir, "shop~2"), "orders", "orders", 1);
        let error = backup_databases(&dir).unwrap_err();
        assert!(error.contains("dos copias de la base de datos “shop”"), "{error}");
        fs::remove_dir_all(dir).unwrap();
    }
}
