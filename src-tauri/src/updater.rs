use std::{path::Path, process::Command, time::Duration};

use chrono::{DateTime, Duration as ChronoDuration, SecondsFormat, Utc};
use reqwest::Url;
use semver::Version;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};

const RELEASE_URL: &str = "https://api.github.com/repos/danoe78210/aldus/releases/latest";
const USER_AGENT: &str = "Aldus-App";

#[derive(Default)]
pub struct UpdateChecker {
    request_lock: tokio::sync::Mutex<()>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateStatus {
    pub available: bool,
    pub latest_version: String,
    pub release_url: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(default)]
struct SystemConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    last_update_check: Option<String>,
    latest_known_version: String,
    update_url: String,
    release_notes: String,
    available: bool,
}

#[derive(Deserialize)]
struct GitHubRelease {
    tag_name: String,
    html_url: String,
    body: Option<String>,
}

pub(crate) static CONFIG_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

pub(crate) fn config_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Dossier Aldus local introuvable : {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Création du dossier Aldus local impossible : {error}"))?;
    Ok(directory.join("config.json"))
}

pub(crate) fn read_config(path: &Path) -> Result<Value, String> {
    let contents = match std::fs::read_to_string(path) {
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Ok(serde_json::json!({}))
        }
        Err(error) => return Err(format!("Lecture de config.json impossible : {error}")),
    };
    serde_json::from_str(&contents).map_err(|error| format!("config.json invalide : {error}"))
}

fn load_system_config(root: &Value) -> Result<SystemConfig, String> {
    root.get("system")
        .cloned()
        .map(serde_json::from_value)
        .transpose()
        .map(|config| config.unwrap_or_default())
        .map_err(|error| format!("Configuration système invalide : {error}"))
}

pub(crate) fn write_config(path: &Path, root: &Value) -> Result<(), String> {
    let contents = serde_json::to_vec_pretty(root)
        .map_err(|error| format!("Sérialisation de config.json impossible : {error}"))?;
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, contents)
        .map_err(|error| format!("Écriture temporaire de config.json impossible : {error}"))?;
    if let Err(error) = std::fs::rename(&temporary, path) {
        if let Err(cleanup_error) = std::fs::remove_file(&temporary) {
            log::warn!("Update config temp cleanup failed: {cleanup_error}");
        }
        return Err(format!(
            "Enregistrement atomique de config.json impossible : {error}"
        ));
    }
    Ok(())
}

fn store_system_config(root: &mut Value, system: &SystemConfig) -> Result<(), String> {
    let object = root
        .as_object_mut()
        .ok_or("La racine de config.json doit être un objet JSON.")?;
    let system_object = object
        .entry("system")
        .or_insert_with(|| serde_json::json!({}))
        .as_object_mut()
        .ok_or("La configuration système doit être un objet JSON.")?;
    system_object.extend(
        serde_json::to_value(system)
            .map_err(|error| {
                format!("Sérialisation de la configuration système impossible : {error}")
            })?
            .as_object()
            .ok_or("Configuration système invalide.")?
            .clone(),
    );
    Ok(())
}

fn save_system_config(path: &Path, system: &SystemConfig) -> Result<(), String> {
    let _guard = CONFIG_LOCK
        .lock()
        .map_err(|error| format!("Verrou de configuration : {error}"))?;
    let mut root = read_config(path)?;
    store_system_config(&mut root, system)?;
    write_config(path, &root)
}

fn checked_within_last_day(system: &SystemConfig, now: DateTime<Utc>) -> bool {
    system
        .last_update_check
        .as_deref()
        .and_then(|last| DateTime::parse_from_rfc3339(last).ok())
        .map(|last| now.signed_duration_since(last.with_timezone(&Utc)))
        .is_some_and(|age| age >= ChronoDuration::zero() && age < ChronoDuration::hours(24))
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let latest = latest.strip_prefix('v').unwrap_or(latest);
    match (Version::parse(latest), Version::parse(current)) {
        (Ok(latest), Ok(current)) => latest > current,
        _ => false,
    }
}

fn status_from_cache(system: &SystemConfig, current_version: &str) -> UpdateStatus {
    UpdateStatus {
        available: system.available
            && is_newer_version(&system.latest_known_version, current_version),
        latest_version: if system.latest_known_version.is_empty() {
            current_version.to_string()
        } else {
            system.latest_known_version.clone()
        },
        release_url: (!system.update_url.is_empty()).then(|| system.update_url.clone()),
        notes: (!system.release_notes.is_empty()).then(|| system.release_notes.clone()),
    }
}

async fn fetch_latest_release() -> Result<GitHubRelease, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(3))
        .timeout(Duration::from_secs(8))
        .build()
        .map_err(|error| error.to_string())?;
    client
        .get(RELEASE_URL)
        .header(reqwest::header::USER_AGENT, USER_AGENT)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<GitHubRelease>()
        .await
        .map_err(|error| error.to_string())
}

