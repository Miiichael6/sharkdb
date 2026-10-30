mod mongo;
mod shell;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(mongo::Sessions::default())
        .invoke_handler(tauri::generate_handler![
            store::load_connections,
            store::save_connections,
            mongo::test_connection,
            mongo::connect,
            mongo::disconnect,
            mongo::run_command,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
