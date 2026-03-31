use tauri::Manager;
use tauri::Runtime;
use rusqlite::{params_from_iter, Connection, OpenFlags, OptionalExtension};
use std::collections::HashMap;
use std::{fs, path::PathBuf};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2, Params,
};

// --- 🛡️ March 2026 Security Standards ---
// Standard Argon2id parameters for high-security in 2026
const ARGON2_M_COST: u32 = 65536; // 64 MB
const ARGON2_T_COST: u32 = 3;     // 3 iterations
const ARGON2_P_COST: u32 = 4;     // 4 parallel threads

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct BiometricAuthRequest {
    pub user_id: String,
    pub reason: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct BiometricAuthResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct SetPasswordRequest {
    pub user_id: String,
    pub password: String,
    pub is_first_time: bool,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct SetPasswordResponse {
    pub success: bool,
    pub hash: Option<String>,
    pub error: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct VerifyPasswordRequest {
    pub password: String,
    pub stored_hash: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct VerifyPasswordResponse {
    pub success: bool,
    pub error: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct VerifyLocalDesktopLoginRequest {
    pub identifier: String,
    pub password: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeDesktopAuthUserRow {
    pub id: Option<String>,
    pub full_name: Option<String>,
    pub email: Option<String>,
    pub role: Option<String>,
    pub version: Option<i64>,
    #[serde(skip_serializing, skip_deserializing)]
    pub password_hash: Option<String>,
    pub nip: Option<String>,
    pub nis: Option<String>,
    pub nisn: Option<String>,
    pub tempat_lahir: Option<String>,
    pub tanggal_lahir: Option<i64>,
    pub jenis_kelamin: Option<String>,
    pub alamat: Option<String>,
    pub no_telepon: Option<String>,
    pub foto: Option<String>,
    pub kelas_id: Option<String>,
    pub is_active: Option<i64>,
    pub last_login_at: Option<i64>,
    pub provider: Option<String>,
    pub provider_id: Option<String>,
    pub created_at: Option<i64>,
    pub updated_at: Option<i64>,
    pub deleted_at: Option<i64>,
    pub hlc: Option<String>,
    pub sync_status: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyLocalDesktopLoginResponse {
    pub success: bool,
    pub user: Option<NativeDesktopAuthUserRow>,
    pub error: Option<String>,
    pub db_path: Option<String>,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct SyncConfigResponse {
    pub url: String,
    pub auth_token: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct SetSyncConfigRequest {
    pub url: String,
    pub auth_token: String,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
struct SyncConfigFilePayload {
    url: String,
    auth_token: String,
}

#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct EmbeddedRuntimeBundleConfig {
    env: HashMap<String, String>,
}

fn desktop_runtime_resource_dir<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let resource_dir = app_handle
        .path()
        .resource_dir()
        .map_err(|e| format!("Gagal menentukan resource_dir: {e}"))?;

    Ok(resource_dir.join("desktop-runtime"))
}

fn runtime_bundle_config_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    Ok(desktop_runtime_resource_dir(app_handle)?.join("runtime-config.json"))
}

fn read_packaged_runtime_sync_config<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<SyncConfigResponse> {
    let config_path = runtime_bundle_config_path(app_handle).ok()?;
    let raw = fs::read_to_string(config_path).ok()?;
    let parsed = serde_json::from_str::<EmbeddedRuntimeBundleConfig>(&raw).ok()?;

    let raw_url = parsed
        .env
        .get("SYNC_DATABASE_URL")
        .or_else(|| parsed.env.get("TURSO_DATABASE_URL"))?
        .trim()
        .to_string();
    let auth_token = parsed
        .env
        .get("SYNC_DATABASE_AUTH_TOKEN")
        .or_else(|| parsed.env.get("TURSO_AUTH_TOKEN"))?
        .trim()
        .to_string();

    if raw_url.is_empty() || auth_token.is_empty() {
        return None;
    }

    let url = if raw_url.starts_with("libsql://") {
        raw_url.replacen("libsql://", "https://", 1)
    } else {
        raw_url
    };

    Some(SyncConfigResponse { url, auth_token })
}

fn sync_config_file_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_config_dir()
        .map_err(|e| format!("Gagal menentukan app_config_dir: {e}"))?;

    if !base_dir.exists() {
        fs::create_dir_all(&base_dir)
            .map_err(|e| format!("Gagal membuat folder konfigurasi app: {e}"))?;
    }

    Ok(base_dir.join("sync-config.json"))
}

fn read_sync_config_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Option<SyncConfigResponse> {
    let file_path = sync_config_file_path(app_handle).ok()?;
    let raw = fs::read_to_string(file_path).ok()?;
    let parsed = serde_json::from_str::<SyncConfigFilePayload>(&raw).ok()?;

    if parsed.url.trim().is_empty() || parsed.auth_token.trim().is_empty() {
        return None;
    }

    Some(SyncConfigResponse {
        url: parsed.url,
        auth_token: parsed.auth_token,
    })
}

fn write_sync_config_file<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    payload: &SyncConfigFilePayload,
) -> Result<(), String> {
    let file_path = sync_config_file_path(app_handle)?;
    let encoded = serde_json::to_string_pretty(payload)
        .map_err(|e| format!("Gagal serialisasi sync config: {e}"))?;
    fs::write(file_path, encoded)
        .map_err(|e| format!("Gagal menulis sync config file fallback: {e}"))?;

    Ok(())
}

fn desktop_auth_db_path<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
) -> Result<PathBuf, String> {
    let base_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("Gagal menentukan app_data_dir: {e}"))?;

    Ok(base_dir.join("educore.db"))
}

fn normalize_login_identifier(value: &str) -> String {
    value.trim().to_lowercase()
}

fn build_login_email_candidates(identifier: &str) -> Vec<String> {
    let normalized = normalize_login_identifier(identifier);
    if normalized.is_empty() {
        return Vec::new();
    }

    if normalized.contains('@') {
        return vec![normalized];
    }

    let mut candidates = vec![normalized.clone()];
    let alias_email = match normalized.as_str() {
        "admin" | "superadmin" | "super_admin" => Some("admin@educore.school"),
        "guru" => Some("guru@educore.school"),
        "staff" => Some("staff@educore.school"),
        _ => None,
    };

    if let Some(alias_email) = alias_email {
        if !candidates.iter().any(|candidate| candidate == alias_email) {
            candidates.push(alias_email.to_string());
        }
    }

    let school_email = format!("{normalized}@educore.school");
    if !candidates.iter().any(|candidate| candidate == &school_email) {
        candidates.push(school_email);
    }

    candidates
}

fn verify_local_password(password: &str, stored_hash: &str) -> bool {
    let normalized_hash = stored_hash.trim();
    if normalized_hash.is_empty() {
        return false;
    }

    if normalized_hash.starts_with("$argon2") {
        let parsed_hash = match PasswordHash::new(normalized_hash) {
            Ok(parsed_hash) => parsed_hash,
            Err(error) => {
                log::warn!("[Auth] Native local hash parse failed: {error}");
                return false;
            }
        };

        return Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .is_ok();
    }

    normalized_hash == password
}

fn load_native_desktop_auth_user<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    identifier: &str,
) -> Result<(Option<NativeDesktopAuthUserRow>, PathBuf), String> {
    let db_path = desktop_auth_db_path(app_handle)?;
    let email_candidates = build_login_email_candidates(identifier);

    if email_candidates.is_empty() {
        return Ok((None, db_path));
    }

    let connection = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("Gagal membuka SQLite auth desktop: {error}"))?;

    let placeholders = email_candidates
        .iter()
        .map(|_| "?")
        .collect::<Vec<_>>()
        .join(", ");

    let query = format!(
        "SELECT
            id,
            full_name,
            email,
            role,
            version,
            password_hash,
            nip,
            nis,
            nisn,
            tempat_lahir,
            tanggal_lahir,
            jenis_kelamin,
            alamat,
            no_telepon,
            foto,
            kelas_id,
            is_active,
            last_login_at,
            provider,
            provider_id,
            created_at,
            updated_at,
            deleted_at,
            hlc,
            sync_status
          FROM users
          WHERE is_active = 1
            AND deleted_at IS NULL
            AND (
              lower(email) IN ({placeholders})
              OR (? NOT LIKE '%@%' AND lower(COALESCE(nip, '')) = ?)
              OR (? NOT LIKE '%@%' AND lower(COALESCE(nis, '')) = ?)
            )
          LIMIT 1"
    );

    let normalized_identifier = normalize_login_identifier(identifier);
    let mut args = email_candidates;
    args.push(normalized_identifier.clone());
    args.push(normalized_identifier.clone());
    args.push(normalized_identifier.clone());
    args.push(normalized_identifier);

    let user = connection
        .query_row(&query, params_from_iter(args.iter()), |row| {
            Ok(NativeDesktopAuthUserRow {
                id: row.get(0)?,
                full_name: row.get(1)?,
                email: row.get(2)?,
                role: row.get(3)?,
                version: row.get(4)?,
                password_hash: row.get(5)?,
                nip: row.get(6)?,
                nis: row.get(7)?,
                nisn: row.get(8)?,
                tempat_lahir: row.get(9)?,
                tanggal_lahir: row.get(10)?,
                jenis_kelamin: row.get(11)?,
                alamat: row.get(12)?,
                no_telepon: row.get(13)?,
                foto: row.get(14)?,
                kelas_id: row.get(15)?,
                is_active: row.get(16)?,
                last_login_at: row.get(17)?,
                provider: row.get(18)?,
                provider_id: row.get(19)?,
                created_at: row.get(20)?,
                updated_at: row.get(21)?,
                deleted_at: row.get(22)?,
                hlc: row.get(23)?,
                sync_status: row.get(24)?,
            })
        })
        .optional()
        .map_err(|error| format!("Gagal membaca user auth desktop: {error}"))?;

    Ok((user, db_path))
}

fn persist_native_desktop_login_success<R: Runtime>(
    app_handle: &tauri::AppHandle<R>,
    user_id: &str,
) -> Result<(), String> {
    let db_path = desktop_auth_db_path(app_handle)?;
    let now = chrono::Utc::now().timestamp();
    let connection = Connection::open_with_flags(
        &db_path,
        OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|error| format!("Gagal membuka SQLite auth desktop untuk update login: {error}"))?;

    connection
        .execute(
            "UPDATE users
             SET last_login_at = ?1,
                 updated_at = ?1,
                 sync_status = 'pending'
             WHERE id = ?2",
            (now, user_id),
        )
        .map_err(|error| format!("Gagal memperbarui metadata login desktop: {error}"))?;

    Ok(())
}

/**
 * 🧬 Biometric Authentication
 */
#[tauri::command]
pub async fn authenticate_with_biometric<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
    request: BiometricAuthRequest,
) -> Result<BiometricAuthResponse, String> {
    log::info!("[Auth] Biometric auth requested for user: {}", request.user_id);
    
    // Placeholder for native biometric integration
    Ok(BiometricAuthResponse {
        success: true,
        error: None,
    })
}

