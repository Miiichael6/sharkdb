mod files;
mod mongo;
mod shell;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(mongo::Sessions::default())
        .manage(shell::ShellSessions::default())
        .invoke_handler(tauri::generate_handler![
            store::load_connections,
            store::save_connections,
            store::load_history,
            store::save_history,
            files::read_script,
            files::write_script,
            mongo::test_connection,
            mongo::connect,
            mongo::disconnect,
            mongo::run_command,
            shell::commands::execute_script,
            shell::commands::next_batch,
            shell::commands::close_cursor,
            shell::commands::cancel_script,
            shell::commands::close_shell,
            shell::commands::eval_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
