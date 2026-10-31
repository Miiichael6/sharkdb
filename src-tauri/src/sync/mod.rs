//! Sync entre entornos (R30, D7): reemplaza bases de datos completas o colecciones sueltas de varias
//! BDs del destino con las del origen (p. ej. prod → QA), cada BD en la de su mismo nombre. Una
//! conexión protegida o en safe mode nunca es destino; el origen solo se lee.
//!
//! - `catalog`: las BDs del origen con sus colecciones copiables, para que la UI las ofrezca.
//! - `target`: reglas puras sobre el destino (no es el origen) y nombre de la provisional.
//! - `copy`: la copia por cursor y lotes, a una colección provisional que se renombra al final.
//! - `commands`: comandos Tauri (`database_catalog`, `sync_databases`).

mod catalog;
pub mod commands;
mod copy;
mod target;

#[cfg(test)]
mod tests {
    use mongodb::bson::{Document, doc};
    use mongodb::{Client, Database};

    use super::catalog::{database_catalog, syncable_collections};
    use super::copy::{DatabaseCopy, SyncEnds, sync};
    use super::target::SAME_COLLECTION;
    use crate::jobs::{CANCELLED, CancelFlag};
    use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};

    /// Solo el mongod local: las pruebas reales nunca tocan producción.
    const LOCAL_URI: &str = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000";

    async fn seed(client: &Client, db: &str, docs: i64) {
        let db = client.database(db);
        db.drop(None).await.unwrap();
        let orders = db.collection::<Document>("orders");
        let batch: Vec<Document> = (0..docs).map(|i| doc! { "n": i, "sku": format!("s{i}") }).collect();
        orders.insert_many(batch, None).await.unwrap();
        db.run_command(doc! { "createIndexes": "orders", "indexes": [{ "key": { "sku": 1 }, "name": "sku_1", "unique": true }] }, None)
            .await
            .unwrap();
        db.collection::<Document>("users").insert_one(doc! { "name": "ana" }, None).await.unwrap();
    }

    async fn staging_left(db: &Database) -> bool {
        db.list_collection_names(None).await.unwrap().iter().any(|n| n.contains("robo3b-sync"))
    }

    async fn count(db: &Database, collection: &str) -> u64 {
        db.collection::<Document>(collection).count_documents(None, None).await.unwrap()
    }

    async fn index_names(db: &Database, collection: &str) -> Vec<String> {
        db.collection::<Document>(collection).list_index_names().await.unwrap()
    }

    fn copy(source: &Database, target: &Database, collections: &[&str]) -> DatabaseCopy {
        DatabaseCopy {
            source: source.clone(),
            target: target.clone(),
            collections: collections.iter().map(|c| c.to_string()).collect(),
        }
    }

    /// Prueba real de la tarea 15 contra un mongod local: "prod" y "QA" son pares de BDs locales.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_sync_replaces_target_collections() {
        let client = Client::with_uri_str(LOCAL_URI).await.unwrap();
        let names = ["robo3b_it_sync_prod_a", "robo3b_it_sync_prod_b", "robo3b_it_sync_qa_a", "robo3b_it_sync_qa_b"];
        let [prod_a, prod_b, qa_a, qa_b] = names.map(|n| client.database(n));
        seed(&client, names[0], 3500).await;
        seed(&client, names[1], 20).await;
        seed(&client, names[2], 10).await;
        client.database(names[3]).drop(None).await.unwrap();
        qa_a.collection::<Document>("only_qa").insert_one(doc! {}, None).await.unwrap();

        // Las BDs de sistema no se ofrecen y las de usuario traen sus colecciones.
        let catalog = database_catalog(&client).await.unwrap();
        assert!(catalog.iter().all(|d| !["admin", "local", "config"].contains(&d.name.as_str())));
        let prod_a_entry = catalog.iter().find(|d| d.name == names[0]).unwrap();
        assert_eq!(prod_a_entry.collections, ["orders", "users"]);

        // Dos BDs en un solo trabajo: una completa sobre otra existente, otra parcial a una BD nueva.
        let safe_mode = SafeMode::new(false);
        let ends = SyncEnds { target_client: &client, safe_mode: &safe_mode };
        let copies = [copy(&prod_a, &qa_a, &["orders", "users"]), copy(&prod_b, &qa_b, &["orders"])];
        let results = sync(&ends, &copies, &CancelFlag::default(), |_| {}).await.unwrap();
        let labels: Vec<_> = results.iter().map(|r| r.collection.as_str()).collect();
        assert_eq!(labels, [format!("{}.orders", names[2]), format!("{}.users", names[2]), format!("{}.orders", names[3])]);
        assert_eq!((count(&qa_a, "orders").await, count(&qa_b, "orders").await), (3500, 20));
        assert_eq!(index_names(&qa_a, "orders").await.len(), 2);
        // Lo no elegido del destino se conserva y no quedan provisionales.
        assert!(syncable_collections(&qa_a).await.unwrap().contains(&"only_qa".to_string()));
        assert_eq!(syncable_collections(&qa_b).await.unwrap(), ["orders"]);
        assert!(!staging_left(&qa_a).await && !staging_left(&qa_b).await);

        // La misma BD vista como destino: se rechaza.
        let same = [copy(&prod_a, &prod_a, &["orders"])];
        assert_eq!(sync(&ends, &same, &CancelFlag::default(), |_| {}).await, Err(SAME_COLLECTION.into()));

        // Cancelar o safe mode a mitad no tocan el destino.
        seed(&client, names[2], 10).await;
        let cancel = CancelFlag::default();
        let cancel_mid_copy = |p: crate::jobs::report::Progress| if p.done > 0 { cancel.cancel() };
        assert_eq!(sync(&ends, &copies, &cancel, cancel_mid_copy).await, Err(CANCELLED.into()));
        safe_mode.set(true);
        assert_eq!(sync(&ends, &copies, &CancelFlag::default(), |_| {}).await, Err(SAFE_MODE_ERROR.into()));
        assert_eq!(count(&qa_a, "orders").await, 10);
        assert!(!staging_left(&qa_a).await);

        for name in names {
            client.database(name).drop(None).await.unwrap();
        }
    }
}
