use std::{
    path::{Path, PathBuf},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, OnceLock,
    },
};

use chrono::Local;
use serde::{Deserialize, Serialize};
use tauri::Manager;

const JOURNAL_NAME: &str = "journal_erreurs_aldus.txt";
const INTERNAL_TARGET: &str = "aldus_mirror_internal";
const HEADER: &str = "Journal de bord Aldus\n\
Ce journal explique les alertes et propose des pistes de résolution.\n\
Sa création ne signale pas de panne : en l'absence d'entrée d'alerte, aucune erreur n'est consignée ici.\n\
En mode Diagnostic, les opérations courantes sont aussi enregistrées.\n\
Les traces techniques complètes restent dans Aldus.log.\n\n";

#[derive(Clone, Debug, Default, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LogConfig {
    pub directory: Option<String>,
    pub diagnostic: bool,
}

pub struct DiagnosticEntry {
    pub diagnostic: &'static str,
    pub explanation: &'static str,
    pub action: &'static str,
}

pub fn enrich_log_entry(raw_msg: &str) -> Option<DiagnosticEntry> {
    let message = raw_msg.to_lowercase();
    if message.contains("filenotfounderror") || message.contains("errno 2") {
        Some(DiagnosticEntry {
            diagnostic: "Fichier requis introuvable.",
            explanation: "Si la trace cite _MEI, jamo, gruut ou PyInstaller, une ressource Python (vocabulaire ou métadonnées) peut manquer dans l'exécutable. Sinon, le fichier a pu être déplacé ou supprimé.",
            action: "Vérifier le chemin indiqué. Pour un sidecar gelé, reconstruire avec --collect-all et, si nécessaire, --copy-metadata pour le module concerné.",
        })
    } else if (message.contains("timeout")
        || message.contains("timed out")
        || message.contains("délai"))
        && ["xtts", "sidecar", "audio", "127.0.0.1", "localhost"]
            .iter()
            .any(|word| message.contains(word))
    {
        Some(DiagnosticEntry {
            diagnostic: "Le sous-programme audio ne répond pas dans le délai prévu.",
            explanation: "Le moteur Python est peut-être encore en cours de chargement, ou il s'est arrêté au démarrage.",
            action: "Consulter la trace brute et vérifier les alertes antivirus concernant AppData\\Local\\Temp\\_MEI... ; ne pas désactiver la protection sans vérifier le fichier.",
        })
    } else if [
        "permissiondenied",
        "permission denied",
        "eacces",
        "access is denied",
        "accès refusé",
        "os error 5",
        "os error 32",
    ]
    .iter()
    .any(|word| message.contains(word))
    {
        Some(DiagnosticEntry {
            diagnostic: "Accès au fichier refusé ou fichier verrouillé.",
            explanation: "Un autre logiciel peut utiliser le document, ou le dossier peut être protégé en écriture.",
            action: "Fermer Word ou le lecteur PDF qui utilise le document, puis vérifier les droits d'écriture du dossier.",
        })
    } else if message.contains("github")
        && ["403", "429", "rate limit", "rate_limit"]
            .iter()
            .any(|word| message.contains(word))
    {
        Some(DiagnosticEntry {
            diagnostic: "Vérification GitHub temporairement indisponible.",
            explanation: "GitHub peut limiter les requêtes publiques (souvent 60 par heure sans authentification). Un code 403 peut aussi indiquer une restriction d'accès, pas uniquement un quota.",
            action: "Patienter avant de relancer la vérification et vérifier la connexion Internet. Le travail local reste possible.",
        })
    } else {
        None
    }
}

struct Entry {
    timestamp: String,
    level: log::Level,
    module: String,
    message: String,
}

impl Entry {
    fn render(&self) -> String {
        let mut text = format!(
            "[{}] {} — Module : {}\n",
            self.timestamp, self.level, self.module
        );
        if let Some(diagnostic) = enrich_log_entry(&self.message) {
            text.push_str(&format!(
                "Diagnostic : {}\nExplication : {}\nAction conseillée : {}\n",
                diagnostic.diagnostic, diagnostic.explanation, diagnostic.action,
            ));
        } else {
            text.push_str("Message du module ci-dessus : consulter le détail technique pour identifier l'opération concernée.\n");
        }
        text.push_str(&format!("Trace technique : {}\n\n", self.message));
        text
    }
}

