use rand::{distributions::Alphanumeric, Rng};
use std::{fs, path::PathBuf};
use tauri::{Manager, Runtime};

const SYNC_KEYRING_SERVICE: &str = "educore.sync";
const RUNTIME_KEYRING_SERVICE: &str = "educore.runtime";
const SYNC_URL_KEY: &str = "sync_url";
const SYNC_AUTH_TOKEN_KEY: &str = "sync_auth_token";
const AUTH_SECRET_KEY: &str = "desktop_auth_secret";

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct StoredSyncConfig {
    pub url: String,
    pub auth_token: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct SyncConfigFilePayload {
    url: String,
    auth_token: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct RuntimeSecretFilePayload {
    auth_secret: String,
}

pub struct ProvisionedRuntimeEnv {
    pub auth_database_url: String,
    pub auth_database_auth_token: String,
    pub sync_database_url: String,
    pub sync_database_auth_token: String,
    pub auth_secret: String,
}

fn app_config_dir<R: Runtime>(app_handle: &tauri::AppHandle<R>) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|error| format!("Gagal menentukan app_config_dir: {error}"))?;

    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)
            .map_err(|error| format!("Gagal membuat folder konfigurasi app: {error}"))?;
    }

    Ok(base_dir)
}

fn sync_config_file_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    Ok(app_config_dir(app_handle)?.join("sync-config.json"))
}

fn runtime_secret_file_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    Ok(app_config_dir(app_handle)?.join("runtime-secrets.json"))
}

fn read_sync_config_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<StoredSyncConfig> {
    let file_path = sync_config_file_path(app_handle).ok()?;
    let raw = fs::read_to_string(file_path).ok()?;
    let parsed = serde_json::from_str::<SyncConfigFilePayload>(&raw).ok()?;

    if parsed.url.trim().is_empty() || parsed.auth_token.trim().is_empty() {
      return None;
    }

    Some(StoredSyncConfig {
      url: parsed.url,
      auth_token: parsed.auth_token,
    })
}

fn write_sync_config_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    payload: &StoredSyncConfig,
) -> Result<(), String> {
    let file_path = sync_config_file_path(app_handle)?;
    let encoded = serde_json::to_string_pretty(&SyncConfigFilePayload {
        url: payload.url.clone(),
        auth_token: payload.auth_token.clone(),
    })
    .map_err(|error| format!("Gagal serialisasi sync config: {error}"))?;

    fs::write(file_path, encoded)
        .map_err(|error| format!("Gagal menulis sync config file fallback: {error}"))?;

    Ok(())
}

fn read_runtime_secret_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<String> {
    let file_path = runtime_secret_file_path(app_handle).ok()?;
    let raw = fs::read_to_string(file_path).ok()?;
    let parsed = serde_json::from_str::<RuntimeSecretFilePayload>(&raw).ok()?;
    let auth_secret = parsed.auth_secret.trim().to_string();

    if auth_secret.is_empty() {
        return None;
    }

    Some(auth_secret)
}

fn write_runtime_secret_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    auth_secret: &str,
) -> Result<(), String> {
    let file_path = runtime_secret_file_path(app_handle)?;
    let encoded = serde_json::to_string_pretty(&RuntimeSecretFilePayload {
        auth_secret: auth_secret.to_string(),
    })
    .map_err(|error| format!("Gagal serialisasi runtime secret: {error}"))?;

    fs::write(file_path, encoded)
        .map_err(|error| format!("Gagal menulis runtime secret file fallback: {error}"))?;

    Ok(())
}

fn generate_auth_secret() -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(64)
        .map(char::from)
        .collect()
}

pub fn normalize_sync_url_for_client(raw_url: String) -> String {
    if raw_url.starts_with("libsql://") {
        raw_url.replacen("libsql://", "https://", 1)
    } else {
        raw_url
    }
}

