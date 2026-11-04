//! Provisionales que dejó un sync, un restore o una copia de colección cortados a mitad (la app se
//! cerró o se cayó): se buscan al conectar para ofrecer borrarlas. No se puede saber si una es de
//! un trabajo que sigue en marcha en otra ventana o instancia, así que solo cuentan las antiguas,
//! por la fecha de su id; y si aun así se borra una en uso, ese trabajo falla sin tocar su destino.

use std::time::{Duration, SystemTime};

use mongodb::Client;
use mongodb::bson::Document;
use mongodb::options::ListDatabasesOptions;
use serde::{Deserialize, Serialize};

use super::staging::{Destination, is_staging_collection, staging_started};
use crate::jobs::selection::is_system_database;
use crate::mongo::describe;

/// Más de lo que dura un trabajo: una provisional más reciente puede ser de uno en marcha.
const ABANDONED_AFTER: Duration = Duration::from_secs(6 * 60 * 60);

/// Una provisional abandonada, por su BD y su nombre.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Leftover {
    pub db: String,
    pub collection: String,
}

/// Si `name` es una provisional abandonada a fecha de `now`. Una sin fecha (una copia de una versión
/// anterior) cuenta como abandonada: ningún trabajo de esta versión la usa.
pub fn is_abandoned(name: &str, now: SystemTime) -> bool {
    is_staging_collection(name)
        && staging_started(name)
            .is_none_or(|started| now.duration_since(started).is_ok_and(|age| age >= ABANDONED_AFTER))
}

/// Provisionales abandonadas de las BDs de usuario del servidor. Una BD que no se puede listar
/// (sin permiso) se salta: esto es una ayuda, no debe impedir nada.
pub async fn find(client: &Client, now: SystemTime) -> Result<Vec<Leftover>, String> {
    let options = ListDatabasesOptions::builder().authorized_databases(true).build();
    let databases = client.list_database_names(None, options).await.map_err(describe)?;
    let mut found = Vec::new();
    for db in databases.into_iter().filter(|d| !is_system_database(d)) {
        let Ok(collections) = client.database(&db).list_collection_names(None).await else {
            continue;
        };
        let mut abandoned: Vec<_> = collections.into_iter().filter(|c| is_abandoned(c, now)).collect();
        abandoned.sort();
        found.extend(abandoned.into_iter().map(|collection| Leftover { db: db.clone(), collection }));
    }
    Ok(found)
}

/// Borra las provisionales `leftovers`; antes comprueba que todas lo son, así no sirve para borrar otra cosa.
pub async fn drop_all(destination: &Destination<'_>, leftovers: &[Leftover]) -> Result<(), String> {
    if let Some(other) = leftovers.iter().find(|l| !is_staging_collection(&l.collection)) {
        return Err(format!("{}.{} no es una colección provisional", other.db, other.collection));
    }
    for leftover in leftovers {
        destination.safe_mode.ensure_writable()?;
        let collection = destination.client.database(&leftover.db).collection::<Document>(&leftover.collection);
        collection.drop(None).await.map_err(describe)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use mongodb::bson::{doc, oid::ObjectId};

    use super::*;
    use crate::backup::staging::staging_name;
    use crate::safe_mode::{SAFE_MODE_ERROR, SafeMode};

    const LOCAL_URI: &str = "mongodb://127.0.0.1:27017/?serverSelectionTimeoutMS=2000";
    const DB: &str = "robo3b_it_leftovers";

    fn run_at(started: SystemTime) -> String {
        let secs = started.duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs() as u32;
        ObjectId::from_parts(secs, [0; 5], [0; 3]).to_hex()
    }

    #[test]
    fn only_old_staging_collections_are_abandoned() {
        let now = SystemTime::now();
        let old = staging_name("orders", &run_at(now - ABANDONED_AFTER - Duration::from_secs(60)));
        let recent = staging_name("orders", &run_at(now - Duration::from_secs(60)));
        assert!(is_abandoned(&old, now));
        assert!(is_abandoned(&format!("sharkdb-copy-{}", run_at(now - ABANDONED_AFTER)), now));
        assert!(!is_abandoned(&recent, now));
        assert!(!is_abandoned("orders", now));
    }

    #[test]
    fn a_copy_without_a_date_is_abandoned() {
        assert!(is_abandoned("sharkdb-copy-7c9e6679-7425-40de-944b-e07fc1f90ae7", SystemTime::now()));
    }

    /// Contra un mongod local: solo se encuentran y se borran las provisionales abandonadas; ni la
    /// de un trabajo reciente ni una colección normal, y con safe mode no se borra nada.
    #[tokio::test]
    #[ignore = "needs a mongod on 127.0.0.1:27017"]
    async fn live_finds_and_drops_only_abandoned_staging() {
        let client = Client::with_uri_str(LOCAL_URI).await.unwrap();
        let db = client.database(DB);
        db.drop(None).await.unwrap();
        let old = staging_name("orders", &run_at(SystemTime::now() - ABANDONED_AFTER - Duration::from_secs(60)));
        let recent = staging_name("orders", &ObjectId::new().to_hex());
        for name in ["orders", &old, &recent] {
            db.collection::<Document>(name).insert_one(doc! { "a": 1 }, None).await.unwrap();
        }

        let found: Vec<_> =
            find(&client, SystemTime::now()).await.unwrap().into_iter().filter(|l| l.db == DB).collect();
        assert_eq!(found, [Leftover { db: DB.into(), collection: old.clone() }]);

        let safe_mode = SafeMode::new(true);
        let destination = Destination { client: &client, safe_mode: &safe_mode };
        assert_eq!(drop_all(&destination, &found).await, Err(SAFE_MODE_ERROR.into()));
        safe_mode.set(false);
        let not_staging = [found[0].clone(), Leftover { db: DB.into(), collection: "orders".into() }];
        assert!(drop_all(&destination, &not_staging).await.is_err());
        assert_eq!(db.list_collection_names(None).await.unwrap().len(), 3, "no se borró nada");

        drop_all(&destination, &found).await.unwrap();
        let mut left = db.list_collection_names(None).await.unwrap();
        left.sort();
        assert_eq!(left, ["orders".to_string(), recent]);
        db.drop(None).await.unwrap();
    }
}