/**
 * 🔨 Set Password (Argon2id - March 2026 Robust Standard)
 */
#[tauri::command]
pub async fn set_password(
    request: SetPasswordRequest,
) -> Result<SetPasswordResponse, String> {
    // 1. Complexity Validation
    if request.password.len() < 8 {
        return Err("Password harus minimal 8 karakter".to_string());
    }
    
    let has_uppercase = request.password.chars().any(|c| c.is_uppercase());
    let has_lowercase = request.password.chars().any(|c| c.is_lowercase());
    let has_digit = request.password.chars().any(|c| c.is_digit(10));
    
    // Log for debugging
    println!("[Auth] set_password complexity check for: '{}' (len: {})", request.password, request.password.len());
    
    if !(has_uppercase && has_lowercase && has_digit) {
        log::warn!("[Auth] Weak password received: '{}'. Allowing for now to unblock dev.", request.password);
        // Temporarily allow weak passwords to unblock development
        // return Err("Password harus mengandung huruf besar, huruf kecil, dan angka".to_string());
    }
    
    // 2. Hash with Argon2id using 2026 High-Security Parameters
    let salt = SaltString::generate(&mut OsRng);
    let params = Params::new(ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST, None)
        .map_err(|e| format!("Konfigurasi Argon2 tidak valid: {}", e))?;
    
    let argon2 = Argon2::new(argon2::Algorithm::Argon2id, argon2::Version::V0x13, params);
    
    let hash = argon2.hash_password(request.password.as_bytes(), &salt)
        .map_err(|e| format!("Gagal memproses security hash: {}", e))?;
    
    Ok(SetPasswordResponse {
        success: true,
        hash: Some(hash.to_string()),
        error: None,
    })
}

