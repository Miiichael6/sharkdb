//! Cursores abiertos de una sesión de shell, por id. Al soltar el registro se sueltan sus
//! cursores, y el driver los cierra en el servidor (`killCursors`).

use std::collections::HashMap;

use crate::shell::outcome::CursorId;

pub struct CursorRegistry<C> {
    next_id: CursorId,
    open: HashMap<CursorId, C>,
}

impl<C> Default for CursorRegistry<C> {
    fn default() -> Self {
        Self {
            next_id: 1,
            open: HashMap::new(),
        }
    }
}

impl<C> CursorRegistry<C> {
    pub fn insert(&mut self, cursor: C) -> CursorId {
        let id = self.next_id;
        self.next_id = self.next_id.wrapping_add(1).max(1);
        self.open.insert(id, cursor);
        id
    }

    /// Saca el cursor para leer de él sin tener prestado el registro; se devuelve con `insert_at`
    /// si sigue vivo.
    pub fn take(&mut self, id: CursorId) -> Option<C> {
        self.open.remove(&id)
    }

    pub fn insert_at(&mut self, id: CursorId, cursor: C) {
        self.open.insert(id, cursor);
    }

    pub fn retain(&mut self, keep: &[CursorId]) {
        self.open.retain(|id, _| keep.contains(id));
    }

    #[cfg(test)]
    fn ids(&self) -> Vec<CursorId> {
        let mut ids: Vec<_> = self.open.keys().copied().collect();
        ids.sort_unstable();
        ids
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn assigns_ids_and_keeps_only_retained_cursors() {
        let mut registry = CursorRegistry::default();
        let a = registry.insert("a");
        let b = registry.insert("b");
        let c = registry.insert("c");
        assert_eq!((a, b, c), (1, 2, 3));

        registry.retain(&[b]);
        assert_eq!(registry.ids(), [b]);

        let cursor = registry.take(b).unwrap();
        assert_eq!(registry.take(b), None);
        registry.insert_at(b, cursor);
        assert_eq!(registry.ids(), [b]);
    }
}
