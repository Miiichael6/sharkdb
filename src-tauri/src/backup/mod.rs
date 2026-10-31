//! Backup y restore nativos (D6) con el formato de `mongodump`: lo que se guarda aquí se puede
//! restaurar con `mongorestore` y al revés. Usan la conexión ya abierta (SSH/TLS incluidos).
//!
//! - `format`: lectura/escritura de `<colección>.bson` y `<colección>.metadata.json` (puro).
//! - `folder`: archivos de una carpeta de backup.
//! - `source` / `writer`: leer una colección del servidor y escribirla en otro, por lotes; el
//!   sync (15) los reutiliza para copiar entre conexiones sin pasar por disco.
//! - `dump` / `restore`: el trabajo contra el servidor, con progreso y cancelación (`crate::jobs`).
//! - `commands`: comandos Tauri (`backup_database`, `restore_database`, `read_backup_folder`).

pub mod commands;
mod dump;
mod folder;
mod format;
mod restore;
pub mod source;
pub mod writer;

#[cfg(test)]
mod tests {
    use std::cell::RefCell;

    use mongodb::Client;
    use mongodb::bson::{Document, doc, oid::ObjectId};

    use super::dump::dump;
    use crate::jobs::{CANCELLED, CancelFlag};
    use super::restore::{RestoreTarget, restore};
    use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};

    const LOCAL_URI: &str = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000";

    async fn index_names(client: &Client, db: &str, coll: &str) -> Vec<String> {
        let mut names = client.database(db).collection::<Document>(coll).list_index_names().await.unwrap();
        names.sort();
        names
    }

    /// Prueba real de la tarea 14 contra un mongod local: backup de una BD con varias colecciones
    /// e índices, restore en otra BD, conteos, tipos e índices iguales; cancelación y safe mode.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_backup_and_restore_round_trip() {
        let client = Client::with_uri_str(LOCAL_URI).await.unwrap();
        let (source, target) = ("robo3b_it_backup_src", "robo3b_it_backup_dst");
        let db = client.database(source);
        db.drop(None).await.unwrap();
        client.database(target).drop(None).await.unwrap();
        let orders = db.collection::<Document>("orders");
        let docs: Vec<Document> = (0..2500)
            .map(|i| doc! { "_id": ObjectId::new(), "n": i as i64, "at": mongodb::bson::DateTime::now() })
            .collect();
        orders.insert_many(docs, None).await.unwrap();
        db.run_command(doc! { "createIndexes": "orders", "indexes": [{ "key": { "n": -1 }, "name": "n_-1", "unique": true }] }, None)
            .await
            .unwrap();
        db.collection::<Document>("users").insert_one(doc! { "name": "ana" }, None).await.unwrap();

        let dir = std::env::temp_dir().join(format!("robo3b-it-backup-{}", std::process::id()));
        let collections = vec!["orders".to_string(), "users".to_string()];
        let reports = RefCell::new(0);
        let dumped = dump(&db, &collections, &dir, &CancelFlag::default(), |_| *reports.borrow_mut() += 1)
            .await
            .unwrap();
        assert_eq!(dumped[0].documents, 2500);
        assert!(*reports.borrow() > 2);

        let safe_mode = SafeMode::new(false);
        let target_db = client.database(target);
        let restore_target = RestoreTarget { db: &target_db, safe_mode: &safe_mode, drop_before: true };
        let restored = restore(&restore_target, &collections, &dir, &CancelFlag::default(), |_| {}).await.unwrap();
        assert_eq!((restored[0].documents, restored[1].documents), (2500, 1));
        assert_eq!(index_names(&client, target, "orders").await, index_names(&client, source, "orders").await);
        let first = target_db.collection::<Document>("orders").find_one(doc! { "n": 0_i64 }, None).await.unwrap().unwrap();
        assert!(first.get_datetime("at").is_ok() && first.get_object_id("_id").is_ok());

        // Sin eliminar antes, los `_id` repetidos se saltan.
        let again = RestoreTarget { drop_before: false, ..restore_target };
        let skipped = restore(&again, &collections[1..], &dir, &CancelFlag::default(), |_| {}).await.unwrap();
        assert_eq!((skipped[0].documents, skipped[0].duplicates), (0, 1));

        let cancel = CancelFlag::default();
        cancel.cancel();
        assert_eq!(dump(&db, &collections, &dir, &cancel, |_| {}).await, Err(CANCELLED.into()));
        safe_mode.set(true);
        assert_eq!(
            restore(&again, &collections, &dir, &CancelFlag::default(), |_| {}).await,
            Err(SAFE_MODE_ERROR.into())
        );

        db.drop(None).await.unwrap();
        target_db.drop(None).await.unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }
}