type Reply<T> = mpsc::Sender<Result<T, String>>;
enum Event {
    Entry(Entry),
    Get(Reply<Option<LogConfig>>),
    Configure(Option<String>, Option<bool>, Reply<LogConfig>),
    Open(Reply<String>),
    Flush(mpsc::Sender<()>),
}

static MIRROR: OnceLock<mpsc::SyncSender<Event>> = OnceLock::new();
static QUEUE_ERROR_REPORTED: AtomicBool = AtomicBool::new(false);

fn report(error: &str) {
    // Excluded from the mirror to avoid recursive logging on unavailable disks.
    log::error!(target: INTERNAL_TARGET, "Journal miroir : {error}");
}

pub fn mirror_record(record: &log::Record<'_>) {
    if record.target() == INTERNAL_TARGET || record.level() > log::Level::Info {
        return;
    }
    if let Some(sender) = MIRROR.get() {
        let entry = Entry {
            timestamp: Local::now().to_rfc3339(),
            level: record.level(),
            module: record.target().to_string(),
            message: record.args().to_string(),
        };
        match sender.try_send(Event::Entry(entry)) {
            Ok(()) => {
                QUEUE_ERROR_REPORTED.store(false, Ordering::Relaxed);
            }
            Err(error) => {
                if !QUEUE_ERROR_REPORTED.swap(true, Ordering::Relaxed) {
                    report(&format!(
                        "Entree non dupliquee (file pleine ou arretee) : {error}"
                    ));
                }
            }
        }
    }
}

fn load_config(path: &Path) -> Result<Option<LogConfig>, String> {
    let root = crate::updater::read_config(path)?;
    let Some(system) = root.get("system") else {
        return Ok(None);
    };
    if system.get("custom_log_dir").is_none() && system.get("log_diagnostic").is_none() {
        return Ok(None);
    }
    Ok(Some(LogConfig {
        directory: system
            .get("custom_log_dir")
            .map(|value| serde_json::from_value(value.clone()))
            .transpose()
            .map_err(|error| format!("Dossier du journal invalide : {error}"))?
            .flatten(),
        diagnostic: system
            .get("log_diagnostic")
            .map(|value| serde_json::from_value(value.clone()))
            .transpose()
            .map_err(|error| format!("Niveau du journal invalide : {error}"))?
            .unwrap_or(false),
    }))
}

fn store_config(path: &Path, config: &LogConfig) -> Result<(), String> {
    if config
        .directory
        .as_ref()
        .is_some_and(|directory| directory.trim().is_empty() || !Path::new(directory).is_absolute())
    {
        return Err("Le dossier du journal doit être un chemin absolu non vide.".into());
    }
    let _guard = crate::updater::CONFIG_LOCK
        .lock()
        .map_err(|error| format!("Verrou de configuration : {error}"))?;
    let mut root = crate::updater::read_config(path)?;
    let system = root
        .as_object_mut()
        .ok_or("La configuration doit être un objet JSON.")?
        .entry("system")
        .or_insert_with(|| serde_json::json!({}))
        .as_object_mut()
        .ok_or("La configuration système doit être un objet JSON.")?;
    system.insert("custom_log_dir".into(), serde_json::json!(config.directory));
    system.insert(
        "log_diagnostic".into(),
        serde_json::json!(config.diagnostic),
    );
    crate::updater::write_config(path, &root)
}

fn journal_path(config: &LogConfig, default_directory: &Path) -> PathBuf {
    config
        .directory
        .as_deref()
        .map(Path::new)
        .unwrap_or(default_directory)
        .join(JOURNAL_NAME)
}

fn append_atomically(path: &Path, text: &str) -> Result<(), String> {
    let parent = path.parent().ok_or("Dossier du journal introuvable.")?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("Création du dossier du journal : {error}"))?;
    let mut contents = match std::fs::read(path) {
        Ok(_) if text.is_empty() => return Ok(()),
        Ok(contents) => contents,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => HEADER.as_bytes().to_vec(),
        Err(error) => return Err(format!("Lecture du journal : {error}")),
    };
    contents.extend_from_slice(text.as_bytes());
    let temporary = path.with_extension("txt.tmp");
    std::fs::write(&temporary, contents)
        .map_err(|error| format!("Écriture du journal temporaire : {error}"))?;
    std::fs::rename(&temporary, path)
        .map_err(|error| format!("Remplacement atomique du journal : {error}"))
}

