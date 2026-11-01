mod backup;
mod files;
mod jobs;
mod mongo;
mod safe_mode;
mod schedule;
mod secrets;
mod shell;
mod ssh_tunnel;
mod store;
mod sync;
mod terminal;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(mongo::Sessions::default())
        .manage(shell::ShellSessions::default())
        .manage(jobs::Jobs::default())
        .setup(|app| {
            schedule::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            store::load_connections,
            store::save_connections,
            store::load_backup_schedules,
            store::save_backup_schedules,
            store::load_history,
            store::save_history,
            files::read_script,
            files::write_script,
            mongo::test_connection,
            mongo::connect,
            mongo::disconnect,
            mongo::open_detached,
            mongo::close_detached,
            mongo::run_command,
            mongo::set_safe_mode,
            shell::commands::execute_script,
            shell::commands::next_batch,
            shell::commands::close_cursor,
            shell::commands::cancel_script,
            shell::commands::close_shell,
            shell::commands::eval_document,
            terminal::open_mongosh,
            backup::commands::backup_databases,
            backup::commands::read_backup_catalog,
            backup::commands::open_backup_folder,
            backup::commands::restore_databases,
            schedule::commands::list_backup_runs,
            schedule::commands::delete_backup_runs,
            schedule::commands::show_system_notification,
            sync::commands::database_catalog,
            sync::commands::sync_databases,
            jobs::events::cancel_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
