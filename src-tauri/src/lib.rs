mod backup;
mod documents;
mod files;
mod jobs;
mod mongo;
mod rename;
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
    let context = tauri::generate_context!();
    rename::move_old_data(&context.config().identifier);
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(mongo::Sessions::default())
        .manage(shell::ShellSessions::default())
        .manage(jobs::Jobs::default())
        .setup(|app| {
            use tauri::Manager;
            // Cada ventana es un proceso: lo que tiene en marcha cada una se ve en la carpeta común (error 60).
            app.state::<jobs::Jobs>().share_between_instances(store::config_dir(app.handle())?.join("en-curso"));
            jobs::events::start_heartbeat(app.handle().clone());
            schedule::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            store::load_connections,
            store::save_connections,
            store::load_backup_schedules,
            store::save_backup_schedules,
            store::load_settings,
            store::save_settings,
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
            documents::replace_unchanged,
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
            backup::commands::find_leftovers,
            backup::commands::drop_leftovers,
            schedule::commands::list_backup_runs,
            schedule::commands::create_backup_run,
            schedule::commands::take_schedule_turn,
            schedule::commands::release_schedule_turn,
            schedule::commands::delete_backup_runs,
            schedule::commands::show_system_notification,
            sync::commands::database_catalog,
            sync::commands::sync_databases,
            jobs::events::cancel_job,
            jobs::events::busy_elsewhere,
        ])
        .run(context)
        .expect("error while running tauri application");
}
