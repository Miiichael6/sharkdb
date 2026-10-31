//! Reemplazo de una colección del destino, común al sync y al restore: se llena una provisional y,
//! solo si todo fue bien, se renombra encima de la original (`dropTarget`). Un fallo o una
//! cancelación dejan el destino como estaba.

use std::future::Future;

use mongodb::bson::{RawDocumentBuf, doc, oid::ObjectId};
use mongodb::{Client, Database};

use crate::jobs::report::CollectionResult;
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

const ADMIN_DB: &str = "admin";
/// Marca de las colecciones provisionales en las que se escribe antes de reemplazar.
const STAGING_MARK: &str = "robo3b-staging";

/// La conexión que se modifica, con su safe mode, que se vuelve a mirar antes de cada lote y antes de reemplazar.
pub struct Destination<'a> {
    pub client: &'a Client,
    pub safe_mode: &'a SafeMode,
}

/// Identificador de un trabajo: distingue sus provisionales de las de otro que corra a la vez.
pub fn new_run() -> String {
    ObjectId::new().to_hex()
}

/// Colección provisional del destino donde se escribe `collection` antes de renombrarla encima.
pub fn staging_name(collection: &str, run: &str) -> String {
    format!("{collection}.{STAGING_MARK}-{run}")
}

/// Espera a `fill` (que escribe en `staging`) y pone `staging` en el lugar de `collection`; si algo
/// falla, borra `staging`.
pub async fn replace_through_staging(
    destination: &Destination<'_>,
    db: &Database,
    collection: &str,
    staging: &str,
    fill: impl Future<Output = Result<CollectionResult, String>>,
) -> Result<CollectionResult, String> {
    let result = match fill.await {
        Ok(result) => replace_with(destination, db.name(), collection, staging).await.map(|_| result),
        Err(e) => Err(e),
    };
    if result.is_err() {
        // Lo provisional no debe quedarse en el destino; si el borrado falla, manda el error original.
        let _ = db.collection::<RawDocumentBuf>(staging).drop(None).await;
    }
    result
}

/// Pone `staging` en el lugar de `collection`, eliminando la anterior, en una sola operación.
async fn replace_with(destination: &Destination<'_>, db: &str, collection: &str, staging: &str) -> Result<(), String> {
    destination.safe_mode.ensure_writable()?;
    let namespace = |name: &str| format!("{db}.{name}");
    let command = doc! { "renameCollection": namespace(staging), "to": namespace(collection), "dropTarget": true };
    destination
        .client
        .database(ADMIN_DB)
        .run_command(command, None)
        .await
        .map(|_| ())
        .map_err(|e| format!("No se pudo reemplazar “{collection}”: {}", describe(e)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn staging_collection_keeps_the_name_and_marks_the_run() {
        assert_eq!(staging_name("orders", "abc"), "orders.robo3b-staging-abc");
    }
}