fn open_journal(path: &Path) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    let status = {
        use std::os::windows::process::CommandExt;
        // Pass the path as an argument, not a cmd.exe program (no shell interpolation).
        std::process::Command::new("rundll32.exe")
            .arg("url.dll,FileProtocolHandler")
            .arg(path)
            .creation_flags(0x08000000)
            .status()
    };
    #[cfg(target_os = "macos")]
    let status = std::process::Command::new("open").arg(path).status();
    #[cfg(target_os = "linux")]
    let status = std::process::Command::new("xdg-open").arg(path).status();
    match status {
        Ok(status) if status.success() => Ok(()),
        Ok(status) => Err(format!("L'ouverture du journal a échoué : {status}")),
        Err(error) => Err(format!("Ouverture du journal impossible : {error}")),
    }
}

pub fn start(app: &tauri::AppHandle) -> Result<(), String> {
    let config_path = crate::updater::config_path(app)?;
    let default_directory = app
        .path()
        .app_log_dir()
        .map_err(|error| error.to_string())?;
    let (sender, receiver) = mpsc::sync_channel(2048);
    MIRROR
        .set(sender)
        .map_err(|_| "Le journal miroir est deja initialise.")?;
    std::thread::Builder::new()
        .name("aldus-log-mirror".into())
        .spawn(move || run_worker(config_path, default_directory, receiver))
        .map(|_| ())
        .map_err(|error| format!("Démarrage du journal miroir : {error}"))
}

fn run_worker(config_path: PathBuf, default_directory: PathBuf, receiver: mpsc::Receiver<Event>) {
    let mut config = load_config(&config_path);
    let mut disk_error_reported = false;
    let mut pending = None;
    if let Err(error) = &config {
        report(error);
    }
    loop {
        let event = match pending.take().map(Ok).unwrap_or_else(|| receiver.recv()) {
            Ok(event) => event,
            Err(_) => break,
        };
        match event {
            Event::Entry(entry) => {
                if config
                    .as_ref()
                    .is_ok_and(|config| !config.as_ref().is_some_and(|config| config.diagnostic))
                    && entry.level == log::Level::Info
                {
                    continue;
                }
                let result: Result<(), String> = (|| {
                    let settings = config
                        .as_ref()
                        .map_err(Clone::clone)?
                        .clone()
                        .unwrap_or_default();
                    let mut text = entry.render();
                    // Batch bursts without moving entries across a configuration change.
                    for _ in 0..127 {
                        match receiver.try_recv() {
                            Ok(Event::Entry(entry)) => {
                                if entry.level != log::Level::Info || settings.diagnostic {
                                    text.push_str(&entry.render());
                                }
                            }
                            Ok(event) => {
                                pending = Some(event);
                                break;
                            }
                            Err(_) => break,
                        }
                    }
                    append_atomically(&journal_path(&settings, &default_directory), &text)
                })();
                match result {
                    Ok(()) => disk_error_reported = false,
                    Err(error) if !disk_error_reported => {
                        report(&error);
                        disk_error_reported = true;
                    }
                    Err(_) => {} // Already reported to Aldus.log; retry on the next entry.
                }
            }
            Event::Get(reply) => {
                if reply.send(config.clone()).is_err() {
                    report("Reponse de configuration abandonnee.");
                }
            }
            Event::Configure(directory, diagnostic, reply) => {
                let result: Result<LogConfig, String> = (|| {
                    let mut settings = config
                        .as_ref()
                        .map_err(Clone::clone)?
                        .clone()
                        .unwrap_or_default();
                    if let Some(directory) = directory {
                        settings.directory = Some(directory);
                    }
                    if let Some(diagnostic) = diagnostic {
                        settings.diagnostic = diagnostic;
                    }
                    store_config(&config_path, &settings)?;
                    config = Ok(Some(settings.clone()));
                    disk_error_reported = false;
                    if let Err(error) =
                        append_atomically(&journal_path(&settings, &default_directory), "")
                    {
                        report(&error);
                        disk_error_reported = true;
                    }
                    Ok(settings)
                })();
                if let Err(error) = &result {
                    report(error);
                }
                if reply.send(result).is_err() {
                    report("Reponse de configuration abandonnee.");
                }
            }
            Event::Open(reply) => {
                let result: Result<String, String> = (|| {
                    let settings = config
                        .as_ref()
                        .map_err(Clone::clone)?
                        .clone()
                        .unwrap_or_default();
                    let path = journal_path(&settings, &default_directory);
                    append_atomically(&path, "")?;
                    open_journal(&path)?;
                    Ok(path.to_string_lossy().into_owned())
                })();
                if let Err(error) = &result {
                    report(error);
                }
                if reply.send(result).is_err() {
                    report("Reponse d'ouverture abandonnee.");
                }
            }
            Event::Flush(reply) => {
                if reply.send(()).is_err() {
                    report("Attente de vidage abandonnee.");
                }
            }
        }
    }
}

