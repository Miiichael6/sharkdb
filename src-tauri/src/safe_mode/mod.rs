//! Safe mode: interruptor de solo lectura de una sesión. Mientras está activo ninguna escritura
//! llega a la BD, venga del shell, del árbol, del CRUD o de cualquier otro comando del backend.
//!
//! Cada sesión abierta tiene su `SafeMode` (`mongo::session_safe_mode`); quien vaya a escribir lo
//! comprueba antes: `check_command` para un comando cualquiera, `check_pipeline` para una
//! agregación y `ensure_writable` para operaciones que siempre escriben (copiar colecciones,
//! restaurar, sincronizar).

mod policy;

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};

use mongodb::bson::Document;

pub use policy::{is_write_command, is_write_pipeline};

pub const SAFE_MODE_ERROR: &str = "Safe mode activo: solo lectura";
/// `name` del error JS que lanza el shell cuando safe mode frena una escritura.
pub const SAFE_MODE_ERROR_NAME: &str = "SafeModeError";

/// Estado compartido entre la sesión y los shells que la usan: cambiarlo afecta al momento a
/// todos, incluidos los scripts que ya están en marcha.
#[derive(Clone, Debug, Default)]
pub struct SafeMode(Arc<AtomicBool>);

impl SafeMode {
    pub fn new(enabled: bool) -> Self {
        Self(Arc::new(AtomicBool::new(enabled)))
    }

    pub fn is_enabled(&self) -> bool {
        self.0.load(Ordering::SeqCst)
    }

    pub fn set(&self, enabled: bool) {
        self.0.store(enabled, Ordering::SeqCst);
    }

    /// Error si safe mode está activo; para operaciones que siempre escriben.
    pub fn ensure_writable(&self) -> Result<(), String> {
        if self.is_enabled() {
            Err(SAFE_MODE_ERROR.into())
        } else {
            Ok(())
        }
    }

    /// Error si safe mode está activo y el comando escribe.
    pub fn check_command(&self, command: &Document) -> Result<(), String> {
        if is_write_command(command) {
            self.ensure_writable()
        } else {
            Ok(())
        }
    }

    /// Error si safe mode está activo y la agregación escribe (`$out`, `$merge`).
    pub fn check_pipeline(&self, pipeline: &[Document]) -> Result<(), String> {
        if is_write_pipeline(pipeline) {
            self.ensure_writable()
        } else {
            Ok(())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mongodb::bson::doc;

    #[test]
    fn blocks_only_writes_and_only_while_enabled() {
        let safe = SafeMode::new(true);
        let insert = doc! { "insert": "x", "documents": [] };
        assert_eq!(safe.check_command(&insert), Err(SAFE_MODE_ERROR.into()));
        assert_eq!(safe.check_command(&doc! { "find": "x" }), Ok(()));
        assert_eq!(
            safe.check_pipeline(&[doc! { "$out": "y" }]),
            Err(SAFE_MODE_ERROR.into())
        );
        assert!(safe.ensure_writable().is_err());

        // Las copias comparten el estado: así lo ven los shells abiertos.
        safe.clone().set(false);
        assert_eq!(safe.check_command(&insert), Ok(()));
        assert_eq!(safe.ensure_writable(), Ok(()));
    }
}
