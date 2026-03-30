use tauri::Runtime;

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct DesktopRuntimeBootstrapConfig {
    pub strategy: String,
    pub loopback_host: String,
    pub preferred_port: u16,
    pub health_path: String,
    pub warmup_path: String,
    pub expected_runtime: String,
    pub release_ready: bool,
}

#[derive(Clone, serde::Deserialize, serde::Serialize)]
pub struct DesktopRuntimeBootstrapHealth {
    pub ok: bool,
    pub status_code: Option<u16>,
    pub url: String,
    pub message: String,
}

fn preferred_port() -> u16 {
    3100
}

fn build_base_url(config: &DesktopRuntimeBootstrapConfig) -> String {
    format!("http://{}:{}", config.loopback_host, config.preferred_port)
}

#[tauri::command]
pub async fn get_runtime_bootstrap_config<R: Runtime>(
    _app_handle: tauri::AppHandle<R>,
) -> Result<DesktopRuntimeBootstrapConfig, String> {
    Ok(DesktopRuntimeBootstrapConfig {
        strategy: "embedded-local-web-server".to_string(),
        loopback_host: "127.0.0.1".to_string(),
        preferred_port: preferred_port(),
        health_path: "/api/runtime/health".to_string(),
        warmup_path: "/api/runtime/warmup".to_string(),
        expected_runtime: "next-app-server".to_string(),
        release_ready: false,
    })
}

#[tauri::command]
pub async fn probe_runtime_bootstrap_health<R: Runtime>(
    app_handle: tauri::AppHandle<R>,
) -> Result<DesktopRuntimeBootstrapHealth, String> {
    let config = get_runtime_bootstrap_config(app_handle).await?;
    let url = format!("{}{}", build_base_url(&config), config.health_path);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|error| format!("Gagal membuat HTTP client bootstrap: {error}"))?;

    let response = match client.get(&url).send().await {
        Ok(response) => response,
        Err(error) => {
            return Ok(DesktopRuntimeBootstrapHealth {
                ok: false,
                status_code: None,
                url,
                message: format!("Loopback runtime belum reachable: {error}"),
            });
        }
    };

    let status_code = response.status().as_u16();
    if !response.status().is_success() {
        return Ok(DesktopRuntimeBootstrapHealth {
            ok: false,
            status_code: Some(status_code),
            url,
            message: format!("Loopback runtime merespons status {status_code}."),
        });
    }

    let payload = response.text().await.unwrap_or_default();
    let looks_healthy = payload.contains("\"ok\":true") || payload.contains("\"ready\":true");

    Ok(DesktopRuntimeBootstrapHealth {
        ok: looks_healthy,
        status_code: Some(status_code),
        url,
        message: if looks_healthy {
            "Loopback runtime sehat.".to_string()
        } else {
            "Loopback runtime merespons, tetapi payload health belum sesuai.".to_string()
        },
    })
}