pub async fn check_update_status(app: &AppHandle, force: bool) -> Result<UpdateStatus, String> {
    let checker = app.state::<UpdateChecker>();
    let _request = checker.request_lock.lock().await;
    let path = config_path(app)?;
    let root = read_config(&path)?;
    let mut system = load_system_config(&root)?;
    let current_version = app.package_info().version.to_string();
    let now = Utc::now();

    if !force && checked_within_last_day(&system, now) {
        return Ok(status_from_cache(&system, &current_version));
    }

    system.last_update_check = Some(now.to_rfc3339_opts(SecondsFormat::Secs, true));
    let release = match fetch_latest_release().await {
        Ok(release) => release,
        Err(error) => {
            log::warn!("GitHub release check unavailable: {error}");
            system.available = false;
            save_system_config(&path, &system)?;
            return Ok(status_from_cache(&system, &current_version));
        }
    };

    system.available = is_newer_version(&release.tag_name, &current_version);
    system.latest_known_version = release.tag_name;
    system.update_url = release.html_url;
    system.release_notes = release.body.unwrap_or_default();
    save_system_config(&path, &system)?;
    Ok(status_from_cache(&system, &current_version))
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle, force: bool) -> Result<UpdateStatus, String> {
    check_update_status(&app, force).await
}

fn validate_release_url(url: &str) -> Result<Url, String> {
    let parsed = Url::parse(&url).map_err(|error| format!("URL de release invalide : {error}"))?;
    if parsed.scheme() != "https"
        || parsed.host_str() != Some("github.com")
        || !parsed.username().is_empty()
        || parsed.password().is_some()
        || parsed.port().is_some()
        || parsed.query().is_some()
        || parsed.fragment().is_some()
        || !parsed.path().starts_with("/danoe78210/aldus/releases/")
    {
        return Err("Seules les pages de release Aldus sur GitHub peuvent être ouvertes.".into());
    }
    Ok(parsed)
}

#[tauri::command]
pub fn open_external(url: String) -> Result<(), String> {
    let parsed = validate_release_url(&url)?;
    let url = parsed.as_str();
    #[cfg(target_os = "windows")]
    let result = {
        use std::os::windows::process::CommandExt;
        Command::new("cmd.exe")
            .args(["/C", "start", ""])
            .arg(url)
            .creation_flags(0x08000000)
            .spawn()
    };
    #[cfg(target_os = "macos")]
    let result = Command::new("open").arg(url).spawn();
    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open").arg(url).spawn();
    result.map(|_| ()).map_err(|error| {
        let message = format!("Ouverture du navigateur impossible : {error}");
        log::error!("External release URL open failed: {message}");
        message
    })?;
    log::info!("Opened Aldus release URL: {url}");
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{
        checked_within_last_day, is_newer_version, load_system_config, status_from_cache,
        store_system_config, validate_release_url, SystemConfig,
    };
    use chrono::{Duration, Utc};

    #[test]
    fn compares_semver_release_tags_to_current_version() {
        assert!(is_newer_version("v1.4.5", "1.4.4"));
        assert!(!is_newer_version("v1.4.4", "1.4.4"));
        assert!(!is_newer_version("latest", "1.4.4"));
    }

    #[test]
    fn only_accepts_https_urls_for_aldus_releases() {
        assert!(
            validate_release_url("https://github.com/danoe78210/aldus/releases/tag/v1.4.4").is_ok()
        );
        assert!(
            validate_release_url("https://github.com/danoe78210/aldus/releases/latest").is_ok()
        );
        assert!(
            validate_release_url("http://github.com/danoe78210/aldus/releases/latest").is_err()
        );
        assert!(validate_release_url("https://example.com/releases/latest").is_err());
        assert!(validate_release_url(
            "https://github.com.evil.test/danoe78210/aldus/releases/latest"
        )
        .is_err());
        assert!(validate_release_url(
            "https://github.com/danoe78210/aldus/releases/latest?next=other"
        )
        .is_err());
    }

    #[test]
    fn caches_checks_for_less_than_twenty_four_hours() {
        let now = Utc::now();
        let system = SystemConfig {
            last_update_check: Some((now - Duration::hours(23)).to_rfc3339()),
            ..SystemConfig::default()
        };
        assert!(checked_within_last_day(&system, now));

        let expired = SystemConfig {
            last_update_check: Some((now - Duration::hours(24)).to_rfc3339()),
            ..SystemConfig::default()
        };
        assert!(!checked_within_last_day(&expired, now));
    }

    #[test]
    fn system_cache_round_trips_without_replacing_audio_config() -> Result<(), String> {
        let mut root = serde_json::json!({
            "audio": { "cpml_accepted": true, "engine_mode": "integrated" },
            "system": { "custom_log_dir": "E:\\Erreurs", "log_diagnostic": true }
        });
        let system = SystemConfig {
            last_update_check: Some("2026-10-18T08:30:00Z".into()),
            latest_known_version: "1.4.5".into(),
            update_url: "https://github.com/danoe78210/aldus/releases/tag/v1.4.5".into(),
            release_notes: "Notes".into(),
            available: true,
        };
        store_system_config(&mut root, &system)?;
        let loaded = load_system_config(&root)?;
        let status = status_from_cache(&loaded, "1.4.4");

        assert_eq!(root["audio"]["cpml_accepted"], true);
        assert_eq!(root["system"]["latest_known_version"], "1.4.5");
        assert_eq!(root["system"]["custom_log_dir"], "E:\\Erreurs");
        assert_eq!(root["system"]["log_diagnostic"], true);
        assert!(status.available);
        assert_eq!(status.notes.as_deref(), Some("Notes"));
        assert!(!status_from_cache(&loaded, "1.4.5").available);
        Ok(())
    }
}
