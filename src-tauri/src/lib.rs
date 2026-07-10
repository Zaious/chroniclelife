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

/// Reads a file's contents as a UTF-8 string.
/// - File missing → `Ok(None)` (this is the normal "first run" case).
/// - File present but unreadable (locked/permissions/other IO error) → `Err(message)`.
///   This must NOT be collapsed into `None`: the frontend treats `None` as "no file yet"
///   and would otherwise overwrite real data with defaults on the next save.
fn read_file_contents(path: &PathBuf) -> Result<Option<String>, String> {
    match fs::read_to_string(path) {
        Ok(contents) => Ok(Some(contents)),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("讀取 {} 失敗: {e}", path.display())),
    }
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
fn load_data(app: AppHandle) -> Result<Option<String>, String> {
    let path = resolve_data_path(&app, DATA_FILE_NAME)?;
    read_file_contents(&path)
}

#[tauri::command]
fn save_data(app: AppHandle, json: String) -> Result<(), String> {
    let path = resolve_data_path(&app, DATA_FILE_NAME)?;
    write_file_atomic(&path, &json)
}

#[tauri::command]
fn load_settings(app: AppHandle) -> Result<Option<String>, String> {
    let path = resolve_data_path(&app, SETTINGS_FILE_NAME)?;
    read_file_contents(&path)
}

#[tauri::command]
fn save_settings(app: AppHandle, json: String) -> Result<(), String> {
    let path = resolve_data_path(&app, SETTINGS_FILE_NAME)?;
    write_file_atomic(&path, &json)
}

/// Fully exits the application (not just hiding the window). Invoked from the frontend's
/// handle-row "×" button, mirroring the tray menu's "離開" entry.
#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
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
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            load_data,
            save_data,
            load_settings,
            save_settings,
            quit_app
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

/// Verifies the exact `read_file_contents` contract this task hardened (missing file → `Ok(None)`;
/// readable file → `Ok(Some(_))`; unreadable path → `Err(_)`, never silently collapsed to `None`).
/// A directory path is used to force a real (non-`NotFound`) IO error deterministically and
/// cross-platform, without relying on OS-specific permission APIs.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn missing_file_is_ok_none() {
        let path = std::env::temp_dir().join("chroniclelife_test_missing_definitely_not_here.json");
        let _ = fs::remove_file(&path);
        assert_eq!(read_file_contents(&path), Ok(None));
    }

    #[test]
    fn existing_readable_file_is_ok_some() {
        let path = std::env::temp_dir().join("chroniclelife_test_existing_readable.json");
        fs::write(&path, "{\"hello\":true}").unwrap();
        assert_eq!(read_file_contents(&path), Ok(Some("{\"hello\":true}".to_string())));
        let _ = fs::remove_file(&path);
    }

    // Note: on Windows, `read_to_string` on a *directory* path surprisingly reports
    // `ErrorKind::NotFound` (raw OS error 3, ERROR_PATH_NOT_FOUND) rather than a distinct
    // "is a directory" kind — so a directory path is NOT a valid way to exercise the Err
    // branch here. Instead we open the file exclusively (share_mode(0)) to reproduce the
    // real "locked file" scenario this task is guarding against.
    #[cfg(windows)]
    #[test]
    fn locked_file_is_err_not_none() {
        use std::fs::OpenOptions;
        use std::os::windows::fs::OpenOptionsExt;

        let path = std::env::temp_dir().join("chroniclelife_test_locked.json");
        fs::write(&path, "{}").unwrap();

        let _locked = OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(0) // deny all sharing, forcing a genuine lock conflict
            .open(&path)
            .expect("failed to open exclusive lock for test setup");

        let result = read_file_contents(&path);
        assert!(
            matches!(result, Err(_)),
            "locked file must surface as Err, not None/Ok — got {result:?}"
        );

        drop(_locked);
        let _ = fs::remove_file(&path);
    }
}