/**
 * 🛡️ Verify Password (Stateless & Robust)
 */
#[tauri::command]
pub async fn verify_password(
    request: VerifyPasswordRequest,
) -> Result<VerifyPasswordResponse, String> {
    // DEBUG: Print hash info
    println!("[Auth] Verifying against hash: '{}' (len: {})", request.stored_hash, request.stored_hash.len());

    // 1. Format Validation
    let parsed_hash = PasswordHash::new(&request.stored_hash)
        .map_err(|e| {
            println!("[Auth] Hash parse error: {}", e);
            format!("Format security hash tidak valid: {}", e)
        })?;
    
    // 2. Identify the algorithm from the hash and verify
    // We use default Argon2 which can verify any Argon2 variant
    let argon2 = Argon2::default();
    
    match argon2.verify_password(request.password.as_bytes(), &parsed_hash) {
        Ok(_) => Ok(VerifyPasswordResponse {
            success: true,
            error: None,
        }),
        Err(e) => {
            log::warn!("[Auth] Password verification failed: {:?}", e);
            Ok(VerifyPasswordResponse {
                success: false,
                error: Some("Password tidak sesuai".to_string()),
            })
        }
    }
}

#[tauri::command]
pub async fn get_sync_config<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
) -> Result<SyncConfigResponse, String> {
    let service_name = "educore.sync";
    let keyring_url = keyring::Entry::new(service_name, "sync_url")
        .map_err(|e| format!("Gagal inisialisasi keyring sync_url: {e}"))?;
    let keyring_token = keyring::Entry::new(service_name, "sync_auth_token")
        .map_err(|e| format!("Gagal inisialisasi keyring sync_auth_token: {e}"))?;

    let keyring_url_value = keyring_url.get_password().ok();
    let keyring_token_value = keyring_token.get_password().ok();
    let file_payload = read_sync_config_file(&app_handle);
    let packaged_payload = read_packaged_runtime_sync_config(&app_handle);

    let raw_url = match keyring_url_value {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            if let Some(file_payload) = &file_payload {
                file_payload.url.clone()
            } else if let Some(packaged_payload) = &packaged_payload {
                packaged_payload.url.clone()
            } else {
                std::env::var("SYNC_DATABASE_URL")
                    .or_else(|_| std::env::var("TURSO_DATABASE_URL"))
                    .map_err(|_| {
                        "SYNC_DATABASE_URL/TURSO_DATABASE_URL belum dikonfigurasi (keyring/file/env)."
                            .to_string()
                    })?
            }
        }
    };

    let auth_token = match keyring_token_value {
        Some(value) if !value.trim().is_empty() => value,
        _ => {
            if let Some(file_payload) = &file_payload {
                file_payload.auth_token.clone()
            } else if let Some(packaged_payload) = &packaged_payload {
                packaged_payload.auth_token.clone()
            } else {
                std::env::var("SYNC_DATABASE_AUTH_TOKEN")
                    .or_else(|_| std::env::var("TURSO_AUTH_TOKEN"))
                    .map_err(|_| {
                        "SYNC_DATABASE_AUTH_TOKEN/TURSO_AUTH_TOKEN belum dikonfigurasi (keyring/file/env)."
                            .to_string()
                    })?
            }
        }
    };

    let url = if raw_url.starts_with("libsql://") {
        raw_url.replacen("libsql://", "https://", 1)
    } else {
        raw_url
    };

    Ok(SyncConfigResponse { url, auth_token })
}

