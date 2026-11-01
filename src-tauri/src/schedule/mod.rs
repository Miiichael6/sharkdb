//! Backups programados (32): el backend solo marca el paso del tiempo y gestiona las carpetas de las
//! ejecuciones; qué programación toca y cuándo lo decide el frontend (`scheduleTiming.ts`).
//!
//! - `ticker`: emite `backup-schedule-tick` al empezar cada minuto, mientras la app está abierta (D15).
//! - `runs`: lista y borra las carpetas fechadas de las ejecuciones (D16), nunca otra cosa.
//! - `commands`: comandos Tauri finos (`list_backup_runs`, `delete_backup_runs`, `show_system_notification`).

pub mod commands;
mod runs;
mod ticker;

pub use ticker::start;
