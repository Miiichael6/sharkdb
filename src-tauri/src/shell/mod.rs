//! Shell de Mongo: motor JavaScript embebido (QuickJS) con los tipos BSON del shell.
//!
//! - `runtime`: actor; un hilo por sesión que recibe scripts por canal.
//! - `engine`: fachada sobre QuickJS; instala los `ShellModule` y produce el `ScriptOutcome`.
//! - `bson_types`, `output`: módulos instalables (constructores BSON, `print`/`printjson`).
//! - `convert`: JS ↔ BSON sin pérdida de tipos.
//! - `session`: motor + API `db` (`prelude`) sobre un `MongoBridge` (`native` en producción).
//! - `syntax`: reescritura de `use x` / `show dbs` a llamadas JS.
//! - `statements`, `statement_run`: el script se parte en sentencias y cada una que devuelve algo
//!   deja su propio resultado.
//! - `document_eval`: texto del editor de documentos → documento BSON, con un motor sin `db`.
//! - `commands`: comandos Tauri (`execute_script`, `next_batch`, `close_cursor`, `cancel_script`,
//!   `close_shell`, `eval_document`).

mod bridge;
mod bson_types;
pub mod commands;
mod convert;
mod document_eval;
mod engine;
mod errors;
mod module;
mod native;
mod outcome;
mod output;
mod prelude;
mod runtime;
mod session;
mod statement_run;
mod statements;
mod syntax;
mod watchdog;

#[cfg(test)]
mod tests;

pub use commands::ShellSessions;
