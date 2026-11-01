//! El reloj de las programaciones: un evento al empezar cada minuto de reloj.

use std::time::{Duration, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter};

const TICK_EVENT: &str = "backup-schedule-tick";
const MINUTE: Duration = Duration::from_secs(60);

/// Lo que falta hasta el siguiente minuto en punto, contado desde la época Unix.
fn until_next_minute(since_epoch: Duration) -> Duration {
    let into_minute = Duration::new(since_epoch.as_secs() % MINUTE.as_secs(), since_epoch.subsec_nanos());
    MINUTE - into_minute
}

/// Arranca el bucle que emite `TICK_EVENT` cada minuto mientras la app siga abierta. Cada espera se
/// calcula con la hora del sistema, así que tras suspender el equipo vuelve a cuadrar en el minuto.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default();
            tokio::time::sleep(until_next_minute(now)).await;
            // Sin ventana que escuche no hay nada que hacer: el error no detiene el reloj.
            let _ = app.emit(TICK_EVENT, ());
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn waits_until_the_next_minute_starts() {
        assert_eq!(until_next_minute(Duration::from_secs(120)), MINUTE);
        assert_eq!(until_next_minute(Duration::from_secs(125)), Duration::from_secs(55));
        assert_eq!(until_next_minute(Duration::from_millis(179_500)), Duration::from_millis(500));
    }
}
