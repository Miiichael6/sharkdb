use std::time::Duration;

use mongodb::bson::Bson;

use crate::shell::engine::EngineLimits;
use crate::shell::outcome::ScriptErrorKind;
use crate::shell::runtime::ShellRuntime;

#[tokio::test]
async fn cancel_stops_a_running_script_from_another_thread() {
    let runtime = ShellRuntime::spawn(EngineLimits::default()).unwrap();
    let (outcome, _) = tokio::join!(runtime.run("while (true) {}".into()), async {
        tokio::time::sleep(Duration::from_millis(100)).await;
        runtime.cancel();
    });
    assert_eq!(
        outcome.unwrap().error.map(|e| e.kind),
        Some(ScriptErrorKind::Cancelled)
    );

    let next =
        runtime.run("var x = []; for (let i = 0; i < 3; i++) x.push(ObjectId()); x.length".into());
    assert_eq!(next.await.unwrap().value, Some(Bson::Double(3.0)));
}
