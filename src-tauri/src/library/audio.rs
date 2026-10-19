use super::metadata;
use super::{read_config, write_config, AudioChapter, AudioEdition, Book};
use chrono::{SecondsFormat, Utc};
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;
use zip::ZipArchive;

const DEFAULT_TTS_ENDPOINT: &str = "http://127.0.0.1:8020";
const MAX_TTS_SEGMENT_CHARS: usize = 240;
pub(super) const AUDIO_INIT_TIMEOUT: Duration = Duration::from_secs(900);
const SIDECAR_STARTUP_TIMEOUT: Duration = Duration::from_secs(60);
const CHAPTER_AUDIO_TIMEOUT: Duration = Duration::from_secs(900);

fn chapter_time_remaining(started: Instant) -> Result<Duration, String> {
    CHAPTER_AUDIO_TIMEOUT.checked_sub(started.elapsed())
        .filter(|remaining| !remaining.is_zero())
        .ok_or_else(|| "Délai audio de 900 s dépassé pour le chapitre.".into())
}

#[cfg(test)]
mod chapter_deadline_tests {
    use super::*;

    #[test]
    fn chapter_budget_does_not_restart_for_each_segment() {
        let started = Instant::now() - Duration::from_secs(899);
        assert!(chapter_time_remaining(started).expect("temps restant") <= Duration::from_secs(1));
        assert!(chapter_time_remaining(Instant::now() - CHAPTER_AUDIO_TIMEOUT).is_err());
    }
}
#[derive(Clone, Copy, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum AudioEngineMode {
    #[default]
    Integrated,
    External,
}

