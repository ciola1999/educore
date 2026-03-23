mod auth;

use crate::auth::service::{
    authenticate_with_biometric, get_sync_config, login, set_password, set_sync_config,
    verify_password,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())

        .invoke_handler(tauri::generate_handler![
            login,
            authenticate_with_biometric,
            set_password,
            verify_password,
            get_sync_config,
            set_sync_config
        ])
        .setup(|app| {
                if cfg!(debug_assertions) {
                    app.handle().plugin(
                        tauri_plugin_log::Builder::default()
                            .level(log::LevelFilter::Info)
                            .build(),
                    )?;
                }
                Ok(())
            })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
