//! Backup y restore nativos (D6) con el formato de `mongodump --out`: lo que se guarda aquí se puede
//! restaurar con `mongorestore` y al revés. Usan la conexión ya abierta (SSH/TLS incluidos).
//!
//! - `format`: lectura/escritura de `<colección>.bson` y `<colección>.metadata.json` (puro).
//! - `folder`: BDs y archivos de una carpeta de backup (también la de una sola BD).
//! - `source` / `writer`: leer una colección del servidor y escribirla en otro, por lotes; el
//!   sync (15) los reutiliza para copiar entre conexiones sin pasar por disco.
//! - `staging`: reemplazo de una colección a través de una provisional, común al restore y al sync.
//! - `dump` / `restore`: el trabajo contra el servidor, con progreso y cancelación (`crate::jobs`).
//! - `commands`: comandos Tauri (`backup_databases`, `read_backup_catalog`, `restore_databases`).

pub mod commands;
mod dump;
mod folder;
mod format;
mod restore;
pub mod source;
pub mod staging;
pub mod writer;

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use mongodb::Client;
    use mongodb::bson::{Document, doc, oid::ObjectId};

    use super::dump::dump_databases;
    use super::folder::{backup_databases, read_catalog};
    use super::restore::{DatabaseRestore, restore_databases};
    use super::staging::Destination;
    use crate::jobs::selection::DatabaseSelection;
    use crate::jobs::{CANCELLED, CancelFlag};
    use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};

    const LOCAL_URI: &str = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000";
    const DATABASES: [&str; 2] = ["robo3b_it_backup_a", "robo3b_it_backup_b"];

    async fn index_names(client: &Client, db: &str, coll: &str) -> Vec<String> {
        let mut names = client.database(db).collection::<Document>(coll).list_index_names().await.unwrap();
        names.sort();
        names
    }

    async fn count(client: &Client, db: &str, coll: &str) -> u64 {
        client.database(db).collection::<Document>(coll).count_documents(None, None).await.unwrap()
    }

    fn selection(db: &str, collections: &[&str]) -> DatabaseSelection {
        DatabaseSelection { db: db.into(), collections: collections.iter().map(|c| c.to_string()).collect() }
    }

    /// Prueba real de la tarea 22 contra un mongod local: backup de dos BDs (una entera y una
    /// colección suelta de otra), cambios en el servidor y restore encima: conteos, tipos e índices
    /// como en el backup; cancelación y safe mode.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_backup_and_restore_of_several_databases() {
        let client = Client::with_uri_str(LOCAL_URI).await.unwrap();
        let [a, b] = DATABASES;
        for db in DATABASES {
            client.database(db).drop(None).await.unwrap();
        }
        let docs: Vec<Document> = (0..2500)
            .map(|i| doc! { "_id": ObjectId::new(), "n": i as i64, "at": mongodb::bson::DateTime::now() })
            .collect();
        client.database(a).collection::<Document>("orders").insert_many(docs, None).await.unwrap();
        client
            .database(a)
            .run_command(doc! { "createIndexes": "orders", "indexes": [{ "key": { "n": -1 }, "name": "n_-1", "unique": true }] }, None)
            .await
            .unwrap();
        client.database(a).collection::<Document>("users").insert_one(doc! { "name": "ana" }, None).await.unwrap();
        client.database(b).collection::<Document>("logs").insert_one(doc! { "m": 1 }, None).await.unwrap();
        client.database(b).collection::<Document>("skipped").insert_one(doc! { "m": 1 }, None).await.unwrap();

        let dir = std::env::temp_dir().join(format!("robo3b-it-backup-{}", std::process::id()));
        let chosen = vec![selection(a, &["orders", "users"]), selection(b, &["logs"])];
        let reports = RefCell::new(0);
        let dumped = dump_databases(&client, &chosen, &dir, &CancelFlag::default(), |_| *reports.borrow_mut() += 1)
            .await
            .unwrap();
        let labels: Vec<_> = dumped.iter().map(|r| r.collection.as_str()).collect();
        assert_eq!(labels, [format!("{a}.orders"), format!("{a}.users"), format!("{b}.logs")]);
        assert!(*reports.borrow() > 3);
        let catalog = read_catalog(&dir).unwrap();
        assert_eq!(catalog.iter().map(|d| d.name.as_str()).collect::<Vec<_>>(), DATABASES);

        // Lo que cambia después del backup se pierde al restaurar: se reemplaza cada colección.
        client.database(a).collection::<Document>("orders").delete_many(doc! { "n": { "$lt": 100_i64 } }, None).await.unwrap();
        client.database(b).collection::<Document>("logs").insert_one(doc! { "m": 2 }, None).await.unwrap();
        let original_indexes = index_names(&client, a, "orders").await;

        let safe_mode = SafeMode::new(false);
        let destination = Destination { client: &client, safe_mode: &safe_mode };
        let restores: Vec<DatabaseRestore> = backup_databases(&dir)
            .unwrap()
            .into_iter()
            .zip(&chosen)
            .map(|(found, chosen)| DatabaseRestore {
                dir: found.dir,
                target: client.database(&chosen.db),
                collections: chosen.collections.clone(),
            })
            .collect();
        let restored = restore_databases(&destination, &restores, &CancelFlag::default(), |_| {}).await.unwrap();
        assert_eq!(restored.iter().map(|r| r.documents).collect::<Vec<_>>(), [2500, 1, 1]);
        assert_eq!((count(&client, a, "orders").await, count(&client, b, "logs").await), (2500, 1));
        assert_eq!(index_names(&client, a, "orders").await, original_indexes);
        let first = client.database(a).collection::<Document>("orders").find_one(doc! { "n": 0_i64 }, None).await.unwrap().unwrap();
        assert!(first.get_datetime("at").is_ok() && first.get_object_id("_id").is_ok());
        let left = client.database(a).list_collection_names(None).await.unwrap();
        assert!(left.iter().all(|c| !c.contains("robo3b-staging")));

        let cancel = CancelFlag::default();
        cancel.cancel();
        assert_eq!(dump_databases(&client, &chosen, &dir, &cancel, |_| {}).await, Err(CANCELLED.into()));
        safe_mode.set(true);
        assert_eq!(
            restore_databases(&destination, &restores, &CancelFlag::default(), |_| {}).await,
            Err(SAFE_MODE_ERROR.into())
        );

        for db in DATABASES {
            client.database(db).drop(None).await.unwrap();
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}
