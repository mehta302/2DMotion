use base64::Engine;
use serde::Serialize;
use std::fs;
use tauri::{AppHandle, Emitter};
use tauri_plugin_dialog::DialogExt;
use tokio::time;
use libloading;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(x: f64, y: f64) -> f64 {
    let result: f64;

    unsafe {
        let lib = libloading::Library::new(".\\src\\add.dll").unwrap();
        let test: libloading::Symbol<unsafe extern "C" fn(f64, f64) -> f64> = lib.get(b"add").unwrap();
        result = test(x, y);
    }

    return result;
}

const S: u64 = 17;
const G: f32 = 9.81;
const F: u32 = 60;

#[derive(Clone, Serialize)]
struct Pos {
    x: f32,
    y: f32,
}

fn mxd(u: f32, theta: f32) -> f32 {
    return ((u * u) * (2.0 * theta).sin()) / G;
}

#[tauri::command]
async fn calc_pos(app: AppHandle, speed: f32, angle: f32) {
    let dx: f32 = mxd(speed, angle) / F as f32;
    let mx: f32 = 100.0 / speed;
    let scale: f32 = 1.0 / mxd(100.0, 45.0);

    let mut frame: u32 = 1;
    let mut interval = time::interval(time::Duration::from_millis(S));

    while frame <= F {
        interval.tick().await;

        let h = frame as f32 * dx;
        let _x = h * scale * mx;
        let _y = (h * angle.tan() - (G * h * h) / (2.0 * speed * speed * angle.cos().powi(2)))
            * scale
            * mx;

        app.emit("step", Pos { x: _x, y: _y }).unwrap();

        frame += 1;
    }
}

#[tauri::command]
fn export_data(app: AppHandle, buffer: String) -> String {
    println!("DEBUG: START");
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(&buffer)
        .unwrap_or_default();

    println!("DEBUG: Decoded...");
    let file_path = app
        .dialog()
        .file()
        .add_filter("Filter", &["xlsx"])
        .blocking_save_file();

    println!("DEBUG: File chosen...");
    if let Some(path) = file_path {
        let path_buf: std::path::PathBuf = std::path::PathBuf::from(path.to_string());
        let _ = fs::write(&path_buf, bytes);
        return path_buf.to_string_lossy().to_string();
    } else {
        return String::from("");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, calc_pos, export_data])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
