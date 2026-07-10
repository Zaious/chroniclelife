// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use std::fs;
use std::path::PathBuf;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Manager};

const DATA_FILE_NAME: &str = "data.json";
const SETTINGS_FILE_NAME: &str = "settings.json";

/// Resolves the absolute path of a file inside the app's data directory.
fn resolve_data_path(app: &AppHandle, file_name: &str) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("無法解析 app data 目錄: {e}"))?;
    Ok(dir.join(file_name))
}

/// Reads a file's contents as a UTF-8 string. Returns `None` if the file does not exist.
fn read_file_contents(path: &PathBuf) -> Option<String> {
    fs::read_to_string(path).ok()
}

/// Writes `contents` to `path` atomically: writes to a sibling `.tmp` file first,
/// then renames it over the destination. Creates the parent directory if missing.
fn write_file_atomic(path: &PathBuf, contents: &str) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| format!("無法建立目錄 {}: {e}", dir.display()))?;
    }

    let mut tmp_name = path.as_os_str().to_os_string();
    tmp_name.push(".tmp");
    let tmp_path = PathBuf::from(tmp_name);

    fs::write(&tmp_path, contents)
        .map_err(|e| format!("寫入暫存檔 {} 失敗: {e}", tmp_path.display()))?;
    fs::rename(&tmp_path, path)
        .map_err(|e| format!("覆蓋 {} 失敗: {e}", path.display()))?;

    Ok(())
}

#[tauri::command]
fn load_data(app: AppHandle) -> Option<String> {
    let path = resolve_data_path(&app, DATA_FILE_NAME).ok()?;
    read_file_contents(&path)
}

#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    let path = resolve_data_path(&app, DATA_FILE_NAME)?;
    write_file_atomic(&path, &json)
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Option<String> {
    let path = resolve_data_path(&app, SETTINGS_FILE_NAME).ok()?;
    read_file_contents(&path)
}

#[tauri::command]
fn save_settings(app: AppHandle, json: String) -> Result<(), String> {
    let path = resolve_data_path(&app, SETTINGS_FILE_NAME)?;
    write_file_atomic(&path, &json)
}

/// Shows the main window if hidden, hides it if shown. No-op if the window is missing.
fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let is_visible = window.is_visible().unwrap_or(false);
        if is_visible {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            load_settings,
            save_settings
        ])
        .setup(|app| {
            let show_hide = MenuItem::with_id(app, "show_hide", "顯示/隱藏", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "離開", true, None::<&str>)?;
            let tray_menu = Menu::with_items(app, &[&show_hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show_hide" => toggle_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
