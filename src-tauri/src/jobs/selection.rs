//! Lo que eligen el sync, el backup y el restore: colecciones de varias BDs, recorridas como un
//! solo trabajo (el progreso cuenta las de todas y cada resultado se nombra `bd.colección`).

use serde::{Deserialize, Serialize};

pub const NO_COLLECTIONS: &str = "Elige al menos una colección";

/// Bases de datos del servidor que nunca se ofrecen.
const SYSTEM_DATABASES: [&str; 3] = ["admin", "local", "config"];
const SYSTEM_PREFIX: &str = "system.";

pub fn is_system_database(name: &str) -> bool {
    SYSTEM_DATABASES.contains(&name)
}

pub fn is_system_collection(name: &str) -> bool {
    name.starts_with(SYSTEM_PREFIX)
}

/// Colecciones elegidas de una base de datos.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct DatabaseSelection {
    pub db: String,
    pub collections: Vec<String>,
}

/// Una base de datos que se ofrece para elegir (del servidor o de una carpeta de backup).
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DatabaseCatalog {
    pub name: String,
    pub size_on_disk: u64,
    pub collections: Vec<String>,
}

/// Quita las BDs sin colecciones; error si no queda ninguna colección.
pub fn non_empty(databases: Vec<DatabaseSelection>) -> Result<Vec<DatabaseSelection>, String> {
    let databases: Vec<_> = databases.into_iter().filter(|d| !d.collections.is_empty()).collect();
    if databases.is_empty() { Err(NO_COLLECTIONS.into()) } else { Ok(databases) }
}

/// Nombre de una colección en el progreso y los resultados.
pub fn collection_label(db: &str, collection: &str) -> String {
    format!("{db}.{collection}")
}

/// Cada colección de `items` junto a lo que la contiene, en orden: el trabajo las recorre así.
pub fn each_collection<T>(items: &[T], collections: impl Fn(&T) -> &[String]) -> Vec<(&T, &str)> {
    items.iter().flat_map(|item| collections(item).iter().map(move |c| (item, c.as_str()))).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn selection(db: &str, collections: &[&str]) -> DatabaseSelection {
        DatabaseSelection { db: db.into(), collections: collections.iter().map(|c| c.to_string()).collect() }
    }

    #[test]
    fn empty_databases_are_dropped_and_at_least_one_collection_is_needed() {
        let chosen = non_empty(vec![selection("a", &[]), selection("b", &["x"])]).unwrap();
        assert_eq!(chosen, [selection("b", &["x"])]);
        assert_eq!(non_empty(vec![selection("a", &[])]), Err(NO_COLLECTIONS.into()));
    }

    #[test]
    fn collections_of_every_database_in_order() {
        let databases = [selection("a", &["x", "y"]), selection("b", &["z"])];
        let pairs: Vec<_> = each_collection(&databases, |d| &d.collections)
            .into_iter()
            .map(|(d, c)| collection_label(&d.db, c))
            .collect();
        assert_eq!(pairs, ["a.x", "a.y", "b.z"]);
    }
}