async fn request<T: Send + 'static>(
    event: impl FnOnce(Reply<T>) -> Event + Send + 'static,
) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (sender, receiver) = mpsc::channel();
        MIRROR
            .get()
            .ok_or("Journal miroir indisponible.")?
            .send(event(sender))
            .map_err(|error| error.to_string())?;
        receiver.recv().map_err(|error| error.to_string())?
    })
    .await
    .map_err(|error| error.to_string())?
}

#[tauri::command]
pub async fn get_log_config() -> Result<Option<LogConfig>, String> {
    request(Event::Get).await
}

#[tauri::command]
pub async fn set_log_config(
    directory: Option<String>,
    diagnostic: Option<bool>,
) -> Result<LogConfig, String> {
    request(move |reply| Event::Configure(directory, diagnostic, reply)).await
}

#[tauri::command]
pub async fn open_log_file() -> Result<String, String> {
    request(Event::Open).await
}

#[tauri::command]
pub fn log_frontend(level: String, message: String) -> Result<(), String> {
    match level.as_str() {
        "error" => log::error!(target: "frontend", "{message}"),
        "warning" => log::warn!(target: "frontend", "{message}"),
        "info" | "success" => log::info!(target: "frontend", "{message}"),
        _ => {
            log::error!("Niveau de journal frontend invalide : {level}");
            return Err("Niveau de journal invalide.".into());
        }
    }
    Ok(())
}

