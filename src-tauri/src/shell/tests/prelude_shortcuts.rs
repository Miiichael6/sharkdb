//! Atajos del shell clásico contra el servidor falso: cada uno llega como el comando que daría
//! Robo 3T, sin que el script escriba `runCommand`. También `explain`, `it` y `watch`.

use mongodb::bson::{Bson, Document, doc};

use super::prelude::{DB, first_call, run_ok, session};
use super::{outputs, prints, value};
use crate::shell::outcome::ScriptOutput;

/// Script, base de datos y comando que debe recibir el servidor como primera llamada.
fn shortcuts() -> Vec<(&'static str, &'static str, Document)> {
    vec![
        (
            "db.x.renameCollection('y')",
            "admin",
            doc! { "renameCollection": "test.x", "to": "test.y", "dropTarget": false },
        ),
        (
            "db.createView('v', 'x', [{ $match: { a: 1 } }], { collation: { locale: 'es' } })",
            DB,
            doc! { "create": "v", "viewOn": "x", "pipeline": [{ "$match": { "a": 1 } }], "collation": { "locale": "es" } },
        ),
        (
            "db.x.dropIndexes()",
            DB,
            doc! { "dropIndexes": "x", "index": "*" },
        ),
        (
            "db.x.createIndexes([{ a: 1 }], { unique: true })",
            DB,
            doc! { "createIndexes": "x", "indexes": [{ "key": { "a": 1 }, "unique": true, "name": "a_1" }] },
        ),
        (
            "db.x.stats(1024)",
            DB,
            doc! { "collStats": "x", "scale": 1024 },
        ),
        ("db.x.dataSize()", DB, doc! { "collStats": "x" }),
        ("db.x.isCapped()", DB, doc! { "collStats": "x" }),
        (
            "db.x.validate(true)",
            DB,
            doc! { "validate": "x", "full": true },
        ),
        (
            "db.x.count({ a: 1 }, { limit: 2 })",
            DB,
            doc! { "count": "x", "query": { "a": 1 }, "limit": 2 },
        ),
        (
            "db.x.find({ a: 1 }).skip(2).limit(5).size()",
            DB,
            doc! { "count": "x", "query": { "a": 1 }, "skip": 2, "limit": 5 },
        ),
        (
            "db.x.find({ a: 1 }).skip(2).count()",
            DB,
            doc! { "count": "x", "query": { "a": 1 } },
        ),
        (
            "db.x.find({ a: 1 }).limit(5).explain()",
            DB,
            doc! { "explain": { "find": "x", "filter": { "a": 1 }, "limit": 5 }, "verbosity": "queryPlanner" },
        ),
        (
            "db.x.find().readPref('secondary').explain(true)",
            DB,
            doc! { "explain": { "find": "x", "filter": {} }, "verbosity": "allPlansExecution" },
        ),
        (
            "db.x.explain('executionStats').remove({ a: 1 })",
            DB,
            doc! { "explain": { "delete": "x", "deletes": [{ "q": { "a": 1 }, "limit": 0 }] }, "verbosity": "executionStats" },
        ),
        (
            "db.x.explain().find({ a: 1 }).limit(1)",
            DB,
            doc! { "explain": { "find": "x", "filter": { "a": 1 }, "limit": 1 }, "verbosity": "queryPlanner" },
        ),
        (
            "db.stats(1024)",
            DB,
            doc! { "dbStats": 1, "scale": 1024 },
        ),
        ("db.serverStatus()", "admin", doc! { "serverStatus": 1 }),
        (
            "db.currentOp(true)",
            "admin",
            doc! { "currentOp": 1, "$all": true },
        ),
        ("db.killOp(12)", "admin", doc! { "killOp": 1, "op": 12 }),
        ("db.isMaster()", DB, doc! { "isMaster": 1 }),
        ("db.hostInfo()", "admin", doc! { "hostInfo": 1 }),
        (
            "db.getMongo().getDBs()",
            "admin",
            doc! { "listDatabases": 1, "authorizedDatabases": true },
        ),
        ("db.dropUser('ana')", DB, doc! { "dropUser": "ana" }),
        (
            "db.updateUser('ana', { roles: [] })",
            DB,
            doc! { "updateUser": "ana", "roles": [] },
        ),
        (
            "db.grantRolesToUser('ana', ['read'])",
            DB,
            doc! { "grantRolesToUser": "ana", "roles": ["read"] },
        ),
        (
            "db.revokeRolesFromUser('ana', ['read'])",
            DB,
            doc! { "revokeRolesFromUser": "ana", "roles": ["read"] },
        ),
        ("rs.status()", "admin", doc! { "replSetGetStatus": 1 }),
        ("rs.conf()", "admin", doc! { "replSetGetConfig": 1 }),
    ]
}

