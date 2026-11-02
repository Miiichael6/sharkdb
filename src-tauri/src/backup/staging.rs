//! Reemplazo de colecciones del destino, común al sync y al restore: cada una se escribe en una
//! provisional y, solo cuando todas se llenaron bien, se renombran encima de las originales
//! (`dropTarget`). Un fallo o una cancelación mientras se llenan dejan el destino como estaba.

use std::future::Future;

use mongodb::bson::{RawDocumentBuf, doc, oid::ObjectId};
use mongodb::{Client, Database};

use crate::jobs::report::CollectionResult;
use crate::mongo::describe;
use crate::safe_mode::SafeMode;

const ADMIN_DB: &str = "admin";
/// Marca de las colecciones provisionales en las que se escribe antes de reemplazar.
const STAGING_MARK: &str = "sharkdb-staging";

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

/// Provisional llena que espera a ponerse en el lugar de su colección.
struct Staged {
    db: Database,
    collection: String,
    staging: String,
}

/// Las provisionales de un trabajo: se llenan una a una y se ponen en su sitio todas al final, así
/// que si falla la tercera de cinco no queda el destino mezclado.
pub struct Replacements<'a> {
    destination: &'a Destination<'a>,
    staged: Vec<Staged>,
}

impl<'a> Replacements<'a> {
    pub fn new(destination: &'a Destination<'a>) -> Self {
        Self { destination, staged: Vec::new() }
    }

    /// Espera a `fill` (que escribe en `staging`). La provisional se apunta antes, para que
    /// `finish` la borre aunque falle a medio llenar.
    pub async fn stage(
        &mut self,
        db: &Database,
        collection: &str,
        staging: &str,
        fill: impl Future<Output = Result<CollectionResult, String>>,
    ) -> Result<CollectionResult, String> {
        self.staged.push(Staged { db: db.clone(), collection: collection.into(), staging: staging.into() });
        fill.await
    }

    /// Si todo se llenó (`filled`), pone cada provisional en el lugar de su colección; si no, las
    /// borra todas y el destino queda como estaba.
    pub async fn finish<T>(self, filled: Result<T, String>) -> Result<T, String> {
        match filled {
            Ok(value) => self.commit().await.map(|()| value),
            Err(e) => {
                drop_all(&self.staged).await;
                Err(e)
            }
        }
    }

    /// Cada renombrado es atómico, pero no el conjunto: si uno falla (o se activa el safe mode a
    /// mitad), los anteriores ya están hechos y el error lo dice.
    async fn commit(self) -> Result<(), String> {
        for (done, staged) in self.staged.iter().enumerate() {
            if let Err(e) = replace_with(self.destination, staged.db.name(), &staged.collection, &staged.staging).await {
                drop_all(&self.staged[done..]).await;
                return Err(partial_replace_error(e, &self.staged[..done]));
            }
        }
        Ok(())
    }
}

/// Lo provisional no debe quedarse en el destino; si un borrado falla, manda el error original.
async fn drop_all(staged: &[Staged]) {
    for s in staged {
        let _ = s.db.collection::<RawDocumentBuf>(&s.staging).drop(None).await;
    }
}

fn partial_replace_error(error: String, replaced: &[Staged]) -> String {
    if replaced.is_empty() {
        return format!("{error}. No se reemplazó ninguna colección");
    }
    let names: Vec<String> = replaced.iter().map(|s| format!("{}.{}", s.db.name(), s.collection)).collect();
    format!(
        "{error}. Ya se habían reemplazado {}; las demás siguen como estaban",
        names.join(", ")
    )
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

    #[tokio::test]
    async fn a_partial_replace_names_what_was_already_replaced() {
        // No se conecta: solo hace falta para nombrar las BDs.
        let client = Client::with_uri_str("mongodb://127.0.0.1:1").await.unwrap();
        let staged = |collection: &str| Staged {
            db: client.database("shop"),
            collection: collection.into(),
            staging: staging_name(collection, "r"),
        };
        assert_eq!(
            partial_replace_error("falló".into(), &[]),
            "falló. No se reemplazó ninguna colección"
        );
        assert_eq!(
            partial_replace_error("falló".into(), &[staged("a"), staged("b")]),
            "falló. Ya se habían reemplazado shop.a, shop.b; las demás siguen como estaban"
        );
    }

    #[test]
    fn staging_collection_keeps_the_name_and_marks_the_run() {
        assert_eq!(staging_name("orders", "abc"), "orders.sharkdb-staging-abc");
    }
}