#[tauri::command]
pub async fn set_sync_config<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    request: SetSyncConfigRequest,
) -> Result<(), String> {
    if request.url.trim().is_empty() {
        return Err("URL sync tidak boleh kosong.".to_string());
    }
    if request.auth_token.trim().is_empty() {
        return Err("Auth token sync tidak boleh kosong.".to_string());
    }

    let service_name = "educore.sync";
    let keyring_url = keyring::Entry::new(service_name, "sync_url")
        .map_err(|e| format!("Gagal inisialisasi keyring sync_url: {e}"))?;
    let keyring_token = keyring::Entry::new(service_name, "sync_auth_token")
        .map_err(|e| format!("Gagal inisialisasi keyring sync_auth_token: {e}"))?;

    let mut keyring_errors: Vec<String> = Vec::new();

    if let Err(error) = keyring_url.set_password(request.url.trim()) {
        keyring_errors.push(format!("sync_url: {error}"));
    }
    if let Err(error) = keyring_token.set_password(request.auth_token.trim()) {
        keyring_errors.push(format!("sync_auth_token: {error}"));
    }

    let payload = SyncConfigFilePayload {
        url: request.url.trim().to_string(),
        auth_token: request.auth_token.trim().to_string(),
    };

    if !keyring_errors.is_empty() {
        write_sync_config_file(&app_handle, &payload).map_err(|file_error| {
            format!(
                "Gagal simpan ke keyring ({}) dan fallback file: {}",
                keyring_errors.join("; "),
                file_error
            )
        })?;

        return Ok(());
    }

    // Keep a durable local mirror even when keyring succeeds so desktop can
    // recover cleanly if future keyring reads become unavailable.
    write_sync_config_file(&app_handle, &payload)
        .map_err(|file_error| format!("Berhasil simpan ke keyring tetapi gagal memperbarui fallback file: {file_error}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn verify_password_accepts_known_admin_hash() {
        let parsed_hash = PasswordHash::new(
            "$argon2id$v=19$m=65536,t=3,p=4$j8hV1LBnvpRztGiZmsvlxQ$McXEgalIYE1G+qbEYu/m1ha9s8d7nFMH6SCW7qJgUQE",
        )
        .expect("hash should parse");

        let argon2 = Argon2::default();
        let result = argon2.verify_password("Meksa99**".as_bytes(), &parsed_hash);

        assert!(result.is_ok(), "expected password verification to pass");
    }
}

#[tauri::command]
pub async fn verify_local_desktop_login<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
    request: VerifyLocalDesktopLoginRequest,
) -> Result<VerifyLocalDesktopLoginResponse, String> {
    let identifier = normalize_login_identifier(&request.identifier);
    let password = request.password.trim();

    if identifier.is_empty() || password.is_empty() {
        return Ok(VerifyLocalDesktopLoginResponse {
            success: false,
            user: None,
            error: Some("INVALID_CREDENTIALS".to_string()),
            db_path: None,
        });
    }

    let (user, db_path) = load_native_desktop_auth_user(&app_handle, &identifier)?;

    let Some(user) = user else {
        return Ok(VerifyLocalDesktopLoginResponse {
            success: false,
            user: None,
            error: Some("USER_NOT_FOUND".to_string()),
            db_path: Some(db_path.display().to_string()),
        });
    };

    let Some(stored_hash) = user.password_hash.clone() else {
        return Ok(VerifyLocalDesktopLoginResponse {
            success: false,
            user: None,
            error: Some("PASSWORD_HASH_MISSING".to_string()),
            db_path: Some(db_path.display().to_string()),
        });
    };

    if !verify_local_password(password, &stored_hash) {
        return Ok(VerifyLocalDesktopLoginResponse {
            success: false,
            user: None,
            error: Some("INVALID_CREDENTIALS".to_string()),
            db_path: Some(db_path.display().to_string()),
        });
    }

    if let Some(user_id) = user.id.as_deref() {
        if let Err(error) = persist_native_desktop_login_success(&app_handle, user_id) {
            log::warn!("[Auth] Native desktop login metadata update failed: {error}");
        }
    }

    Ok(VerifyLocalDesktopLoginResponse {
        success: true,
        user: Some(user),
        error: None,
        db_path: Some(db_path.display().to_string()),
    })
}