#[test]
fn shortcuts_send_the_classic_shell_commands() {
    for (code, db, command) in shortcuts() {
        let (mut session, _) = session();
        run_ok(&mut session, code);
        let call = first_call(&mut session);
        assert_eq!(call.get_str("db"), Ok(db), "{code}");
        assert_eq!(call.get_document("command"), Ok(&command), "{code}");
    }
}

#[test]
fn cursor_modifiers_of_the_classic_shell_reach_find() {
    let (mut session, _) = session();
    run_ok(
        &mut session,
        "db.x.find().collation({ locale: 'es' }).min({ a: 1 }).max({ a: 9 }).comment('c')
           .noCursorTimeout().allowDiskUse().readPref('secondary').pretty().toArray()",
    );
    let options = first_call(&mut session).get_document("options").cloned();
    assert_eq!(
        options,
        Ok(doc! {
            "collation": { "locale": "es" }, "min": { "a": 1 }, "max": { "a": 9 }, "comment": "c",
            "noCursorTimeout": true, "allowDiskUse": true, "readPref": { "mode": "secondary" },
        })
    );
}

#[test]
fn create_user_prints_the_user_without_its_password() {
    let (mut session, _) = session();
    let outcome = run_ok(
        &mut session,
        "db.createUser({ user: 'ana', pwd: 'secreto', roles: [] })",
    );
    assert_eq!(
        prints(&outcome),
        ["Successfully added user: {\n\t\"user\" : \"ana\",\n\t\"roles\" : [ ]\n}"]
    );
    assert_eq!(
        first_call(&mut session).get_document("command"),
        Ok(&doc! { "createUser": "ana", "pwd": "secreto", "roles": [] })
    );
}

#[test]
fn it_continues_the_last_cursor_until_it_runs_out() {
    let (mut session, _) = session();
    run_ok(&mut session, "db.x.find()");
    let first_id = |outcome: &crate::shell::outcome::ScriptOutcome| match &outputs(outcome)[..] {
        [
            ScriptOutput::Cursor {
                documents,
                exhausted,
                ..
            },
        ] => (documents[0].clone(), *exhausted),
        other => panic!("se esperaba un cursor: {other:?}"),
    };
    let first = |id: i32| Bson::Document(doc! { "_id": id });
    assert_eq!(first_id(&run_ok(&mut session, "it")), (first(50), false));
    assert_eq!(first_id(&run_ok(&mut session, "it")), (first(100), true));

    let error = session
        .run(DB, "it", None)
        .error
        .expect("sin más documentos");
    assert!(
        error.message.contains("it: no hay un cursor anterior"),
        "{error:?}"
    );
}

#[test]
fn it_can_be_reassigned_as_a_plain_variable() {
    let (mut session, _) = session();
    run_ok(&mut session, "it = 5");
    assert_eq!(
        value(&run_ok(&mut session, "it + 1")),
        Some(Bson::Int32(6))
    );
}

#[test]
fn watch_fails_instead_of_blocking() {
    let (mut session, _) = session();
    let error = session
        .run(DB, "db.x.watch()", None)
        .error
        .expect("watch no se admite");
    assert!(
        error
            .message
            .contains("watch: los change streams no se pueden seguir"),
        "{error:?}"
    );
}

#[test]
fn sh_status_requires_a_mongos() {
    let (mut session, _) = session();
    let error = session
        .run(DB, "sh.status()", None)
        .error
        .expect("no es un mongos");
    assert!(error.message.contains("no es un mongos"), "{error:?}");
}
