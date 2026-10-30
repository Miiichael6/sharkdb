//! Shell de Mongo: motor JavaScript embebido (QuickJS) con los tipos BSON del shell.
//!
//! - `runtime`: actor; un hilo por sesión que recibe scripts por canal.
//! - `engine`: fachada sobre QuickJS; instala los `ShellModule` y produce el `ScriptOutcome`.
//! - `bson_types`, `output`: módulos instalables (constructores BSON, `print`/`printjson`).
//! - `convert`: JS ↔ BSON sin pérdida de tipos.

mod bson_types;
mod convert;
mod engine;
mod errors;
mod module;
mod outcome;
mod output;
mod runtime;
mod watchdog;

#[cfg(test)]
mod tests;

pub use engine::EngineLimits;
pub use outcome::ScriptOutcome;
pub use runtime::ShellRuntime;
