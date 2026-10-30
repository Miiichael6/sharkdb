//! Tests del shell que necesitan el motor QuickJS completo.

mod convert;
mod engine;
mod runtime;

use std::sync::Arc;
use std::sync::atomic::AtomicBool;
use std::time::Duration;

use super::engine::{Engine, EngineLimits};

fn engine_with(limits: EngineLimits) -> Engine {
    Engine::new(limits, Arc::new(AtomicBool::new(false))).expect("motor")
}

fn engine() -> Engine {
    engine_with(EngineLimits {
        timeout: Duration::from_secs(10),
        ..EngineLimits::default()
    })
}