impl AudioEngineMode {
    fn for_current_build() -> Self {
        if cfg!(all(windows, not(debug_assertions))) {
            Self::Integrated
        } else {
            Self::External
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(default)]
pub struct AudioConfig {
    pub cpml_accepted: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpml_accepted_at: Option<String>,
    pub engine_mode: AudioEngineMode,
}

impl Default for AudioConfig {
    fn default() -> Self {
        Self {
            cpml_accepted: false,
            cpml_accepted_at: None,
            engine_mode: AudioEngineMode::for_current_build(),
        }
    }
}

#[derive(Default)]
pub struct AudioEngine {
    startup_lock: tokio::sync::Mutex<()>,
    child: Mutex<Option<CommandChild>>,
    ffmpeg_path: Mutex<Option<PathBuf>>,
    running: AtomicBool,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioInitProgress {
    pub percent: u32,
    pub stage: String,
    pub is_ready: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct EngineInitStatus {
    #[serde(default)]
    status: String,
    percent: u32,
    stage: String,
    #[serde(rename = "model_loaded")]
    model_loaded: bool,
    error: Option<String>,
}

pub fn emit_audio_init_progress(app: &tauri::AppHandle, percent: u32, stage: &str) {
    if let Err(error) = app.emit(
        "audio:init-progress",
        AudioInitProgress {
            percent,
            stage: stage.to_string(),
            is_ready: percent == 100,
            error: None,
        },
    ) {
        log::warn!("Unable to emit audio init progress: {error}");
    }
}

pub fn emit_audio_init_failure(app: &tauri::AppHandle, error: &str) {
    if let Err(emit_error) = app.emit(
        "audio:init-progress",
        AudioInitProgress {
            percent: 0,
            stage: "Impossible d'initialiser les voix — Vérifiez Aldus.log".into(),
            is_ready: false,
            error: Some(error.to_string()),
        },
    ) {
        log::warn!("Unable to emit audio init failure event: {emit_error}");
    }
}

fn audio_config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let directory = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Dossier Aldus local introuvable : {error}"))?;
    std::fs::create_dir_all(&directory)
        .map_err(|error| format!("Création du dossier Aldus local impossible : {error}"))?;
    Ok(directory.join("config.json"))
}

pub fn get_audio_consent(app: &tauri::AppHandle) -> Result<AudioConfig, String> {
    let path = audio_config_path(app)?;
    let root: serde_json::Value = if path.is_file() {
        let raw = std::fs::read_to_string(&path)
            .map_err(|error| format!("Lecture de la configuration audio impossible : {error}"))?;
        serde_json::from_str(&raw)
            .map_err(|error| format!("Configuration locale Aldus invalide : {error}"))?
    } else {
        serde_json::json!({})
    };
    if let Some(audio) = root.get("audio") {
        return serde_json::from_value(audio.clone())
            .map_err(|error| format!("Configuration audio invalide : {error}"));
    }

    let mut config = AudioConfig::default();
    let legacy_path = path
        .parent()
        .ok_or("Dossier Aldus local invalide.")?
        .join("consent")
        .join("xtts-v2.json");
    if legacy_path.is_file() {
        match std::fs::read_to_string(&legacy_path) {
            Ok(contents) if contents.trim() == "accepted=true" => {
                config.cpml_accepted = true;
                log::info!("Migrating existing XTTS CPML consent to audio config.json");
                write_audio_config(app, &config)?;
            }
            Ok(_) => log::warn!("Legacy XTTS CPML consent marker is not recognized"),
            Err(error) => log::error!("Unable to read legacy XTTS CPML consent marker: {error}"),
        }
    }
    Ok(config)
}

fn write_audio_config(app: &tauri::AppHandle, audio: &AudioConfig) -> Result<(), String> {
    let _guard = crate::updater::CONFIG_LOCK.lock()
        .map_err(|error| format!("Verrou de configuration : {error}"))?;
    let path = audio_config_path(app)?;
    let mut root: serde_json::Value = if path.is_file() {
        let raw = std::fs::read_to_string(&path)
            .map_err(|error| format!("Lecture de la configuration locale impossible : {error}"))?;
        serde_json::from_str(&raw)
            .map_err(|error| format!("Configuration locale Aldus invalide : {error}"))?
    } else {
        serde_json::json!({})
    };
    let object = root
        .as_object_mut()
        .ok_or("La racine de config.json doit être un objet JSON.")?;
    object.insert(
        "audio".into(),
        serde_json::to_value(audio)
            .map_err(|error| format!("Sérialisation de la configuration audio impossible : {error}"))?,
    );
    let contents = serde_json::to_vec_pretty(&root)
        .map_err(|error| format!("Sérialisation de config.json impossible : {error}"))?;
    let temporary = path.with_extension("json.tmp");
    if let Err(error) = std::fs::write(&temporary, contents) {
        if let Err(cleanup_error) = std::fs::remove_file(&temporary) {
            if cleanup_error.kind() != std::io::ErrorKind::NotFound {
                log::warn!("Audio config temp cleanup failed: {cleanup_error}");
            }
        }
        return Err(format!("Écriture temporaire de config.json impossible : {error}"));
    }
    if let Err(error) = std::fs::rename(&temporary, &path) {
        if let Err(cleanup_error) = std::fs::remove_file(&temporary) {
            log::warn!("Audio config temp cleanup failed: {cleanup_error}");
        }
        return Err(format!("Enregistrement atomique de config.json impossible : {error}"));
    }
    Ok(())
}

pub fn save_audio_consent(
    app: &tauri::AppHandle,
    accepted: bool,
) -> Result<AudioConfig, String> {
    let mut config = get_audio_consent(app)?;
    config.cpml_accepted = accepted;
    config.cpml_accepted_at = accepted.then(|| {
        Utc::now().to_rfc3339_opts(SecondsFormat::Secs, true)
    });
    write_audio_config(app, &config).map_err(|error| {
        log::error!("Audio consent persistence failed: {error}");
        error
    })?;
    Ok(config)
}

impl AudioEngine {
    pub fn shutdown(&self) {
        self.running.store(false, Ordering::SeqCst);
        if let Ok(mut child) = self.child.lock() {
            if let Some(child) = child.take() {
                #[cfg(windows)]
                let stopped = Command::new("taskkill")
                    .args(["/PID", &child.pid().to_string(), "/T", "/F"])
                    .output()
                    .is_ok_and(|output| output.status.success());
                #[cfg(not(windows))]
                let stopped = false;
                if !stopped {
                    if let Err(error) = child.kill() {
                        log::warn!("Unable to stop bundled XTTS sidecar: {error}");
                    }
                }
            }
        } else {
            log::error!("Audio sidecar state lock is poisoned during shutdown");
        }
    }
}

pub fn stop_bundled_engine(app: &tauri::AppHandle) {
    app.state::<AudioEngine>().shutdown();
}

pub async fn ensure_bundled_engine(app: &tauri::AppHandle) -> Result<(), String> {
    if !cfg!(all(windows, not(debug_assertions))) {
        return Ok(());
    }

    let engine = app.state::<AudioEngine>();
    let _startup = engine.startup_lock.lock().await;
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Dossier Aldus local introuvable : {error}"))?;
    let config = get_audio_consent(app)?;
    if config.engine_mode != AudioEngineMode::Integrated {
        return Ok(());
    }
    if !config.cpml_accepted {
        return Err("XTTS v2 nécessite votre acceptation de la licence Coqui Public Model License avant le premier téléchargement.".into());
    }

    if !engine.running.load(Ordering::SeqCst) {
        let model_dir = data_dir.join("models");
        let cache_dir = data_dir.join("cache");
        let temp_dir = data_dir.join("temp");
        let runtime_dir = data_dir.join("python-runtime");
        for directory in [&model_dir, &cache_dir, &temp_dir, &runtime_dir] {
            std::fs::create_dir_all(directory).map_err(|error| {
                format!("Création du dossier audio local impossible : {error}")
            })?;
        }

        let ffmpeg_command = app
            .shell()
            .sidecar("ffmpeg")
            .map_err(|error| format!("Sidecar FFmpeg introuvable : {error}"))?;
        let ffmpeg_command: Command = ffmpeg_command.into();
        let ffmpeg_path = ffmpeg_command.get_program().to_string_lossy().into_owned();
        *engine
            .ffmpeg_path
            .lock()
            .map_err(|_| "État du sidecar FFmpeg indisponible.")? = Some(PathBuf::from(&ffmpeg_path));
        let ffmpeg_dir = Path::new(&ffmpeg_path)
            .parent()
            .ok_or("Chemin du sidecar FFmpeg invalide.")?;
        let mut path_entries = vec![ffmpeg_dir.to_string_lossy().into_owned()];
        if let Some(existing_path) = std::env::var_os("PATH") {
            path_entries.extend(std::env::split_paths(&existing_path).map(|path| {
                path.to_string_lossy().into_owned()
            }));
        }
        let process_path = std::env::join_paths(path_entries)
            .map_err(|error| format!("PATH du moteur audio invalide : {error}"))?;

        let (mut events, child) = app
            .shell()
            .sidecar("aldus-audio-server")
            .map_err(|error| format!("Sidecar XTTS introuvable : {error}"))?
            .current_dir(&data_dir)
            .env("ALDUS_LOCAL_DATA_DIR", &data_dir)
            .env("ALDUS_FFMPEG_PATH", &ffmpeg_path)
            .env("TTS_HOME", &model_dir)
            .env("HF_HOME", cache_dir.join("huggingface"))
            .env("TRANSFORMERS_CACHE", cache_dir.join("transformers"))
            .env("TORCH_HOME", cache_dir.join("torch"))
            .env("XDG_CACHE_HOME", &cache_dir)
            .env("TEMP", &temp_dir)
            .env("TMP", &temp_dir)
            .env("TMPDIR", &temp_dir)
            .env("PYTHONPYCACHEPREFIX", cache_dir.join("pycache"))
            .env("COQUI_TOS_AGREED", "1")
            .env("PATH", process_path)
            .spawn()
            .map_err(|error| format!("Démarrage du moteur XTTS impossible : {error}"))?;

        *engine
            .child
            .lock()
            .map_err(|_| "État du moteur XTTS indisponible.")? = Some(child);
        engine.running.store(true, Ordering::SeqCst);

        let event_app = app.clone();
        tauri::async_runtime::spawn(async move {
            while let Some(event) = events.recv().await {
                match event {
                    CommandEvent::Stdout(line) => {
                        log::info!("XTTS stdout: {}", String::from_utf8_lossy(&line).trim_end());
                    }
                    CommandEvent::Stderr(line) => {
                        log::warn!("XTTS stderr: {}", String::from_utf8_lossy(&line).trim_end());
                    }
                    CommandEvent::Terminated(status) => {
                        log::info!("XTTS sidecar terminated: {:?}", status);
                    }
                    _ => {}
                }
            }
            let state = event_app.state::<AudioEngine>();
            state.running.store(false, Ordering::SeqCst);
            if let Ok(mut child) = state.child.lock() {
                child.take();
            };
        });
    }

    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(1))
        .timeout(Duration::from_secs(2))
        .build()
        .map_err(|error| format!("Client de santé XTTS impossible : {error}"))?;
    let endpoint = format!("{DEFAULT_TTS_ENDPOINT}/status");
    let started = Instant::now();
    let mut timeout = SIDECAR_STARTUP_TIMEOUT;
    loop {
        if !engine.running.load(Ordering::SeqCst) {
            let error = "Le moteur XTTS intégré s'est arrêté pendant son initialisation.";
            log::error!("audio init failed endpoint={} error={}", endpoint, error);
            return Err(error.into());
        }
        let last_error;
        match client.get(&endpoint).send().await {
            Ok(response) if response.status().is_success() => {
                match response.json::<EngineInitStatus>().await {
                    Ok(status) => {
                        timeout = AUDIO_INIT_TIMEOUT;
                        last_error = status.stage.clone();
                        emit_audio_init_progress(app, status.percent, &status.stage);
                        if status.status == "error" || status.error.is_some() {
                            let error = status.error.unwrap_or(status.stage);
                            engine.shutdown();
                            log::error!("audio init failed endpoint={} error={}", endpoint, error);
                            return Err(format!("Initialisation XTTS impossible : {error}"));
                        }
                        if status.model_loaded {
                            return Ok(());
                        }
                    }
                    Err(error) => last_error = format!("réponse de statut illisible : {error}"),
                }
            }
            Ok(response) => {
                last_error = format!("HTTP {}", response.status());
            }
            Err(error) => last_error = error.to_string(),
        }
        if started.elapsed() >= timeout {
            engine.shutdown();
            log::error!(
                "audio init timeout endpoint={} timeout_seconds={} last_error={}",
                endpoint,
                timeout.as_secs(),
                last_error
            );
            let error = format!(
                "Le moteur XTTS n'a pas terminé son initialisation sous {} secondes : {last_error}",
                timeout.as_secs()
            );
            return Err(error);
        }
        tokio::time::sleep(Duration::from_millis(300)).await;
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioVoice {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChapterChoice {
    pub index: u32,
    pub title: String,
    pub word_count: u32,
    pub page_count: u32,
    pub estimated_duration_seconds: u32,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct AudioGenerationProgress {
    book_id: String,
    chapter_index: u32,
    chapter_count: u32,
    chapter_title: String,
    progress: u32,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    segment_index: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    segment_count: Option<u32>,
}

#[derive(Deserialize)]
#[serde(untagged)]
enum VoiceResponse {
    Wrapped { voices: Vec<AudioVoice> },
    List(Vec<AudioVoice>),
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SynthesisRequest<'a> {
    text: &'a str,
    voice_id: &'a str,
    language: &'static str,
    output_format: &'static str,
    chapter_index: u32,
    chapter_title: &'a str,
    segment_index: u32,
    segment_count: u32,
}

#[derive(Clone, Debug)]
struct NarratedChapter {
    title: String,
    text: String,
}

fn validate_local_endpoint(endpoint: &str) -> Result<String, String> {
    let parsed = reqwest::Url::parse(&endpoint)
        .map_err(|error| format!("URL du moteur audio invalide : {error}"))?;
    let host = parsed.host_str().unwrap_or("").trim_matches(['[', ']']);
    if parsed.scheme() != "http" || !["127.0.0.1", "localhost", "::1"].contains(&host) {
        return Err("Le moteur audio doit être un service HTTP local (localhost). Le texte du livre ne sera jamais envoyé à un serveur distant.".into());
    }
    Ok(endpoint.trim_end_matches('/').to_string())
}

fn local_endpoint() -> Result<String, String> {
    let endpoint = std::env::var("ALDUS_TTS_URL").unwrap_or_else(|_| DEFAULT_TTS_ENDPOINT.into());
    validate_local_endpoint(&endpoint)
}

fn endpoint_url(base: &str, route: &str) -> String {
    format!("{}{route}", base.trim_end_matches('/'))
}

async fn client() -> Result<(reqwest::Client, String), String> {
    let endpoint = local_endpoint()?;
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(10))
        .timeout(std::time::Duration::from_secs(900))
        .build()
        .map_err(|error| format!("Client du moteur audio impossible : {error}"))?;
    Ok((client, endpoint))
}

async fn error_response_body(response: reqwest::Response) -> (reqwest::StatusCode, String) {
    let status = response.status();
    let body = response
        .text()
        .await
        .unwrap_or_else(|error| format!("corps de réponse illisible : {error}"));
    (status, body)
}

pub async fn list_voices() -> Result<Vec<AudioVoice>, String> {
    let (client, endpoint) = client().await?;
    let request_url = endpoint_url(&endpoint, "/voices");
    let response = client.get(&request_url).send().await.map_err(|error| {
        let category = if error.is_timeout() {
            "timeout"
        } else if error.is_connect() {
            "connection"
        } else {
            "transport"
        };
        log::error!(
            "audio voices request failed category={} endpoint={} error={}",
            category,
            request_url,
            error
        );
        let explanation = if error.is_timeout() {
            "Délai dépassé lors de la connexion au moteur TTS local"
        } else if error.is_connect() {
            "Moteur TTS local arrêté ou inaccessible"
        } else {
            "Échange HTTP avec le moteur TTS local interrompu"
        };
        format!("{explanation} sur {request_url} : {error}")
    })?;
    if !response.status().is_success() {
        let (status, body) = error_response_body(response).await;
        if status.is_server_error() {
            log::error!(
                "audio voices HTTP failure endpoint={} status={} response_body={}",
                request_url,
                status,
                body
            );
        } else {
            log::warn!(
                "audio voices request rejected endpoint={} status={} response_body={}",
                request_url,
                status,
                body
            );
        }
        return Err(format!(
            "Le moteur TTS a répondu HTTP {status} sur {request_url} : {body}"
        ));
    }
    let payload = response.json::<VoiceResponse>().await.map_err(|error| {
        log::error!(
            "audio voices response parse failed endpoint={} error={}",
            request_url,
            error
        );
        format!("Réponse des voix TTS invalide sur {request_url} : {error}")
    })?;
    let voices = match payload {
        VoiceResponse::Wrapped { voices } | VoiceResponse::List(voices) => voices,
    };
    let voices: Vec<_> = voices
        .into_iter()
        .filter(|voice| {
            voice
                .language
                .as_deref()
                .map(|language| language.to_ascii_lowercase().starts_with("fr"))
                .unwrap_or(false)
        })
        .collect();
    if voices.is_empty() {
        return Err("Aucune voix française n'est configurée dans le moteur TTS local.".into());
    }
    Ok(voices)
}

pub fn list_book_chapters(
    app: &tauri::AppHandle,
    book_id: &str,
) -> Result<Vec<AudioChapterChoice>, String> {
    let config = read_config(app)?;
    let book = config
        .books
        .iter()
        .find(|book| book.id == book_id)
        .ok_or("Ouvrage introuvable dans la bibliothèque.")?;
    extract_chapters(book)?
        .into_iter()
        .enumerate()
        .map(|(index, chapter)| {
            let (word_count, page_count, estimated_duration_seconds) =
                estimate_chapter_metadata(&chapter.text)?;
            Ok(AudioChapterChoice {
                index: index as u32 + 1,
                title: chapter.title,
                word_count,
                page_count,
                estimated_duration_seconds,
            })
        })
        .collect()
}

fn estimate_chapter_metadata(text: &str) -> Result<(u32, u32, u32), String> {
    let word_count = u32::try_from(text.split_whitespace().count())
        .map_err(|error| format!("Nombre de mots du chapitre invalide : {error}"))?;
    let page_count = metadata::estimated_pages(word_count)
        .ok_or("Estimation du nombre de pages du chapitre invalide.")?;
    let estimated_duration_seconds = u32::try_from((u64::from(word_count) * 60 + 134) / 135)
        .map_err(|error| format!("Durée estimée du chapitre invalide : {error}"))?;
    Ok((word_count, page_count, estimated_duration_seconds))
}

fn clean_narration(text: &str) -> String {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .filter(|line| {
            let lower = line.to_lowercase();
            let compact: String = lower
                .chars()
                .filter(|character| !character.is_whitespace())
                .collect();
            let page_number = compact.chars().all(|character| character.is_ascii_digit());
            !page_number
                && !lower.starts_with("http://")
                && !lower.starts_with("https://")
                && !lower.starts_with("www.")
                && !lower.starts_with("isbn")
                && !lower.contains("tous droits réservés")
                && !lower.contains("all rights reserved")
        })
        .collect::<Vec<_>>()
        .join("\n")
}

fn append_word_bounded_segments(text: &str, max_chars: usize, output: &mut Vec<String>) {
    let mut current = String::new();
    for word in text.split_whitespace() {
        let word_chars = word.chars().count();
        let current_chars = current.chars().count();
        if !current.is_empty() && current_chars + 1 + word_chars > max_chars {
            output.push(std::mem::take(&mut current));
        }
        if word_chars <= max_chars {
            if !current.is_empty() {
                current.push(' ');
            }
            current.push_str(word);
            continue;
        }
        for character in word.chars() {
            if current.chars().count() == max_chars {
                output.push(std::mem::take(&mut current));
            }
            current.push(character);
        }
    }
    if !current.is_empty() {
        output.push(current);
    }
}

fn chunk_narration(text: &str, max_chars: usize) -> Vec<String> {
    let max_chars = max_chars.max(1);
    let mut chunks = Vec::new();
    for paragraph in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let mut current = String::new();
        let mut sentence_start = 0;
        for (byte_index, character) in paragraph.char_indices() {
            let end = byte_index + character.len_utf8();
            let sentence_end = matches!(character, '.' | '!' | '?' | '\u{2026}' | ';' | ':')
                && paragraph[end..]
                    .chars()
                    .next()
                    .map(char::is_whitespace)
                    .unwrap_or(true);
            if sentence_end {
                let sentence = paragraph[sentence_start..end].trim();
                append_sentence(sentence, max_chars, &mut current, &mut chunks);
                sentence_start = end;
            }
        }
        append_sentence(
            paragraph[sentence_start..].trim(),
            max_chars,
            &mut current,
            &mut chunks,
        );
        if !current.is_empty() {
            chunks.push(current);
        }
    }
    chunks
}

fn append_sentence(
    sentence: &str,
    max_chars: usize,
    current: &mut String,
    chunks: &mut Vec<String>,
) {
    if sentence.is_empty() {
        return;
    }
    let current_chars = current.chars().count();
    let sentence_chars = sentence.chars().count();
    if sentence_chars <= max_chars
        && (current.is_empty() || current_chars + 1 + sentence_chars <= max_chars)
    {
        if !current.is_empty() {
            current.push(' ');
        }
        current.push_str(sentence);
        return;
    }
    if !current.is_empty() {
        chunks.push(std::mem::take(current));
    }
    if sentence_chars <= max_chars {
        current.push_str(sentence);
    } else {
        append_word_bounded_segments(sentence, max_chars, chunks);
    }
}

fn node_text(node: roxmltree::Node<'_, '_>) -> String {
    node.descendants()
        .filter(|child| child.is_text())
        .filter_map(|child| child.text())
        .collect::<Vec<_>>()
        .join(" ")
}

fn xhtml_blocks(document: &roxmltree::Document<'_>) -> String {
    let body = document
        .descendants()
        .find(|node| node.has_tag_name("body"));
    let Some(body) = body else {
        return String::new();
    };
    let mut blocks = Vec::new();
    for node in body.descendants().filter(|node| {
        node.is_element()
            && ["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre"]
                .contains(&node.tag_name().name())
            && !node.ancestors().any(|ancestor| {
                ancestor.has_tag_name("nav")
                    && ancestor
                        .attribute(("http://www.idpf.org/2007/ops", "type"))
                        .is_some_and(|types| {
                            types
                                .split_whitespace()
                                .any(|kind| ["toc", "page-list", "landmarks"].contains(&kind))
                        })
            })
    }) {
        let text = node_text(node);
        let text = clean_narration(&text);
        if !text.is_empty() {
            blocks.push(text);
        }
    }
    if blocks.is_empty() && !body.descendants().any(|node| node.has_tag_name("nav")) {
        clean_narration(&node_text(body))
    } else {
        blocks.join("\n")
    }
}

fn extract_epub(path: &Path) -> Result<Vec<NarratedChapter>, String> {
    let mut archive = ZipArchive::new(File::open(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("EPUB illisible : {error}"))?;
    let container = metadata::xml_entry(&mut archive, "META-INF/container.xml")
        .ok_or("EPUB sans META-INF/container.xml.")?;
    let container = metadata::parse_xml(&container).ok_or("Container EPUB invalide.")?;
    let package_path = container
        .descendants()
        .find(|node| node.has_tag_name("rootfile"))
        .and_then(|node| node.attribute("full-path"))
        .ok_or("Chemin OPF absent du conteneur EPUB.")?;
    let package_xml =
        metadata::xml_entry(&mut archive, package_path).ok_or("OPF EPUB introuvable.")?;
    let package = metadata::parse_xml(&package_xml).ok_or("OPF EPUB invalide.")?;
    let spine = package
        .descendants()
        .find(|node| node.has_tag_name("spine"))
        .ok_or("Structure spine absente de l'EPUB.")?;
    let mut chapters = Vec::new();
    for item_ref in spine.children().filter(|node| node.has_tag_name("itemref")) {
        if item_ref.attribute("linear") == Some("no") {
            continue;
        }
        let id = item_ref.attribute("idref").unwrap_or("");
        let Some(item) = package
            .descendants()
            .find(|node| node.has_tag_name("item") && node.attribute("id") == Some(id))
        else {
            continue;
        };
        if item.attribute("media-type") != Some("application/xhtml+xml") {
            continue;
        }
        let Some(href) = item.attribute("href") else {
            continue;
        };
        let entry_path = metadata::archive_path(package_path, href);
        let Some(text) = metadata::xml_entry(&mut archive, &entry_path) else {
            continue;
        };
        let Some(document) = metadata::parse_xml(&text) else {
            continue;
        };
        if metadata::excluded_section(&entry_path, &document) {
            continue;
        }
        let body = document
            .descendants()
            .find(|node| node.has_tag_name("body"));
        let title = body
            .and_then(|body| {
                body.descendants()
                    .find(|node| ["h1", "h2", "h3"].contains(&node.tag_name().name()))
            })
            .map(node_text)
            .map(|text| clean_narration(&text))
            .filter(|text| !text.is_empty())
            .or_else(|| {
                Path::new(&entry_path)
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .map(|stem| stem.replace(['_', '-'], " "))
            })
            .unwrap_or_else(|| format!("Chapitre {}", chapters.len() + 1));
        let text = xhtml_blocks(&document);
        if !text.is_empty() {
            chapters.push(NarratedChapter { title, text });
        }
    }
    if chapters.is_empty() {
        return Err("Aucun chapitre narratif lisible dans l'EPUB.".into());
    }
    Ok(chapters)
}

fn structural_heading(text: &str) -> bool {
    let normalized = text.trim().to_lowercase();
    [
        "sommaire",
        "table des matières",
        "contents",
        "copyright",
        "mentions légales",
        "page de titre",
        "couverture",
        "colophon",
        "tous droits réservés",
    ]
    .iter()
    .any(|heading| normalized == *heading)
}

fn extract_docx(path: &Path) -> Result<Vec<NarratedChapter>, String> {
    let mut archive = ZipArchive::new(File::open(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("DOCX illisible : {error}"))?;
    let document_xml = metadata::xml_entry(&mut archive, "word/document.xml")
        .ok_or("DOCX sans word/document.xml.")?;
    let document = metadata::parse_xml(&document_xml).ok_or("word/document.xml invalide.")?;
    let mut heading_style_ids = BTreeSet::new();
    if let Some(styles_xml) = metadata::xml_entry(&mut archive, "word/styles.xml") {
        if let Some(styles) = metadata::parse_xml(&styles_xml) {
            for style in styles
                .descendants()
                .filter(|node| node.has_tag_name("style"))
            {
                if style.children().any(|child| {
                    child.has_tag_name("name")
                        && metadata::word_attribute(child, "val")
                            .is_some_and(metadata::first_heading)
                }) {
                    if let Some(id) = metadata::word_attribute(style, "styleId") {
                        heading_style_ids.insert(id.to_string());
                    }
                }
            }
        }
    }
    let mut chapters: Vec<NarratedChapter> = Vec::new();
    let mut fallback = Vec::new();
    for paragraph in document.descendants().filter(|node| node.has_tag_name("p")) {
        let text = clean_narration(&node_text(paragraph));
        if text.is_empty() {
            continue;
        }
        fallback.push(text.clone());
        let style = paragraph
            .children()
            .filter(|node| node.has_tag_name("pPr"))
            .flat_map(|node| node.children())
            .find(|node| node.has_tag_name("pStyle"))
            .and_then(|node| metadata::word_attribute(node, "val"));
        let heading = style.is_some_and(|style| {
            metadata::first_heading(style) || heading_style_ids.contains(style)
        });
        if heading {
            if structural_heading(&text) {
                continue;
            }
            chapters.push(NarratedChapter {
                title: text.clone(),
                text,
            });
        } else if let Some(chapter) = chapters.last_mut() {
            chapter.text.push('\n');
            chapter.text.push_str(&text);
        }
    }
    if chapters.is_empty() {
        let text = clean_narration(&fallback.join("\n"));
        if !text.is_empty() {
            chapters.push(NarratedChapter {
                title: "Livre".into(),
                text,
            });
        }
    }
    if chapters.is_empty() {
        return Err("Aucun texte narratif lisible dans le DOCX.".into());
    }
    Ok(chapters)
}

fn extract_pdf(path: &Path) -> Result<Vec<NarratedChapter>, String> {
    let document =
        lopdf::Document::load(path).map_err(|error| format!("PDF illisible : {error}"))?;
    let pages: Vec<u32> = document.get_pages().keys().copied().collect();
    let text = document
        .extract_text(&pages)
        .map_err(|error| format!("Texte PDF impossible à extraire : {error}"))?;
    let text = clean_narration(&text);
    if text.is_empty() {
        return Err("Aucun texte lisible dans le PDF (document peut-être scanné).".into());
    }
    Ok(vec![NarratedChapter {
        title: "Livre".into(),
        text,
    }])
}

fn extract_chapters(book: &Book) -> Result<Vec<NarratedChapter>, String> {
    let mut errors = Vec::new();
    for format in ["epub", "docx", "pdf"] {
        if let Some(file) = book.files.iter().find(|file| file.format == format) {
            let result = match format {
                "epub" => extract_epub(Path::new(&file.path)),
                "docx" => extract_docx(Path::new(&file.path)),
                _ => extract_pdf(Path::new(&file.path)),
            };
            match result {
                Ok(chapters) => return Ok(chapters),
                Err(error) => errors.push(format!("{format}: {error}")),
            }
        }
    }
    Err(if errors.is_empty() {
        "Aucun fichier EPUB, DOCX ou PDF associé à l'ouvrage.".into()
    } else {
        errors.join("\n")
    })
}

fn safe_component(value: &str) -> String {
    let component: String = value
        .chars()
        .map(|character| {
            if character.is_alphanumeric() || character == '-' || character == '_' {
                character
            } else {
                '-'
            }
        })
        .collect();
    component
        .trim_matches('-')
        .chars()
        .take(80)
        .collect::<String>()
}

fn selected_chapter_indices(
    chapter_count: usize,
    chapter_index: u32,
) -> Result<Vec<usize>, String> {
    if chapter_index > 0 && chapter_index as usize <= chapter_count {
        Ok(vec![chapter_index as usize - 1])
    } else {
        Err("Le chapitre sélectionné n'existe pas dans cet ouvrage.".into())
    }
}

fn merge_audio_chapters(
    existing: &[AudioChapter],
    generated: Vec<AudioChapter>,
) -> Vec<AudioChapter> {
    let mut merged = existing.to_vec();
    for chapter in generated {
        if let Some(previous) = merged
            .iter_mut()
            .find(|previous| previous.index == chapter.index)
        {
            *previous = chapter;
        } else {
            merged.push(chapter);
        }
    }
    merged.sort_by_key(|chapter| chapter.index);
    merged
}

struct AudioOutputDirectory {
    path: PathBuf,
    committed: bool,
}

impl AudioOutputDirectory {
    fn create(path: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&path)
            .map_err(|error| format!("Création du dossier audio impossible : {error}"))?;
        Ok(Self {
            path,
            committed: false,
        })
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn commit(&mut self) {
        self.committed = true;
    }
}

impl Drop for AudioOutputDirectory {
    fn drop(&mut self) {
        if !self.committed {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }
}

struct AudioTempDirectory {
    path: PathBuf,
}

impl AudioTempDirectory {
    fn create(path: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&path).map_err(|error| {
            format!("Création du dossier temporaire audio impossible : {error}")
        })?;
        Ok(Self { path })
    }

    fn path(&self) -> &Path {
        &self.path
    }
}

impl Drop for AudioTempDirectory {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.path);
    }
}

fn assemble_mp3_segments(
    directory: &Path,
    segments: &[PathBuf],
    output_path: &Path,
    chapter_title: &str,
    ffmpeg_path: &Path,
    chapter_started: Instant,
) -> Result<(), String> {
    chapter_time_remaining(chapter_started)?;
    if segments.is_empty() {
        return Err(format!(
            "Aucun segment audio pour le chapitre « {chapter_title} »."
        ));
    }
    if segments.len() == 1 {
        std::fs::copy(&segments[0], output_path).map_err(|error| {
            format!("Finalisation audio impossible pour « {chapter_title} » : {error}")
        })?;
        let _ = std::fs::remove_file(&segments[0]);
        return Ok(());
    }

    let manifest_path = directory.join("segments.concat.txt");
    let mut manifest = String::new();
    for segment in segments {
        let name = segment
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or("Nom de segment audio temporaire invalide.")?;
        manifest.push_str(&format!("file '{name}'\n"));
    }
    std::fs::write(&manifest_path, manifest)
        .map_err(|error| format!("Liste de segments impossible à écrire : {error}"))?;

    let stderr_path = directory.join("ffmpeg.stderr");
    let stderr = File::create(&stderr_path).map_err(|error| format!("Trace FFmpeg inaccessible : {error}"))?;
    let mut process = Command::new(ffmpeg_path)
        .current_dir(directory)
        .args([
            "-nostdin",
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
        ])
        .arg("segments.concat.txt")
        .args(["-vn", "-c:a", "libmp3lame", "-b:a", "192k"])
        .arg(output_path)
        .stdout(std::process::Stdio::null())
        .stderr(stderr)
        .spawn()
        .map_err(|error| {
            format!(
                "Impossible de lancer FFmpeg pour assembler le chapitre « {chapter_title} » : {error}"
            )
        })?;
    let status = loop {
        match process.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if let Err(error) = chapter_time_remaining(chapter_started) {
                    process.kill().map_err(|kill| format!("{error} Arrêt FFmpeg impossible : {kill}"))?;
                    process.wait().map_err(|wait| format!("{error} Attente FFmpeg impossible : {wait}"))?;
                    return Err(error);
                }
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(error) => {
                if let Err(kill) = process.kill() { log::error!("Arrêt FFmpeg : {kill}"); }
                if let Err(wait) = process.wait() { log::error!("Attente FFmpeg : {wait}"); }
                return Err(format!("Suivi FFmpeg impossible : {error}"));
            }
        }
    };
    if !status.success() {
        let detail = std::fs::read_to_string(&stderr_path).map_err(|error| format!("Lecture de la trace FFmpeg : {error}"))?;
        return Err(format!(
            "Assemblage FFmpeg échoué pour le chapitre « {chapter_title} » : {}",
            detail.trim()
        ));
    }
    let metadata = std::fs::metadata(output_path)
        .map_err(|error| format!("MP3 assemblé introuvable pour « {chapter_title} » : {error}"))?;
    if metadata.len() == 0 {
        return Err(format!(
            "MP3 assemblé vide pour le chapitre « {chapter_title} »."
        ));
    }
    for segment in segments {
        let _ = std::fs::remove_file(segment);
    }
    Ok(())
}

fn emit_progress(
    app: &tauri::AppHandle,
    book_id: &str,
    chapter_index: u32,
    chapter_count: u32,
    title: &str,
    progress: u32,
    status: &str,
    segment_index: Option<u32>,
    segment_count: Option<u32>,
) {
    let _ = app.emit(
        "audio-generation-progress",
        AudioGenerationProgress {
            book_id: book_id.into(),
            chapter_index,
            chapter_count,
            chapter_title: title.into(),
            progress,
            status: status.into(),
            segment_index,
            segment_count,
        },
    );
}

fn emit_segment_failure(
    app: &tauri::AppHandle,
    book_id: &str,
    chapter_index: u32,
    chapter_count: u32,
    chapter_title: &str,
    progress: u32,
    segment_index: u32,
    segment_count: u32,
    detail: &str,
) {
    let status = format!(
        "Échec du chapitre {chapter_index}, segment {segment_index}/{segment_count} : {detail}"
    );
    emit_progress(
        app,
        book_id,
        chapter_index,
        chapter_count,
        chapter_title,
        progress,
        &status,
        Some(segment_index),
        Some(segment_count),
    );
}

pub async fn generate_book_audio(
    app: tauri::AppHandle,
    book_id: String,
    export_directory: String,
    voice_id: String,
    chapter_index: u32,
) -> Result<super::LibraryConfig, String> {
    if export_directory.trim().is_empty() {
        return Err("Choisissez un dossier d'export avant de générer l'audio.".into());
    }
    let root = Path::new(&export_directory)
        .canonicalize()
        .map_err(|error| format!("Dossier d'export inaccessible : {error}"))?;
    if !root.is_dir() {
        return Err("Le dossier d'export n'est pas un dossier valide.".into());
    }
    if let Err(error) = ensure_bundled_engine(&app).await {
        log::error!("audio engine startup failed before generation: {error}");
        emit_audio_init_failure(&app, &error);
        return Err(error);
    }
    let config = read_config(&app)?;
    let book = config
        .books
        .iter()
        .find(|book| book.id == book_id)
        .cloned()
        .ok_or("Ouvrage introuvable dans la bibliothèque.")?;
    let chapters = extract_chapters(&book)?;
    let selected_indices = selected_chapter_indices(chapters.len(), chapter_index)?;
    let voices = list_voices().await?;
    let voice = voices
        .iter()
        .find(|voice| voice.id == voice_id)
        .ok_or("La voix sélectionnée n'existe pas dans le moteur TTS local.")?;
    let (client, endpoint) = client().await?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let directory = root.join("Audio").join(format!(
        "{}-{}-{timestamp}",
        safe_component(&book.title),
        safe_component(&book.id)
    ));
    let mut output_directory = AudioOutputDirectory::create(directory)?;
    let local_data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| format!("Dossier Aldus local introuvable : {error}"))?;
    let temporary_directory = AudioTempDirectory::create(
        local_data_dir
            .join("temp")
            .join("audio")
            .join(format!("{}-{timestamp}", safe_component(&book.id))),
    )?;
    let ffmpeg_path = if cfg!(all(windows, not(debug_assertions))) {
        app.state::<AudioEngine>()
            .ffmpeg_path
            .lock()
            .map_err(|_| "État du sidecar FFmpeg indisponible.")?
            .clone()
            .ok_or("Sidecar FFmpeg non initialisé.")?
    } else {
        PathBuf::from("ffmpeg")
    };
    let total = chapters.len() as u32;
    let selected_chapters: Vec<_> = selected_indices
        .iter()
        .copied()
        .map(|index| {
            (
                index,
                chunk_narration(&chapters[index].text, MAX_TTS_SEGMENT_CHARS),
            )
        })
        .collect();
    let total_segments: usize = selected_chapters
        .iter()
        .map(|(_, segments)| segments.len())
        .sum();
    if total_segments == 0 {
        return Err("Aucun segment narratif à synthétiser.".into());
    }
    let mut completed_segments = 0usize;
    let mut audio_chapters = Vec::with_capacity(selected_chapters.len());
    for (index, segments) in selected_chapters {
        let chapter_started = Instant::now();
        let chapter = &chapters[index];
        let chapter_number = index as u32 + 1;
        let safe_title = safe_component(&chapter.title);
        let path = output_directory
            .path()
            .join(format!("{chapter_number:03}-{safe_title}.mp3"));
        let mut segment_paths = Vec::with_capacity(segments.len());
        let segment_count = segments.len();
        for (segment_position, segment_text) in segments.iter().enumerate() {
            let segment_number = segment_position + 1;
            let segment_path = temporary_directory.path().join(format!(
                "{chapter_number:03}-segment-{segment_number:04}.mp3"
            ));
            let status = format!(
                "Synthèse du chapitre {chapter_number} sur {total}, segment {segment_number}/{segment_count} : {}",
                chapter.title
            );
            emit_progress(
                &app,
                &book_id,
                chapter_number,
                total,
                &chapter.title,
                ((completed_segments * 90) / total_segments) as u32,
                &status,
                Some(segment_number as u32),
                Some(segment_count as u32),
            );
            let request_url = endpoint_url(&endpoint, "/synthesize");
            log::info!(
                "audio synthesis segment started endpoint={} book_id={} voice_id={} chapter={}/{} segment={}/{} characters={}",
                request_url,
                book_id,
                voice.id,
                chapter_number,
                total,
                segment_number,
                segment_count,
                segment_text.chars().count()
            );
            let request_started = std::time::Instant::now();
            let remaining = chapter_time_remaining(chapter_started).map_err(|error| {
                log::error!("audio chapter timeout book_id={book_id} chapter={chapter_number}: {error}");
                emit_segment_failure(&app, &book_id, chapter_number, total, &chapter.title,
                    ((completed_segments * 90) / total_segments) as u32, segment_number as u32, segment_count as u32, &error);
                error
            })?;
            let response = match client
                .post(&request_url)
                .timeout(remaining)
                .json(&SynthesisRequest {
                    text: segment_text,
                    voice_id: &voice.id,
                    language: "fr",
                    output_format: "mp3",
                    chapter_index: chapter_number,
                    chapter_title: &chapter.title,
                    segment_index: segment_number as u32,
                    segment_count: segment_count as u32,
                })
                .send()
                .await
            {
                Ok(response) => response,
                Err(error) => {
                    let category = if error.is_timeout() {
                        "timeout"
                    } else if error.is_connect() {
                        "connection"
                    } else {
                        "transport"
                    };
                    log::error!(
                        "audio synthesis transport failure category={} endpoint={} book_id={} voice_id={} chapter={}/{} segment={}/{} error={}",
                        category,
                        request_url,
                        book_id,
                        voice.id,
                        chapter_number,
                        total,
                        segment_number,
                        segment_count,
                        error
                    );
                    let user_message = if error.is_timeout() {
                        "Délai dépassé pendant la synthèse locale"
                    } else if error.is_connect() {
                        "Connexion au wrapper TTS impossible (serveur arrêté ou redémarré)"
                    } else {
                        "Échange HTTP avec le wrapper TTS interrompu"
                    };
                    let message = format!("{user_message} : {error}");
                    emit_segment_failure(
                        &app,
                        &book_id,
                        chapter_number,
                        total,
                        &chapter.title,
                        ((completed_segments * 90) / total_segments) as u32,
                        segment_number as u32,
                        segment_count as u32,
                        &message,
                    );
                    return Err(format!(
                        "{user_message} au chapitre {chapter_number}, segment {segment_number}/{segment_count} (« {} ») : {error}",
                        chapter.title
                    ));
                }
            };
            let http_status = response.status();
            if !response.status().is_success() {
                let (_, response_body) = error_response_body(response).await;
                let context = format!(
                    "endpoint={} book_id={} voice_id={} chapter={}/{} chapter_title={:?} segment={}/{} http_status={} response_body={}",
                    request_url,
                    book_id,
                    voice.id,
                    chapter_number,
                    total,
                    chapter.title,
                    segment_number,
                    segment_count,
                    http_status,
                    response_body
                );
                if http_status.is_server_error() {
                    log::error!("audio synthesis server failure {context}");
                } else {
                    log::warn!("audio synthesis request rejected {context}");
                }
                let detail: String = response_body.chars().take(500).collect();
                let failure_kind = if http_status.is_server_error() {
                    "Erreur d'inférence du moteur TTS local"
                } else {
                    "Requête refusée par le moteur TTS local"
                };
                let message = format!("{failure_kind} (HTTP {http_status}) : {detail}");
                emit_segment_failure(
                    &app,
                    &book_id,
                    chapter_number,
                    total,
                    &chapter.title,
                    ((completed_segments * 90) / total_segments) as u32,
                    segment_number as u32,
                    segment_count as u32,
                    &message,
                );
                return Err(format!(
                    "{failure_kind} (HTTP {http_status}) au chapitre {chapter_number}, segment {segment_number}/{segment_count} (« {} ») : {detail}",
                    chapter.title
                ));
            }
            log::info!(
                "audio synthesis HTTP success endpoint={} book_id={} chapter={}/{} segment={}/{} http_status={} elapsed_ms={}",
                request_url,
                book_id,
                chapter_number,
                total,
                segment_number,
                segment_count,
                http_status,
                request_started.elapsed().as_millis()
            );
            let bytes = response.bytes().await.map_err(|error| {
                log::error!(
                    "audio response body failure endpoint={} book_id={} chapter={} segment={}/{} error={}",
                    request_url,
                    book_id,
                    chapter_number,
                    segment_number,
                    segment_count,
                    error
                );
                emit_segment_failure(
                    &app,
                    &book_id,
                    chapter_number,
                    total,
                    &chapter.title,
                    ((completed_segments * 90) / total_segments) as u32,
                    segment_number as u32,
                    segment_count as u32,
                    &format!("Lecture de la réponse HTTP impossible : {error}"),
                );
                format!(
                    "Lecture HTTP impossible au chapitre {chapter_number}, segment {segment_number}/{segment_count} : {error}"
                )
            })?;
            if bytes.is_empty() {
                log::error!(
                    "audio wrapper returned empty response endpoint={} book_id={} chapter={} segment={}/{}",
                    request_url,
                    book_id,
                    chapter_number,
                    segment_number,
                    segment_count
                );
                emit_segment_failure(
                    &app,
                    &book_id,
                    chapter_number,
                    total,
                    &chapter.title,
                    ((completed_segments * 90) / total_segments) as u32,
                    segment_number as u32,
                    segment_count as u32,
                    "réponse MP3 vide du wrapper",
                );
                return Err(format!(
                    "Le wrapper TTS a renvoyé un segment vide au chapitre {chapter_number}, segment {segment_number}/{segment_count}."
                ));
            }
            std::fs::write(&segment_path, &bytes).map_err(|error| {
                log::error!(
                    "audio segment write failed path={} book_id={} chapter={} segment={}/{} error={}",
                    segment_path.display(),
                    book_id,
                    chapter_number,
                    segment_number,
                    segment_count,
                    error
                );
                emit_segment_failure(
                    &app,
                    &book_id,
                    chapter_number,
                    total,
                    &chapter.title,
                    ((completed_segments * 90) / total_segments) as u32,
                    segment_number as u32,
                    segment_count as u32,
                    &format!("Écriture temporaire impossible : {error}"),
                );
                format!(
                    "Écriture impossible au chapitre {chapter_number}, segment {segment_number}/{segment_count} : {error}"
                )
            })?;
            segment_paths.push(segment_path);
            completed_segments += 1;
            emit_progress(
                &app,
                &book_id,
                chapter_number,
                total,
                &chapter.title,
                ((completed_segments * 90) / total_segments) as u32,
                &format!(
                    "Segment {segment_number}/{segment_count} terminé : {}",
                    chapter.title
                ),
                Some(segment_number as u32),
                Some(segment_count as u32),
            );
        }
        emit_progress(
            &app,
            &book_id,
            chapter_number,
            total,
            &chapter.title,
            ((completed_segments * 90) / total_segments) as u32,
            &format!(
                "Assemblage du chapitre {chapter_number} : {}",
                chapter.title
            ),
            None,
            None,
        );
        if let Err(error) = assemble_mp3_segments(
            temporary_directory.path(),
            &segment_paths,
            &path,
            &chapter.title,
            &ffmpeg_path,
            chapter_started,
        ) {
            log::error!(
                "audio segment assembly failed book_id={} chapter={}/{} segment_count={} output={} error={}",
                book_id,
                chapter_number,
                total,
                segment_count,
                path.display(),
                error
            );
            emit_progress(
                &app,
                &book_id,
                chapter_number,
                total,
                &chapter.title,
                ((completed_segments * 90) / total_segments) as u32,
                &format!("Échec assemblage du chapitre {chapter_number} : {error}"),
                None,
                None,
            );
            return Err(error);
        }
        audio_chapters.push(AudioChapter {
            index: chapter_number,
            title: chapter.title.clone(),
            path: path.to_string_lossy().to_string(),
        });
        emit_progress(
            &app,
            &book_id,
            chapter_number,
            total,
            &chapter.title,
            ((completed_segments * 90) / total_segments) as u32,
            &format!("Chapitre {chapter_number} terminé : {}", chapter.title),
            None,
            None,
        );
    }
    let generated_at = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis() as u64;
    let mut updated = read_config(&app)?;
    let updated_book = updated
        .books
        .iter_mut()
        .find(|book| book.id == book_id)
        .ok_or("L'ouvrage a été retiré pendant la génération audio.")?;
    let previous_chapters = updated_book
        .audio
        .as_ref()
        .map(|edition| edition.chapters.as_slice())
        .unwrap_or_default();
    updated_book.audio = Some(AudioEdition {
        engine: endpoint,
        voice_id: voice.id.clone(),
        voice_name: voice.name.clone(),
        generated_at,
        chapters: merge_audio_chapters(previous_chapters, audio_chapters),
    });
    write_config(&app, &updated)?;
    output_directory.commit();
    let completed_index = chapter_index;
    let completed_title = chapters[chapter_index as usize - 1].title.as_str();
    let completed_status = format!("Piste du chapitre {chapter_index} mise à jour");
    emit_progress(
        &app,
        &book_id,
        completed_index,
        total,
        completed_title,
        100,
        &completed_status,
        None,
        None,
    );
    Ok(updated)
}

#[cfg(test)]
mod tests {
    use super::{
        chunk_narration, estimate_chapter_metadata, extract_docx, extract_epub, merge_audio_chapters,
        selected_chapter_indices, validate_local_endpoint, AudioGenerationProgress,
        AudioConfig, AudioEngineMode, AudioInitProgress, AudioOutputDirectory,
        AudioTempDirectory, EngineInitStatus, SynthesisRequest,
        AUDIO_INIT_TIMEOUT, MAX_TTS_SEGMENT_CHARS, SIDECAR_STARTUP_TIMEOUT,
    };
    use crate::library::AudioChapter;
    use std::io::Write;
    use std::time::Duration;

    #[test]
    fn only_accepts_loopback_tts_endpoints() {
        assert_eq!(
            validate_local_endpoint("http://127.0.0.1:8020").unwrap(),
            "http://127.0.0.1:8020"
        );
        assert!(validate_local_endpoint("http://localhost:8020").is_ok());
        assert!(validate_local_endpoint("http://[::1]:8020").is_ok());
        assert!(validate_local_endpoint("https://example.com").is_err());
        assert!(validate_local_endpoint("http://127.0.0.1.evil.test:8020").is_err());
    }

    #[test]
    fn selects_only_one_chapter_and_rejects_invalid_indices() {
        assert_eq!(selected_chapter_indices(3, 2).unwrap(), vec![1]);
        assert!(selected_chapter_indices(3, 0).is_err());
        assert!(selected_chapter_indices(3, 4).is_err());
    }

    #[test]
    fn serializes_chapter_and_segment_context_in_camel_case() {
        let request = SynthesisRequest {
            text: "Texte court.",
            voice_id: "fr-test",
            language: "fr",
            output_format: "mp3",
            chapter_index: 2,
            chapter_title: "Chapitre second",
            segment_index: 3,
            segment_count: 4,
        };
        let request = serde_json::to_value(request).unwrap();
        assert_eq!(request["chapterIndex"], 2);
        assert_eq!(request["chapterTitle"], "Chapitre second");
        assert_eq!(request["segmentIndex"], 3);
        assert_eq!(request["segmentCount"], 4);

        let progress = AudioGenerationProgress {
            book_id: "book".into(),
            chapter_index: 2,
            chapter_count: 8,
            chapter_title: "Chapitre second".into(),
            progress: 45,
            status: "Segment 3/4".into(),
            segment_index: Some(3),
            segment_count: Some(4),
        };
        let progress = serde_json::to_value(progress).unwrap();
        assert_eq!(progress["segmentIndex"], 3);
        assert_eq!(progress["segmentCount"], 4);
    }

    #[test]
    fn serializes_audio_initialization_progress_contract() -> Result<(), serde_json::Error> {
        let progress = serde_json::to_value(AudioInitProgress {
            percent: 100,
            stage: "Prêt".into(),
            is_ready: true,
            error: None,
        })?;
        assert_eq!(progress["percent"], 100);
        assert_eq!(progress["stage"], "Prêt");
        assert_eq!(progress["isReady"], true);

        let failure = serde_json::to_value(AudioInitProgress {
            percent: 0,
            stage: "Impossible d'initialiser les voix".into(),
            is_ready: false,
            error: Some("timeout".into()),
        })?;
        assert_eq!(failure["isReady"], false);
        assert_eq!(failure["error"], "timeout");
        Ok(())
    }

    #[test]
    fn model_initialization_has_a_separate_bounded_download_budget() {
        assert_eq!(SIDECAR_STARTUP_TIMEOUT, Duration::from_secs(60));
        assert_eq!(AUDIO_INIT_TIMEOUT, Duration::from_secs(900));
        assert!(AUDIO_INIT_TIMEOUT > SIDECAR_STARTUP_TIMEOUT);
    }

    #[test]
    fn deserializes_wrapper_snake_case_status_and_reports_initialization_error(
    ) -> Result<(), serde_json::Error> {
        let status: EngineInitStatus = serde_json::from_value(serde_json::json!({
            "status": "error",
            "percent": 0,
            "stage": "Échec de l'initialisation XTTS",
            "model_loaded": false,
            "error": "OSError: could not get source code"
        }))?;
        assert_eq!(status.status, "error");
        assert!(!status.model_loaded);
        assert_eq!(status.error.as_deref(), Some("OSError: could not get source code"));
        Ok(())
    }

    #[test]
    fn estimates_chapter_pages_and_duration_at_135_words_per_minute() -> Result<(), String> {
        let text = "mot ".repeat(270);
        let (words, pages, duration_seconds) = estimate_chapter_metadata(&text)?;
        assert_eq!(words, 270);
        assert_eq!(pages, 2);
        assert_eq!(duration_seconds, 120);
        Ok(())
    }

    #[test]
    fn audio_config_uses_the_persisted_snake_case_schema() -> Result<(), serde_json::Error> {
        let config = AudioConfig {
            cpml_accepted: true,
            cpml_accepted_at: Some("2026-10-18T10:45:00Z".into()),
            engine_mode: AudioEngineMode::Integrated,
        };
        let serialized = serde_json::to_value(config)?;
        assert_eq!(serialized["cpml_accepted"], true);
        assert_eq!(serialized["cpml_accepted_at"], "2026-10-18T10:45:00Z");
        assert_eq!(serialized["engine_mode"], "integrated");
        Ok(())
    }

    #[test]
    fn chunks_narration_at_punctuation_and_preserves_words_under_the_character_limit() {
        let text = "Premier récit, avec une ponctuation claire. Deuxième phrase pour le rythme !\n\nTroisième paragraphe avec des caractères français : déjà, très, étonnant. Une dernière phrase.";
        let chunks = chunk_narration(text, 48);
        assert!(chunks.len() > 3);
        assert!(chunks.iter().all(|chunk| chunk.chars().count() <= 48));
        let expected: Vec<_> = text.split_whitespace().collect();
        let joined = chunks.join(" ");
        let actual: Vec<_> = joined.split_whitespace().collect();
        assert_eq!(actual, expected);
        assert!(chunks
            .iter()
            .any(|chunk| chunk.ends_with('.') || chunk.ends_with('!')));
    }

    #[test]
    fn keeps_long_unpunctuated_paragraphs_below_xtts_limit() {
        let text = format!("{}", "mot ".repeat(160));
        let chunks = chunk_narration(&text, MAX_TTS_SEGMENT_CHARS);
        assert!(chunks.len() > 1);
        assert!(chunks
            .iter()
            .all(|chunk| chunk.chars().count() <= MAX_TTS_SEGMENT_CHARS));
        assert_eq!(
            chunks.join(" ").split_whitespace().count(),
            text.split_whitespace().count()
        );
    }

    #[test]
    fn replaces_only_the_generated_chapter_and_keeps_other_audio_tracks() {
        let existing = vec![
            AudioChapter {
                index: 1,
                title: "Chapitre premier".into(),
                path: "old-1.mp3".into(),
            },
            AudioChapter {
                index: 2,
                title: "Chapitre second".into(),
                path: "old-2.mp3".into(),
            },
        ];
        let merged = merge_audio_chapters(
            &existing,
            vec![AudioChapter {
                index: 2,
                title: "Chapitre second".into(),
                path: "new-2.mp3".into(),
            }],
        );
        assert_eq!(merged.len(), 2);
        assert_eq!(merged[0].path, "old-1.mp3");
        assert_eq!(merged[1].path, "new-2.mp3");
    }

    #[test]
    fn removes_uncommitted_audio_directory_when_generation_is_dropped() {
        let root = std::env::temp_dir().join(format!(
            "aldus-audio-output-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let output = AudioOutputDirectory::create(root.clone()).unwrap();
        std::fs::write(output.path().join("partial.mp3"), b"partial").unwrap();
        drop(output);
        assert!(!root.exists());
    }

    #[test]
    fn always_removes_local_audio_fragments_after_generation(
    ) -> Result<(), Box<dyn std::error::Error>> {
        let root = std::env::temp_dir().join(format!(
            "aldus-audio-fragments-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                ?
                .as_nanos()
        ));
        let temporary = AudioTempDirectory::create(root.clone())
            .map_err(std::io::Error::other)?;
        std::fs::write(temporary.path().join("001-segment-0001.mp3"), b"partial")?;
        drop(temporary);
        assert!(!root.exists());
        Ok(())
    }

    #[test]
    fn only_exposes_voices_explicitly_identified_as_french() {
        let is_french = |language: Option<&str>| {
            language.is_some_and(|language| language.to_ascii_lowercase().starts_with("fr"))
        };
        assert!(is_french(Some("fr-FR")));
        assert!(is_french(Some("FR")));
        assert!(!is_french(None));
        assert!(!is_french(Some("en-US")));
    }

    #[test]
    fn splits_docx_on_heading_one_and_removes_frontmatter_and_legal_boilerplate() {
        let root = std::env::temp_dir().join(format!(
            "aldus-audio-docx-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("book.docx");
        let mut archive = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
        for (name, text) in [
            (
                "word/styles.xml",
                r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="Titre1Custom"><w:name w:val="Titre 1"/></w:style></w:styles>"#,
            ),
            (
                "word/document.xml",
                r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Sommaire</w:t></w:r></w:p><w:p><w:r><w:t>Table des matières parasites</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Titre1Custom"/></w:pPr><w:r><w:t>Chapitre premier</w:t></w:r></w:p><w:p><w:r><w:t>Le récit commence.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section interne.</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr><w:r><w:t>Chapitre second</w:t></w:r></w:p><w:p><w:r><w:t>Tous droits réservés.</w:t></w:r></w:p></w:body></w:document>"#,
            ),
        ] {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        let chapters = extract_docx(&path).unwrap();
        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0].title, "Chapitre premier");
        assert!(chapters[0].text.contains("Section interne"));
        assert!(!chapters
            .iter()
            .any(|chapter| chapter.text.contains("Sommaire")
                || chapter.text.contains("droits réservés")));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn splits_epub_spine_and_skips_cover_title_and_legal_sections() {
        let root = std::env::temp_dir().join(format!(
            "aldus-audio-epub-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("book.epub");
        let mut archive = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
        for (name, text) in [
            (
                "META-INF/container.xml",
                r#"<container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>"#,
            ),
            (
                "OEBPS/book.opf",
                r#"<package><manifest><item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="title" href="titlepage.xhtml" media-type="application/xhtml+xml"/><item id="legal" href="copyright.xhtml" media-type="application/xhtml+xml"/><item id="one" href="chapter01.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter02.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="cover"/><itemref idref="title"/><itemref idref="legal"/><itemref idref="one"/><itemref idref="two"/></spine></package>"#,
            ),
            (
                "OEBPS/cover.xhtml",
                "<html><body><p>Image de couverture</p></body></html>",
            ),
            (
                "OEBPS/titlepage.xhtml",
                "<html><body><h1>Le grand roman</h1></body></html>",
            ),
            (
                "OEBPS/copyright.xhtml",
                "<html><body><p>Tous droits réservés.</p></body></html>",
            ),
            (
                "OEBPS/chapter01.xhtml",
                "<html><body><h1>Chapitre premier</h1><p>Le récit commence ici.</p></body></html>",
            ),
            (
                "OEBPS/chapter02.xhtml",
                "<html><body><h1>Chapitre second</h1><p>Le récit continue.</p></body></html>",
            ),
        ] {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        let chapters = extract_epub(&path).unwrap();
        assert_eq!(chapters.len(), 2);
        assert_eq!(chapters[0].title, "Chapitre premier");
        assert_eq!(chapters[0].text, "Chapitre premier\nLe récit commence ici.");
        assert!(!chapters
            .iter()
            .any(|chapter| chapter.text.contains("couverture")
                || chapter.text.contains("droits réservés")));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn skips_a_toc_navigation_document_even_when_it_is_in_the_epub_spine() {
        let root = std::env::temp_dir().join(format!(
            "aldus-audio-toc-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("book.epub");
        let mut archive = zip::ZipWriter::new(std::fs::File::create(&path).unwrap());
        for (name, text) in [
            (
                "META-INF/container.xml",
                r#"<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>"#,
            ),
            (
                "OPS/book.opf",
                r#"<package><manifest><item id="nav" href="toc.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="nav"/><itemref idref="chapter"/></spine></package>"#,
            ),
            (
                "OPS/toc.xhtml",
                r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><h1>Sommaire</h1><ol><li><a href="chapter.xhtml">Chapitre à ne pas narrer</a></li></ol></nav></body></html>"#,
            ),
            (
                "OPS/chapter.xhtml",
                "<html><body><h1>Chapitre unique</h1><p>Texte narratif.</p></body></html>",
            ),
        ] {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        let chapters = extract_epub(&path).unwrap();
        assert_eq!(chapters.len(), 1);
        assert_eq!(chapters[0].title, "Chapitre unique");
        assert!(!chapters[0].text.contains("Sommaire"));
        assert!(!chapters[0].text.contains("ne pas narrer"));
        std::fs::remove_dir_all(root).unwrap();
    }
}
