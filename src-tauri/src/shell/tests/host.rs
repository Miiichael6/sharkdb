//! Globales del shell clásico que da `host/`: `sleep`, `load`, `hex_md5` y `Object.bsonsize`.

use std::time::{Duration, Instant};

use mongodb::bson::Bson;

use super::fake_bridge::FakeBridge;
use super::prelude::{DB, run_ok, session};
use super::{test_limits, value};
use crate::shell::engine::EngineLimits;
use crate::shell::outcome::ScriptErrorKind;
use crate::shell::session::ShellSession;
use crate::shell::watchdog::Watchdog;

const SHORT_TIMEOUT: Duration = Duration::from_millis(200);

#[test]
fn sleep_waits_the_given_milliseconds() {
    let (mut session, _) = session();
    let start = Instant::now();
    run_ok(&mut session, "sleep(50)");
    assert!(start.elapsed() >= Duration::from_millis(50));
}

#[test]
fn each_result_carries_the_time_of_its_own_statement() {
    let (mut session, _) = session();
    let outcome = run_ok(&mut session, "(sleep(50), 'lenta');\n'rápida'");
    let times: Vec<_> = outcome.results.iter().map(|r| r.elapsed_ms).collect();
    assert!(
        matches!(times[..], [slow, fast] if slow >= 50 && fast < 50),
        "{times:?}"
    );
}

#[test]
fn sleep_stops_at_the_script_timeout() {
    let limits = EngineLimits {
        timeout: SHORT_TIMEOUT,
        ..test_limits()
    };
    let watchdog = Watchdog::new(Default::default());
    let mut session = ShellSession::new(limits, watchdog, FakeBridge::shared()).expect("sesión");
    let start = Instant::now();
    let error = session
        .run(DB, "sleep(60000)", None)
        .error
        .expect("tiempo agotado");
    assert_eq!(error.kind, ScriptErrorKind::Timeout, "{error:?}");
    assert!(start.elapsed() < 10 * SHORT_TIMEOUT);
}

#[test]
fn load_runs_a_file_relative_to_the_script_folder() {
    let dir = std::env::temp_dir().join(format!("sharkdb-load-{}", std::process::id()));
    std::fs::create_dir_all(&dir).expect("carpeta");
    std::fs::write(dir.join("helpers.js"), "var loaded = 42;").expect("script");

    let (mut session, _) = session();
    let outcome = session.run(DB, "load('helpers.js')", Some(dir.clone()));
    std::fs::remove_dir_all(&dir).ok();
    assert_eq!(value(&outcome), Some(Bson::Boolean(true)), "{outcome:?}");
    assert_eq!(
        value(&run_ok(&mut session, "loaded")),
        Some(Bson::Int32(42))
    );

    let error = session
        .run(DB, "load('helpers.js')", None)
        .error
        .expect("sin carpeta");
    assert!(
        error.message.contains("no tiene un script guardado"),
        "{error:?}"
    );
}

#[test]
fn hex_md5_and_bsonsize_match_the_classic_shell() {
    let (mut session, _) = session();
    assert_eq!(
        value(&run_ok(&mut session, "hex_md5('abc')")),
        Some(Bson::String("900150983cd24fb0d6963f7d28e17f72".into()))
    );
    assert_eq!(
        value(&run_ok(&mut session, "Object.bsonsize({})")),
        Some(Bson::Int32(5))
    );
}
