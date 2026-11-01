//! Tiempo que un script pasa esperando la respuesta del servidor a sus consultas (abrir un
//! `find`/`aggregate`, un comando), sin contar lo que tarda en traer y convertir documentos.
//! Es lo que Robo 3T muestra como tiempo de la consulta.

use std::cell::Cell;
use std::rc::Rc;
use std::time::{Duration, Instant};

#[derive(Clone, Default)]
pub struct QueryClock {
    total: Rc<Cell<Option<Duration>>>,
}

impl QueryClock {
    /// Ejecuta `query` sumando lo que tarda al total.
    pub fn measure<T>(&self, query: impl FnOnce() -> T) -> T {
        let started = Instant::now();
        let output = query();
        let spent = started.elapsed();
        self.total
            .set(Some(self.total.get().unwrap_or_default() + spent));
        output
    }

    /// Total desde la última llamada (`None` si no hubo consultas) y vuelve a cero.
    pub fn take(&self) -> Option<Duration> {
        self.total.take()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn adds_up_queries_until_taken() {
        let clock = QueryClock::default();
        assert_eq!(clock.take(), None);

        assert_eq!(clock.measure(|| 7), 7);
        clock.measure(|| ());
        assert!(clock.take().is_some());
        assert_eq!(clock.take(), None);
    }
}
