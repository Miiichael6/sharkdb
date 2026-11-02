use std::rc::Rc;
use std::time::Duration;

use mongodb::bson::Bson;
use tokio::runtime::Handle;

use super::fake_bridge::FakeBridge;
use super::value;
use crate::shell::bridge::MongoBridge;
use crate::shell::engine::EngineLimits;
use crate::shell::outcome::ScriptErrorKind;
use crate::shell::runtime::ShellRuntime;
use crate::shell::session::RunOptions;

const DB: &str = "test";

#[tokio::test]
async fn cancel_stops_a_running_script_from_another_thread() {
    let runtime = ShellRuntime::spawn(EngineLimits::default(), Handle::current(), |_| {
        FakeBridge::shared() as Rc<dyn MongoBridge>
    })
    .unwrap();
    let (outcome, _) = tokio::join!(
        runtime.run(
            DB.into(),
            "while (true) {}".into(),
            None,
            RunOptions::default()
        ),
        async {
            tokio::time::sleep(Duration::from_millis(100)).await;
            runtime.cancel();
        }
    );
    assert_eq!(
        outcome.unwrap().error.map(|e| e.kind),
        Some(ScriptErrorKind::Cancelled)
    );

    let next = runtime.run(
        DB.into(),
        "var x = []; for (let i = 0; i < 3; i++) x.push(ObjectId()); x.length".into(),
        None,
        RunOptions::default(),
    );
    assert_eq!(value(&next.await.unwrap()), Some(Bson::Double(3.0)));
}

#[tokio::test]
async fn each_run_uses_the_timeout_it_is_given() {
    let runtime = ShellRuntime::spawn(EngineLimits::default(), Handle::current(), |_| {
        FakeBridge::shared() as Rc<dyn MongoBridge>
    })
    .unwrap();
    let options = RunOptions {
        timeout_seconds: 1,
        ..RunOptions::default()
    };
    let outcome = runtime
        .run(DB.into(), "while (true) {}".into(), None, options)
        .await
        .unwrap();
    let error = outcome.error.expect("tiempo agotado");
    assert_eq!(error.kind, ScriptErrorKind::Timeout);
    assert!(error.message.contains("1 s"), "{}", error.message);
}
