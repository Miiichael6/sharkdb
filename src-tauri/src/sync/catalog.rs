//! Catálogo del origen de un sync: sus bases de datos con tamaño y las colecciones que se pueden copiar.

use futures::TryStreamExt;
use mongodb::options::ListDatabasesOptions;
use mongodb::results::CollectionType;
use mongodb::{Client, Database};

use crate::jobs::selection::{DatabaseCatalog, is_system_collection, is_system_database};
use crate::mongo::describe;

/// Colecciones de `db` que un sync puede copiar, por nombre: sin vistas, series temporales ni `system.*`.
pub async fn syncable_collections(db: &Database) -> Result<Vec<String>, String> {
    let specs: Vec<_> = db
        .list_collections(None, None)
        .await
        .map_err(describe)?
        .try_collect()
        .await
        .map_err(describe)?;
    let mut names: Vec<String> = specs
        .into_iter()
        .filter(|s| matches!(s.collection_type, CollectionType::Collection) && !is_system_collection(&s.name))
        .map(|s| s.name)
        .collect();
    names.sort();
    Ok(names)
}

/// Bases de datos de usuario del servidor, por nombre, con sus colecciones.
pub async fn database_catalog(client: &Client) -> Result<Vec<DatabaseCatalog>, String> {
    // Como el árbol: un usuario sin listDatabases en el clúster ve igualmente sus BDs.
    let options = ListDatabasesOptions::builder().authorized_databases(true).build();
    let specs = client.list_databases(None, options).await.map_err(describe)?;
    let mut catalog = Vec::with_capacity(specs.len());
    for spec in specs.into_iter().filter(|s| !is_system_database(&s.name)) {
        let collections = syncable_collections(&client.database(&spec.name)).await?;
        catalog.push(DatabaseCatalog { name: spec.name, size_on_disk: spec.size_on_disk, collections });
    }
    catalog.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(catalog)
}