pub fn read_sync_config<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<StoredSyncConfig> {
    let keyring_url = keyring::Entry::new(SYNC_KEYRING_SERVICE, SYNC_URL_KEY).ok();
    let keyring_token = keyring::Entry::new(SYNC_KEYRING_SERVICE, SYNC_AUTH_TOKEN_KEY).ok();

    let keyring_url_value = keyring_url.as_ref().and_then(|entry| entry.get_password().ok());
    let keyring_token_value = keyring_token
        .as_ref()
        .and_then(|entry| entry.get_password().ok());

    if let (Some(url), Some(auth_token)) = (keyring_url_value, keyring_token_value) {
        if !url.trim().is_empty() && !auth_token.trim().is_empty() {
            return Some(StoredSyncConfig { url, auth_token });
        }
    }

    if let Some(file_payload) = read_sync_config_file(app_handle) {
        return Some(file_payload);
    }

    let env_url = std::env::var("SYNC_DATABASE_URL")
        .or_else(|_| std::env::var("TURSO_DATABASE_URL"))
        .ok()?;
    let env_auth_token = std::env::var("SYNC_DATABASE_AUTH_TOKEN")
        .or_else(|_| std::env::var("TURSO_AUTH_TOKEN"))
        .ok()?;

    if env_url.trim().is_empty() || env_auth_token.trim().is_empty() {
        return None;
    }

    Some(StoredSyncConfig {
        url: env_url,
        auth_token: env_auth_token,
    })
}

pub fn save_sync_config<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    payload: &StoredSyncConfig,
) -> Result<(), String> {
    let keyring_url = keyring::Entry::new(SYNC_KEYRING_SERVICE, SYNC_URL_KEY)
        .map_err(|error| format!("Gagal inisialisasi keyring sync_url: {error}"))?;
    let keyring_token = keyring::Entry::new(SYNC_KEYRING_SERVICE, SYNC_AUTH_TOKEN_KEY)
        .map_err(|error| format!("Gagal inisialisasi keyring sync_auth_token: {error}"))?;

    let mut keyring_errors: Vec<String> = Vec::new();

    if let Err(error) = keyring_url.set_password(payload.url.trim()) {
        keyring_errors.push(format!("sync_url: {error}"));
    }
    if let Err(error) = keyring_token.set_password(payload.auth_token.trim()) {
        keyring_errors.push(format!("sync_auth_token: {error}"));
    }

    write_sync_config_file(app_handle, payload).map_err(|file_error| {
        if keyring_errors.is_empty() {
            format!("Berhasil simpan ke keyring tetapi gagal memperbarui fallback file: {file_error}")
        } else {
            format!(
                "Gagal simpan ke keyring ({}) dan fallback file: {}",
                keyring_errors.join("; "),
                file_error
            )
        }
    })?;

    Ok(())
}

fn resolve_or_create_auth_secret<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<String, String> {
    let keyring_entry = keyring::Entry::new(RUNTIME_KEYRING_SERVICE, AUTH_SECRET_KEY)
        .map_err(|error| format!("Gagal inisialisasi keyring auth secret: {error}"))?;

    if let Ok(secret) = keyring_entry.get_password() {
        if !secret.trim().is_empty() {
            return Ok(secret);
        }
    }

    if let Some(file_secret) = read_runtime_secret_file(app_handle) {
        if let Err(error) = keyring_entry.set_password(file_secret.as_str()) {
            log::warn!("[DesktopConfig] Gagal sinkron auth secret ke keyring: {error}");
        }
        return Ok(file_secret);
    }

    if let Ok(env_secret) = std::env::var("AUTH_SECRET").or_else(|_| std::env::var("NEXTAUTH_SECRET")) {
        if !env_secret.trim().is_empty() {
            let trimmed = env_secret.trim().to_string();
            if let Err(error) = keyring_entry.set_password(trimmed.as_str()) {
                log::warn!("[DesktopConfig] Gagal simpan auth secret env ke keyring: {error}");
            }
            write_runtime_secret_file(app_handle, trimmed.as_str())?;
            return Ok(trimmed);
        }
    }

    let generated_secret = generate_auth_secret();
    if let Err(error) = keyring_entry.set_password(generated_secret.as_str()) {
        log::warn!("[DesktopConfig] Gagal simpan auth secret baru ke keyring: {error}");
    }
    write_runtime_secret_file(app_handle, generated_secret.as_str())?;

    Ok(generated_secret)
}

pub fn resolve_provisioned_runtime_env<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<ProvisionedRuntimeEnv, String> {
    let sync_config = read_sync_config(app_handle).ok_or_else(|| {
        "Konfigurasi desktop belum lengkap. Isi URL sync dan auth token pada bootstrap desktop sebelum menjalankan MSI production.".to_string()
    })?;

    let auth_secret = resolve_or_create_auth_secret(app_handle)?;

    Ok(ProvisionedRuntimeEnv {
        auth_database_url: sync_config.url.clone(),
        auth_database_auth_token: sync_config.auth_token.clone(),
        sync_database_url: sync_config.url.clone(),
        sync_database_auth_token: sync_config.auth_token.clone(),
        auth_secret,
    })
}