pub fn flush() {
    if let Some(sender) = MIRROR.get() {
        let (reply, receiver) = mpsc::channel();
        if sender.try_send(Event::Flush(reply)).is_err()
            || receiver
                .recv_timeout(std::time::Duration::from_secs(2))
                .is_err()
        {
            report("Le journal n'a pas pu être entièrement vidé avant la fermeture.");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(level: log::Level, message: &str) -> Entry {
        Entry {
            timestamp: "2026-10-19T12:00:00+02:00".into(),
            level,
            module: "audio::xtts".into(),
            message: message.into(),
        }
    }

    #[test]
    fn explains_known_errors_without_losing_the_raw_trace() {
        for (raw, expected) in [
            (
                "FileNotFoundError: [Errno 2] _MEI\\jamo\\data\\U+11xx.json",
                "Fichier requis",
            ),
            (
                "XTTS sidecar timeout on 127.0.0.1:8020",
                "sous-programme audio",
            ),
            ("PermissionDenied / EACCES", "fichier verrouillé"),
            ("GitHub HTTP 403 rate limit", "GitHub temporairement"),
        ] {
            let text = entry(log::Level::Error, raw).render();
            assert!(text.contains(expected), "{text}");
            assert!(text.contains("Explication :"));
            assert!(text.contains("Action conseillée :"));
            assert!(text.contains(raw));
            assert!(text.contains("Module : audio::xtts"));
        }
        assert!(enrich_log_entry("HTTP 403 on an unrelated service").is_none());
        assert!(enrich_log_entry("export timeout").is_none());
        let fallback = entry(log::Level::Warn, "Erreur inconnue").render();
        assert!(fallback.contains("Message du module"));
        assert!(fallback.contains("Erreur inconnue"));
    }

    #[test]
    fn worker_filters_levels_persists_settings_and_recovers_from_disk_errors() -> Result<(), String>
    {
        let root = std::env::temp_dir().join(format!(
            "aldus-mirror-test-{}-{}",
            std::process::id(),
            Local::now()
                .timestamp_nanos_opt()
                .ok_or("Horloge indisponible")?
        ));
        std::fs::create_dir_all(&root).map_err(|error| error.to_string())?;
        let result = (|| -> Result<(), String> {
            let path = root.join("config.json");
            crate::updater::write_config(
                &path,
                &serde_json::json!({
                    "audio": { "cpml_accepted": true },
                    "system": { "last_update_check": "2026-10-19", "unknown_setting": 42 }
                }),
            )?;
            let (sender, receiver) = mpsc::sync_channel(2048);
            let worker_path = path.clone();
            let default_directory = root.join("default");
            let worker_directory = default_directory.clone();
            let worker =
                std::thread::spawn(move || run_worker(worker_path, worker_directory, receiver));
            let send = |event| sender.send(event).map_err(|error| error.to_string());
            let barrier = || -> Result<(), String> {
                let (reply, receiver) = mpsc::channel();
                send(Event::Flush(reply))?;
                receiver
                    .recv_timeout(std::time::Duration::from_secs(5))
                    .map_err(|error| error.to_string())
            };
            send(Event::Entry(entry(log::Level::Info, "Info masquee")))?;
            barrier()?;
            assert!(!default_directory.join(JOURNAL_NAME).exists());
            send(Event::Entry(entry(log::Level::Warn, "Alerte visible")))?;
            barrier()?;
            let default_text = std::fs::read_to_string(default_directory.join(JOURNAL_NAME))
                .map_err(|error| error.to_string())?;
            assert!(default_text.starts_with(HEADER));
            assert!(default_text.contains("Alerte visible"));
            assert!(!default_text.contains("Info masquee"));

            // A file where a directory is expected simulates a disconnected/unwritable destination.
            let unavailable = root.join("unavailable");
            append_atomically(&unavailable, "test")?;
            let (reply, receiver) = mpsc::channel();
            send(Event::Configure(
                Some(unavailable.to_string_lossy().into_owned()),
                Some(true),
                reply,
            ))?;
            let settings = receiver.recv().map_err(|error| error.to_string())??;
            assert!(settings.diagnostic);
            send(Event::Entry(entry(
                log::Level::Error,
                "Erreur sur disque indisponible",
            )))?;
            barrier()?;
            let custom = root.join("custom");
            let (reply, receiver) = mpsc::channel();
            send(Event::Configure(
                Some(custom.to_string_lossy().into_owned()),
                None,
                reply,
            ))?;
            receiver.recv().map_err(|error| error.to_string())??;
            send(Event::Entry(entry(log::Level::Info, "Diagnostic visible")))?;
            send(Event::Entry(entry(log::Level::Error, "EACCES")))?;
            barrier()?;
            let text = std::fs::read_to_string(custom.join(JOURNAL_NAME))
                .map_err(|error| error.to_string())?;
            assert!(text.contains("Diagnostic visible"));
            assert!(text.contains("Action conseillée"));
            assert_eq!(text.matches("Journal de bord Aldus").count(), 1);
            assert!(!custom.join("journal_erreurs_aldus.txt.tmp").exists());
            for index in 0..500 {
                send(Event::Entry(entry(
                    log::Level::Warn,
                    &format!("Alerte de rafale {index}"),
                )))?;
            }
            barrier()?;
            let text = std::fs::read_to_string(custom.join(JOURNAL_NAME))
                .map_err(|error| error.to_string())?;
            assert_eq!(
                text.matches("Trace technique : Alerte de rafale").count(),
                500
            );
            let settings = load_config(&path)?.ok_or("Configuration non persistée")?;
            assert_eq!(
                settings.directory,
                Some(custom.to_string_lossy().into_owned())
            );
            assert!(settings.diagnostic);
            let config = crate::updater::read_config(&path)?;
            assert_eq!(config["audio"]["cpml_accepted"], true);
            assert_eq!(config["system"]["last_update_check"], "2026-10-19");
            assert_eq!(config["system"]["unknown_setting"], 42);
            crate::updater::write_config(
                &path,
                &serde_json::json!({ "system": { "custom_log_dir": 123 } }),
            )?;
            assert!(load_config(&path).is_err());
            drop(sender);
            worker
                .join()
                .map_err(|_| "Le thread du journal a échoué.")?;
            Ok(())
        })();
        std::fs::remove_dir_all(&root).map_err(|error| error.to_string())?;
        result
    }

    #[test]
    fn rejects_relative_directories_and_invalid_levels() -> Result<(), String> {
        let invalid = LogConfig {
            directory: Some("relative-folder".into()),
            diagnostic: false,
        };
        assert!(store_config(Path::new("unused.json"), &invalid).is_err());
        assert!(log_frontend("invalid".into(), "test".into()).is_err());
        Ok(())
    }
}
