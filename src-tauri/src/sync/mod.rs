//! Sync entre entornos (R30, D7): reemplaza bases de datos completas o colecciones sueltas de varias
//! BDs del destino con las del origen (p. ej. prod → QA), cada BD en la de su mismo nombre. Una
//! conexión protegida o en safe mode nunca es destino; el origen solo se lee.
//!
//! - `catalog`: las BDs del origen con sus colecciones copiables, para que la UI las ofrezca.
//! - `target`: reglas puras sobre el destino (no es el origen; para documentos, de menor nivel).
//! - `copy`: la copia por cursor y lotes, a una colección provisional que se renombra al final
//!   (`backup::staging`, común con el restore).
//! - `documents`: documentos sueltos leídos enteros por `_id` y escritos con upsert (R97–R100, D25).
//! - `commands`: comandos Tauri (`database_catalog`, `sync_databases`, `load_full_documents`, `sync_documents`).

mod catalog;
pub mod commands;
mod copy;
mod documents;
mod target;

#[cfg(test)]
mod tests {
    use mongodb::bson::{Document, doc};
    use mongodb::{Client, Database};

    use super::catalog::{database_catalog, syncable_collections};
    use super::copy::{DatabaseCopy, sync};
    use super::target::SAME_COLLECTION;
    use crate::backup::staging::Destination;
    use crate::jobs::report::testing::Recorder;
    use crate::jobs::report::{CollectionProgress, CollectionState};
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
        db.list_collection_names(None).await.unwrap().iter().any(|n| n.contains("sharkdb-staging"))
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

    /// Lo que fue avanzando una colección (`done` de cada aviso).
    fn progress_of(updates: &[CollectionProgress], db: &str, collection: &str) -> Vec<u64> {
        updates.iter().filter(|u| u.db == db && u.collection == collection).map(|u| u.done).collect()
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
        let destination = Destination { client: &client, safe_mode: &safe_mode };
        let copies = [copy(&prod_a, &qa_a, &["orders", "users"]), copy(&prod_b, &qa_b, &["orders"])];
        let reports = Recorder::new();
        let results = sync(&destination, &copies, &CancelFlag::default(), &reports).await.unwrap();
        let labels: Vec<_> = results.iter().map(|r| r.collection.as_str()).collect();
        assert_eq!(labels, [format!("{}.orders", names[2]), format!("{}.users", names[2]), format!("{}.orders", names[3])]);
        // Las tres se copian a la vez, cada una con su avance; ninguna se aplica antes de que estén todas copiadas.
        let updates = reports.collections();
        let orders_a = progress_of(&updates, names[2], "orders");
        assert!(orders_a.len() > 2 && orders_a.windows(2).all(|w| w[0] <= w[1]));
        let first_applied = updates.iter().position(|u| u.state == CollectionState::Applied).unwrap();
        assert_eq!(updates[..first_applied].iter().filter(|u| u.state == CollectionState::Copied).count(), 3);
        assert_eq!(updates.iter().filter(|u| u.state == CollectionState::Applied).count(), 3);
        assert_eq!((count(&qa_a, "orders").await, count(&qa_b, "orders").await), (3500, 20));
        assert_eq!(index_names(&qa_a, "orders").await.len(), 2);
        // Lo no elegido del destino se conserva y no quedan provisionales.
        assert!(syncable_collections(&qa_a).await.unwrap().contains(&"only_qa".to_string()));
        assert_eq!(syncable_collections(&qa_b).await.unwrap(), ["orders"]);
        assert!(!staging_left(&qa_a).await && !staging_left(&qa_b).await);

        // La misma BD vista como destino: se rechaza.
        let same = [copy(&prod_a, &prod_a, &["orders"])];
        assert_eq!(sync(&destination, &same, &CancelFlag::default(), &Recorder::new()).await, Err(SAME_COLLECTION.into()));

        // Cancelar o safe mode a mitad no tocan el destino.
        seed(&client, names[2], 10).await;
        let cancel = CancelFlag::default();
        let cancel_mid_copy = Recorder::reacting(|p: &crate::jobs::report::Progress| if p.done > 0 { cancel.cancel() });
        assert_eq!(sync(&destination, &copies, &cancel, &cancel_mid_copy).await, Err(CANCELLED.into()));
        // Cancelada: ni fallida ni aplicada; el frontend la descarta.
        assert!(cancel_mid_copy.collections().iter().all(|u| matches!(u.state, CollectionState::Running | CollectionState::Copied)));
        safe_mode.set(true);
        assert_eq!(sync(&destination, &copies, &CancelFlag::default(), &Recorder::new()).await, Err(SAFE_MODE_ERROR.into()));
        assert_eq!(count(&qa_a, "orders").await, 10);
        assert!(!staging_left(&qa_a).await);

        // Si falla la última colección, las ya copiadas tampoco se reemplazan.
        safe_mode.set(false);
        let failing_last = [copy(&prod_a, &qa_a, &["orders", "users"]), copy(&prod_b, &prod_b, &["orders"])];
        let reports = Recorder::new();
        assert_eq!(sync(&destination, &failing_last, &CancelFlag::default(), &reports).await, Err(SAME_COLLECTION.into()));
        // Solo la que falló queda como fallida.
        let failed: Vec<_> = reports.collections().into_iter().filter(|u| u.state == CollectionState::Failed).collect();
        assert_eq!(failed.iter().map(|u| (u.db.as_str(), u.collection.as_str())).collect::<Vec<_>>(), [(names[1], "orders")]);
        assert!(reports.collections().iter().all(|u| u.state != CollectionState::Applied));
        assert_eq!(count(&qa_a, "orders").await, 10);
        assert!(!staging_left(&qa_a).await && !staging_left(&prod_b).await);

        for name in names {
            client.database(name).drop(None).await.unwrap();
        }
    }

    /// Documentos anteriores al validador (`moderate`) que no lo cumplen: se copian igual y el
    /// destino queda con el mismo validador.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_sync_copies_documents_older_than_the_validator() {
        let client = Client::with_uri_str(LOCAL_URI).await.unwrap();
        let names = ["robo3b_it_sync_validator_prod", "robo3b_it_sync_validator_qa"];
        let [prod, qa] = names.map(|n| client.database(n));
        seed(&client, names[0], 5).await;
        client.database(names[1]).drop(None).await.unwrap();
        let validator = doc! { "$jsonSchema": { "required": ["email"] } };
        prod.run_command(doc! { "collMod": "orders", "validator": validator.clone(), "validationLevel": "moderate" }, None)
            .await
            .unwrap();

        let safe_mode = SafeMode::new(false);
        let destination = Destination { client: &client, safe_mode: &safe_mode };
        sync(&destination, &[copy(&prod, &qa, &["orders"])], &CancelFlag::default(), &Recorder::new()).await.unwrap();
        assert_eq!(count(&qa, "orders").await, 5);
        let info = qa.run_command(doc! { "listCollections": 1, "filter": { "name": "orders" } }, None).await.unwrap();
        let options = info.get_document("cursor").unwrap().get_array("firstBatch").unwrap()[0]
            .as_document()
            .unwrap()
            .get_document("options")
            .unwrap()
            .clone();
        assert_eq!(options.get_document("validator").unwrap(), &validator);
        assert_eq!(options.get_str("validationLevel").unwrap(), "moderate");

        for name in names {
            client.database(name).drop(None).await.unwrap();
        }
    }
}
