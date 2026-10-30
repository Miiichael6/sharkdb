//! Vigila el script en curso: QuickJS consulta al watchdog periódicamente y, si hay que cortar
//! (cancelación desde otro hilo o tiempo agotado), recuerda el motivo para el mensaje de error.

use std::cell::Cell;
use std::rc::Rc;
use std::sync::Arc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, Instant};

use rquickjs::runtime::InterruptHandler;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Interruption {
    Timeout,
    Cancelled,
}

#[derive(Clone)]
pub struct Watchdog {
    cancel: Arc<AtomicBool>,
    deadline: Rc<Cell<Option<Instant>>>,
    fired: Rc<Cell<Option<Interruption>>>,
}

impl Watchdog {
    /// `cancel` es la bandera que otro hilo pone a `true` para cortar el script en curso.
    pub fn new(cancel: Arc<AtomicBool>) -> Self {
        Self {
            cancel,
            deadline: Rc::default(),
            fired: Rc::default(),
        }
    }

    pub fn cancel_flag(&self) -> Arc<AtomicBool> {
        self.cancel.clone()
    }

    /// Empieza a vigilar un script nuevo con el tiempo máximo indicado.
    pub fn arm(&self, timeout: Duration) {
        self.cancel.store(false, Ordering::SeqCst);
        self.fired.set(None);
        self.deadline.set(Some(Instant::now() + timeout));
    }

    pub fn disarm(&self) {
        self.deadline.set(None);
    }

    /// Motivo por el que se cortó el último script, si se cortó.
    pub fn fired(&self) -> Option<Interruption> {
        self.fired.get()
    }

    pub fn interrupt_handler(&self) -> InterruptHandler {
        let watchdog = self.clone();
        Box::new(move || watchdog.check())
    }

    fn check(&self) -> bool {
        let reason = if self.cancel.load(Ordering::SeqCst) {
            Some(Interruption::Cancelled)
        } else if self.deadline.get().is_some_and(|d| Instant::now() >= d) {
            Some(Interruption::Timeout)
        } else {
            None
        };
        if reason.is_some() {
            self.fired.set(reason);
        }
        reason.is_some()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fires_on_cancel_and_on_timeout() {
        let cancel = Arc::new(AtomicBool::new(false));
        let watchdog = Watchdog::new(cancel.clone());

        watchdog.arm(Duration::from_secs(60));
        assert!(!watchdog.check());
        cancel.store(true, Ordering::SeqCst);
        assert!(watchdog.check());
        assert_eq!(watchdog.fired(), Some(Interruption::Cancelled));

        watchdog.arm(Duration::ZERO);
        assert!(watchdog.check());
        assert_eq!(watchdog.fired(), Some(Interruption::Timeout));

        watchdog.disarm();
        assert!(!watchdog.check());
    }
}
