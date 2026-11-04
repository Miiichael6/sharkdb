//! Estado de cada colección de un trabajo (R94): recuerda el último avance de cada una, para que
//! los cambios de estado (copiada, aplicada, fallida) salgan con su porcentaje sin que quien los
//! avisa tenga que llevar la cuenta.

use std::collections::HashMap;
use std::sync::Mutex;

use super::CANCELLED;
use super::report::{CollectionProgress, CollectionState, Report};

type Key = (String, String);

pub struct CollectionTracker<'r, R> {
    report: &'r R,
    counts: Mutex<HashMap<Key, (u64, u64)>>,
}

impl<'r, R: Report> CollectionTracker<'r, R> {
    pub fn new(report: &'r R) -> Self {
        Self { report, counts: Mutex::default() }
    }

    pub fn running(&self, db: &str, collection: &str, done: u64, total: u64) {
        self.remember(db, collection, (done, total));
        self.send(db, collection, CollectionState::Running, (done, total), None);
    }

    /// Cómo acabó la colección: si salió bien pasa a `done_as` (copiada en su provisional o ya
    /// aplicada); un fallo suyo, a fallida. Parada por "Cancelar" o por el fallo de otra no cambia:
    /// el frontend la descarta.
    pub fn ended<T>(&self, db: &str, collection: &str, result: &Result<T, String>, done_as: CollectionState) {
        match result {
            Ok(_) => self.complete(db, collection, done_as),
            Err(e) if e == CANCELLED => {}
            Err(e) => self.failed(db, collection, e),
        }
    }

    pub fn applied(&self, db: &str, collection: &str) {
        self.complete(db, collection, CollectionState::Applied);
    }

    /// Se queda con el avance al que llegó.
    pub fn failed(&self, db: &str, collection: &str, error: &str) {
        let counts = self.last(db, collection);
        self.send(db, collection, CollectionState::Failed, counts, Some(error.to_string()));
    }

    /// Terminada: al 100 %, aunque el total fuera una estimación que se quedó corta o larga.
    fn complete(&self, db: &str, collection: &str, state: CollectionState) {
        let (done, _) = self.last(db, collection);
        self.remember(db, collection, (done, done));
        self.send(db, collection, state, (done, done), None);
    }

    fn send(&self, db: &str, collection: &str, state: CollectionState, (done, total): (u64, u64), error: Option<String>) {
        self.report.collection(CollectionProgress {
            db: db.to_string(),
            collection: collection.to_string(),
            state,
            done,
            total,
            error,
        });
    }

    fn remember(&self, db: &str, collection: &str, counts: (u64, u64)) {
        self.lock().insert((db.to_string(), collection.to_string()), counts);
    }

    fn last(&self, db: &str, collection: &str) -> (u64, u64) {
        self.lock().get(&(db.to_string(), collection.to_string())).copied().unwrap_or((0, 0))
    }

    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<Key, (u64, u64)>> {
        self.counts.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jobs::report::testing::Recorder;

    fn states(recorder: &Recorder) -> Vec<(String, CollectionState, u64, u64)> {
        recorder.collections().into_iter().map(|c| (format!("{}.{}", c.db, c.collection), c.state, c.done, c.total)).collect()
    }

    #[test]
    fn each_collection_keeps_its_own_progress_and_ends_at_full() {
        let recorder = Recorder::new();
        let tracker = CollectionTracker::new(&recorder);
        tracker.running("a", "x", 10, 100);
        tracker.running("a", "y", 1, 4);
        // La estimación del total se quedó corta: copiada al 100 % con lo que de verdad se escribió.
        tracker.running("a", "x", 120, 120);
        tracker.ended("a", "x", &Ok(()), CollectionState::Copied);
        tracker.applied("a", "x");
        assert_eq!(
            states(&recorder),
            [
                ("a.x".into(), CollectionState::Running, 10, 100),
                ("a.y".into(), CollectionState::Running, 1, 4),
                ("a.x".into(), CollectionState::Running, 120, 120),
                ("a.x".into(), CollectionState::Copied, 120, 120),
                ("a.x".into(), CollectionState::Applied, 120, 120),
            ]
        );
    }

    #[test]
    fn a_failure_keeps_the_progress_it_reached_and_says_why() {
        let recorder = Recorder::new();
        let tracker = CollectionTracker::new(&recorder);
        tracker.running("a", "y", 1, 4);
        tracker.failed("a", "y", "boom");
        tracker.failed("b", "never-started", "boom");
        let updates = recorder.collections();
        assert_eq!((updates[1].state, updates[1].done, updates[1].total), (CollectionState::Failed, 1, 4));
        assert_eq!(updates[1].error.as_deref(), Some("boom"));
        assert_eq!((updates[2].done, updates[2].total), (0, 0));
    }

    #[test]
    fn a_collection_stopped_by_a_cancellation_is_not_reported_as_failed() {
        let recorder = Recorder::new();
        let tracker = CollectionTracker::new(&recorder);
        tracker.ended::<()>("a", "x", &Err(CANCELLED.into()), CollectionState::Copied);
        assert!(recorder.collections().is_empty());
        tracker.ended::<()>("a", "x", &Err("boom".into()), CollectionState::Copied);
        assert_eq!(recorder.collections()[0].state, CollectionState::Failed);
    }

    #[test]
    fn the_error_is_left_out_of_the_event_unless_it_failed() {
        let recorder = Recorder::new();
        CollectionTracker::new(&recorder).running("a", "x", 0, 3);
        let json = serde_json::to_value(&recorder.collections()[0]).unwrap();
        assert_eq!(json, serde_json::json!({ "db": "a", "collection": "x", "state": "running", "done": 0, "total": 3 }));
    }
}
