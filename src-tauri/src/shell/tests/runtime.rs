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

const DB: &str = "test";

#[tokio::test]
async fn cancel_stops_a_running_script_from_another_thread() {
    let runtime = ShellRuntime::spawn(EngineLimits::default(), Handle::current(), |_| {
        FakeBridge::shared() as Rc<dyn MongoBridge>
    })
    .unwrap();
    let (outcome, _) = tokio::join!(runtime.run(DB.into(), "while (true) {}".into(), None), async {
        tokio::time::sleep(Duration::from_millis(100)).await;
        runtime.cancel();
    });
    assert_eq!(
        outcome.unwrap().error.map(|e| e.kind),
        Some(ScriptErrorKind::Cancelled)
    );

    let next = runtime.run(
        DB.into(),
        "var x = []; for (let i = 0; i < 3; i++) x.push(ObjectId()); x.length".into(),
        None,
    );
    assert_eq!(value(&next.await.unwrap()), Some(Bson::Double(3.0)));
}
