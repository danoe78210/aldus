use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::Manager;

mod deletion;
mod audio;
mod metadata;
pub use audio::AudioEngine;

pub type ShelfId = String;

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Shelf {
    pub id: ShelfId,
    pub label: String,
    pub is_custom: bool,
    pub is_visible: bool,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Book {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tome: Option<String>,
    pub shelf_id: ShelfId,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_hex: Option<String>,
    #[serde(default)]
    pub files: Vec<LibraryFile>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cover_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_directory: Option<String>,
    #[serde(default)]
    pub page_count: Option<u32>,
    #[serde(default, deserialize_with = "deserialize_chapter_count")]
    pub chapter_count: u32,
    #[serde(default)]
    pub chapter_count_available: bool,
    #[serde(default)]
    pub last_modified: Option<u64>,
    #[serde(default)]
    pub file_statistics: BTreeMap<String, FileStatistics>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub audio: Option<AudioEdition>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioEdition {
    pub engine: String,
    pub voice_id: String,
    pub voice_name: String,
    pub generated_at: u64,
    pub chapters: Vec<AudioChapter>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioChapter {
    pub index: u32,
    pub title: String,
    pub path: String,
}

#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileStatistics {
    pub page_count: Option<u32>,
    pub chapter_count: Option<u32>,
    pub word_count: Option<u32>,
    pub metadata_modified: Option<String>,
    pub last_modified: Option<u64>,
    pub file_size: Option<u64>,
}

fn deserialize_chapter_count<'de, Deserializer: serde::Deserializer<'de>>(
    deserializer: Deserializer,
) -> Result<u32, Deserializer::Error> {
    Ok(Option::<u32>::deserialize(deserializer)?.unwrap_or_default())
}

impl Book {
    fn primary_file(&self) -> Option<&LibraryFile> {
        ["epub", "pdf", "docx"].iter().find_map(|format| {
            self.files.iter().find(|file| {
                file.format == *format
                    && Path::new(&file.path).is_file()
                    && Path::new(&file.path)
                        .extension()
                        .and_then(|part| part.to_str())
                        .is_some_and(|extension| extension.eq_ignore_ascii_case(format))
            })
        })
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryFile {
    pub path: String,
    pub format: String,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedBook {
    pub title: String,
    pub files: Vec<LibraryFile>,
    pub cover_path: Option<String>,
    pub existing_book_id: Option<String>,
}

fn path_key(path: &Path) -> String {
    let value = path.to_string_lossy().to_string();
    if cfg!(windows) {
        value.to_lowercase()
    } else {
        value
    }
}

fn display_file_title(stem: &str) -> String {
    stem.replace('_', " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn file_identity(stem: &str) -> String {
    display_file_title(stem).to_lowercase()
}

fn base_names(book: &Book) -> BTreeSet<String> {
    book.files
        .iter()
        .filter_map(|file| {
            Path::new(&file.path)
                .file_stem()?
                .to_str()
                .map(file_identity)
        })
        .collect()
}

fn scan_directory(directory: &Path, config: &LibraryConfig) -> Result<Vec<ScannedBook>, String> {
    let root = directory
        .canonicalize()
        .map_err(|e| format!("Dossier d'export inaccessible : {e}"))?;
    let mut paths: Vec<PathBuf> = std::fs::read_dir(&root)
        .map_err(|e| format!("Lecture du dossier d'export impossible : {e}"))?
        .map(|entry| entry.map(|entry| entry.path()))
        .collect::<Result<_, _>>()
        .map_err(|e| format!("Lecture d'un fichier d'export impossible : {e}"))?;
    paths.sort();
    let known: Vec<String> = config
        .books
        .iter()
        .flat_map(|book| &book.files)
        .map(|file| {
            path_key(
                &Path::new(&file.path)
                    .canonicalize()
                    .unwrap_or_else(|_| PathBuf::from(&file.path)),
            )
        })
        .collect();
    let mut groups: BTreeMap<String, ScannedBook> = BTreeMap::new();
    let mut images = BTreeMap::new();
    for path in paths {
        if !path.is_file() {
            continue;
        }
        let canonical = path
            .canonicalize()
            .map_err(|e| format!("Fichier inaccessible : {e}"))?;
        if canonical.parent() != Some(root.as_path()) {
            continue;
        }
        let extension = path
            .extension()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_lowercase();
        let stem = path
            .file_stem()
            .and_then(|part| part.to_str())
            .unwrap_or("");
        let key = file_identity(stem);
        if ["png", "jpg", "jpeg"].contains(&extension.as_str()) {
            images
                .entry(file_identity(stem))
                .or_insert_with(|| canonical.to_string_lossy().to_string());
        } else if ["epub", "pdf", "docx"].contains(&extension.as_str())
            && !known.contains(&path_key(&canonical))
        {
            groups
                .entry(key)
                .or_insert_with(|| ScannedBook {
                    title: display_file_title(stem),
                    files: Vec::new(),
                    cover_path: None,
                    existing_book_id: None,
                })
                .files
                .push(LibraryFile {
                    path: canonical.to_string_lossy().to_string(),
                    format: extension,
                });
        }
    }
    for (key, book) in &mut groups {
        if let Some(existing) = config
            .books
            .iter()
            .find(|existing| base_names(existing).contains(key))
        {
            book.existing_book_id = Some(existing.id.clone());
            book.title = existing.title.clone();
        }
        book.cover_path = [
            key.clone(),
            format!("{key} cover"),
            format!("{key}-cover"),
            format!("{key} couverture"),
            format!("{key}-couverture"),
        ]
        .iter()
        .find_map(|name| images.get(name).cloned());
    }
    Ok(groups.into_values().collect())
}

#[tauri::command]
pub async fn scan_export_folder(
    app: tauri::AppHandle,
    export_directory: String,
) -> Result<Vec<ScannedBook>, String> {
    if export_directory.trim().is_empty() {
        return Err("Choisissez un dossier d'export dans le banc Export.".into());
    }
    scan_directory(Path::new(&export_directory), &read_config(&app)?)
}

#[tauri::command]
pub async fn open_library_resource(
    app: tauri::AppHandle,
    book_id: String,
    resource: String,
) -> Result<(), String> {
    let config = read_config(&app)?;
    let book = config
        .books
        .iter()
        .find(|book| book.id == book_id)
        .ok_or("Livre introuvable.")?;
    let path = if resource == "primary" {
        &book
            .primary_file()
            .ok_or("Aucun fichier de lecture EPUB, PDF ou DOCX accessible pour ce livre.")?
            .path
    } else if resource == "source" {
        book.source_directory
            .as_deref()
            .ok_or("Dossier source non renseigné.")?
    } else if resource == "export" {
        book.files
            .first()
            .and_then(|file| Path::new(&file.path).parent())
            .and_then(Path::to_str)
            .ok_or("Dossier d'export non renseigné.")?
    } else if book.audio.as_ref().is_some_and(|audio| audio.chapters.iter().any(|chapter| chapter.path == resource)) {
        &book.audio.as_ref().unwrap().chapters.iter().find(|chapter| chapter.path == resource).unwrap().path
    } else {
        &book
            .files
            .iter()
            .find(|file| {
                file.path == resource && ["epub", "pdf", "docx"].contains(&file.format.as_str())
            })
            .ok_or("Fichier non référencé.")?
            .path
    };
    let path = Path::new(path)
        .canonicalize()
        .map_err(|e| format!("Ressource introuvable : {e}"))?;
    if resource == "source" || resource == "export" {
        if !path.is_dir() {
            return Err("Le dossier référencé est introuvable.".into());
        }
    } else {
        let extension = path
            .extension()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !path.is_file() || !["epub", "pdf", "docx", "mp3", "m4b"].contains(&extension.as_str()) {
            return Err(
                "Seuls les fichiers EPUB, PDF et DOCX référencés peuvent être ouverts.".into(),
            );
        }
    }
    #[cfg(target_os = "windows")]
    let result = std::process::Command::new("explorer").arg(&path).spawn();
    #[cfg(target_os = "macos")]
    let result = std::process::Command::new("open").arg(&path).spawn();
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    let result = std::process::Command::new("xdg-open").arg(&path).spawn();
    result
        .map(|_| ())
        .map_err(|e| format!("Ouverture impossible : {e}"))
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryConfig {
    pub shelves: Vec<Shelf>,
    pub books: Vec<Book>,
}

impl Default for LibraryConfig {
    fn default() -> Self {
        Self {
            shelves: vec![
                Shelf {
                    id: "in_progress".into(),
                    label: "En cours".into(),
                    is_custom: false,
                    is_visible: true,
                },
                Shelf {
                    id: "completed".into(),
                    label: "Terminés".into(),
                    is_custom: false,
                    is_visible: true,
                },
            ],
            books: Vec::new(),
        }
    }
}

impl LibraryConfig {
    fn merge_book(&mut self, incoming: Book) -> usize {
        let names = base_names(&incoming);
        if let Some(index) = self
            .books
            .iter()
            .position(|book| book.id == incoming.id || !base_names(book).is_disjoint(&names))
        {
            let existing = &mut self.books[index];
            for file in incoming.files {
                if !existing.files.iter().any(|known| {
                    path_key(Path::new(&known.path)) == path_key(Path::new(&file.path))
                }) {
                    existing.files.push(file);
                }
            }
            for (path, statistics) in incoming.file_statistics {
                existing.file_statistics.entry(path).or_insert(statistics);
            }
            if existing.cover_path.is_none() {
                existing.cover_path = incoming.cover_path;
            }
            if existing.source_directory.is_none() {
                existing.source_directory = incoming.source_directory;
            }
            if existing.tome.is_none() {
                existing.tome = incoming.tome;
            }
            if existing.audio.is_none() {
                existing.audio = incoming.audio;
            }
            index
        } else {
            self.books.push(incoming);
            self.books.len() - 1
        }
    }

    fn normalize(&mut self) {
        let mut shelves = LibraryConfig::default().shelves;
        for mut shelf in self.shelves.drain(..) {
            if ["in_progress", "completed", "archived"].contains(&shelf.id.as_str()) {
                continue;
            }
            if shelf.is_visible || self.books.iter().any(|book| book.shelf_id == shelf.id) {
                shelf.is_custom = true;
                shelf.is_visible = true;
                shelves.push(shelf);
            }
        }
        self.shelves = shelves;
        for book in &mut self.books {
            if book.shelf_id == "archived" {
                book.shelf_id = "completed".into();
            } else if !self.shelves.iter().any(|shelf| shelf.id == book.shelf_id) {
                book.shelf_id = "in_progress".into();
            }
        }
        for book in std::mem::take(&mut self.books) {
            self.merge_book(book);
        }
    }

    fn create_shelf(&mut self, id: String, label: String) -> Result<(), String> {
        let label = label.trim();
        if id.trim().is_empty()
            || id == "archived"
            || self.shelves.iter().any(|shelf| shelf.id == id)
        {
            return Err("Identifiant de rayon invalide ou déjà utilisé.".into());
        }
        if label.is_empty() {
            return Err("Le nom du rayon ne peut pas être vide.".into());
        }
        self.shelves.push(Shelf {
            id,
            label: label.into(),
            is_custom: true,
            is_visible: true,
        });
        Ok(())
    }

    fn delete_shelf(&mut self, id: &str) -> Result<(), String> {
        if !self
            .shelves
            .iter()
            .any(|shelf| shelf.id == id && shelf.is_custom)
        {
            return Err("Rayon personnalisé inconnu.".into());
        }
        self.shelves.retain(|shelf| shelf.id != id);
        for book in &mut self.books {
            if book.shelf_id == id {
                book.shelf_id = "in_progress".into();
            }
        }
        Ok(())
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Dossier de données utilisateur introuvable : {e}"))?;
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Création du dossier de données impossible : {e}"))?;
    Ok(dir.join("library.json"))
}

fn read_config(app: &tauri::AppHandle) -> Result<LibraryConfig, String> {
    let path = config_path(app)?;
    if !path.is_file() {
        return Ok(LibraryConfig::default());
    }
    let contents = std::fs::read_to_string(&path)
        .map_err(|e| format!("Lecture de la bibliothèque impossible : {e}"))?;
    let mut config: LibraryConfig = serde_json::from_str(&contents)
        .map_err(|e| format!("Configuration de bibliothèque invalide : {e}"))?;
    let previous = serde_json::to_value(&config).map_err(|e| e.to_string())?;
    config.normalize();
    for book in &mut config.books {
        metadata::refresh(book);
    }
    if serde_json::to_value(&config).map_err(|e| e.to_string())? != previous {
        write_config(app, &config)?;
    }
    Ok(config)
}

fn write_config(app: &tauri::AppHandle, config: &LibraryConfig) -> Result<(), String> {
    let contents = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Sérialisation de la bibliothèque impossible : {e}"))?;
    let path = config_path(app)?;
    let temporary = path.with_extension("json.tmp");
    if let Err(error) = std::fs::write(&temporary, contents) {
        if let Err(cleanup_error) = std::fs::remove_file(&temporary) {
            if cleanup_error.kind() != std::io::ErrorKind::NotFound {
                log::warn!("Library config temp cleanup failed: {cleanup_error}");
            }
        }
        return Err(format!("Écriture temporaire de la bibliothèque impossible : {error}"));
    }
    if let Err(error) = std::fs::rename(&temporary, &path) {
        if let Err(cleanup_error) = std::fs::remove_file(&temporary) {
            if cleanup_error.kind() != std::io::ErrorKind::NotFound {
                log::warn!("Library config temp cleanup failed: {cleanup_error}");
            }
        }
        return Err(format!("Enregistrement atomique de la bibliothèque impossible : {error}"));
    }
    Ok(())
}

#[tauri::command]
pub async fn get_library_config(app: tauri::AppHandle) -> Result<LibraryConfig, String> {
    read_config(&app)
}

#[tauri::command]
pub async fn delete_book(
    app: tauri::AppHandle,
    book_id: String,
    export_directory: String,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    if export_directory.trim().is_empty() {
        return Err("Choisissez le dossier d'export avant de supprimer l'ouvrage.".into());
    }
    deletion::delete(
        &mut config,
        &book_id,
        Path::new(&export_directory),
        |next| write_config(&app, next),
    )?;
    Ok(config)
}

#[tauri::command]
pub async fn delete_audio_track(
    app: tauri::AppHandle,
    book_id: String,
    chapter_index: u32,
    export_directory: String,
) -> Result<LibraryConfig, String> {
    if export_directory.trim().is_empty() {
        return Err("Choisissez le dossier d'export avant de supprimer une piste audio.".into());
    }
    let export_root = Path::new(&export_directory)
        .canonicalize()
        .map_err(|error| format!("Dossier d'export inaccessible : {error}"))?;
    let audio_root = export_root
        .join("Audio")
        .canonicalize()
        .map_err(|error| format!("Dossier des pistes audio inaccessible : {error}"))?;
    let mut config = read_config(&app)?;
    let book_index = config
        .books
        .iter()
        .position(|book| book.id == book_id)
        .ok_or("Ouvrage introuvable dans la bibliothèque.")?;
    let chapter = config.books[book_index]
        .audio
        .as_ref()
        .and_then(|audio| audio.chapters.iter().find(|chapter| chapter.index == chapter_index))
        .ok_or("Piste audio introuvable pour cet ouvrage.")?;
    let requested_path = PathBuf::from(&chapter.path);
    if !requested_path.is_absolute()
        || !requested_path
            .extension()
            .and_then(|extension| extension.to_str())
            .is_some_and(|extension| extension.eq_ignore_ascii_case("mp3"))
    {
        return Err("Suppression refusée : la piste n'est pas un MP3 absolu.".into());
    }
    let filename = requested_path
        .file_name()
        .ok_or("Nom de fichier audio invalide.")?;
    let parent = requested_path
        .parent()
        .ok_or("Dossier parent de la piste audio invalide.")?
        .canonicalize()
        .map_err(|error| format!("Dossier parent de la piste inaccessible : {error}"))?;
    if !parent.starts_with(&audio_root) {
        return Err("Suppression refusée : la piste est hors du dossier Audio configuré.".into());
    }
    let track_path = parent.join(filename);
    let track_exists = match std::fs::symlink_metadata(&track_path) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => true,
        Ok(_) => return Err("Suppression refusée : la piste n'est pas un fichier régulier.".into()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => false,
        Err(error) => return Err(format!("Accès à la piste audio impossible : {error}")),
    };

    let track_key = path_key(&track_path);
    let mut shared = false;
    for other in config.books.iter().filter(|book| book.id != book_id) {
        for reference in other
            .audio
            .iter()
            .flat_map(|audio| audio.chapters.iter().map(|chapter| chapter.path.as_str()))
        {
            let referenced = Path::new(reference);
            if path_key(referenced) == track_key {
                shared = true;
                break;
            }
            match referenced.canonicalize() {
                Ok(canonical) if canonical == track_path => {
                    shared = true;
                    break;
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
                Err(error) => {
                    return Err(format!("Vérification des pistes partagées impossible : {error}"));
                }
            }
        }
        if shared {
            break;
        }
    }

    let staged_path = if track_exists && !shared {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| format!("Horloge système invalide : {error}"))?
            .as_nanos();
        let temporary = parent.join(format!(
            ".{}.delete-{}-{nonce}",
            filename.to_string_lossy(),
            std::process::id()
        ));
        std::fs::rename(&track_path, &temporary)
            .map_err(|error| format!("Mise en attente de la piste audio impossible : {error}"))?;
        Some(temporary)
    } else {
        None
    };

    let edition = config.books[book_index]
        .audio
        .as_mut()
        .ok_or("Édition audio introuvable.")?;
    edition.chapters.retain(|chapter| chapter.index != chapter_index);
    if edition.chapters.is_empty() {
        config.books[book_index].audio = None;
    }
    if let Err(error) = write_config(&app, &config) {
        if let Some(temporary) = &staged_path {
            if let Err(restore_error) = std::fs::rename(temporary, &track_path) {
                log::error!(
                    "Audio track rollback failed path={} error={}",
                    track_path.display(),
                    restore_error
                );
            }
        }
        return Err(error);
    }
    if let Some(temporary) = staged_path {
        std::fs::remove_file(&temporary).map_err(|error| {
            log::error!(
                "Audio track staged-file cleanup failed path={} error={}",
                temporary.display(),
                error
            );
            format!("Piste retirée du registre, mais suppression du fichier temporaire impossible : {error}")
        })?;
    } else if shared {
        log::info!(
            "Audio track reference removed from book_id={} but shared file retained path={}",
            book_id,
            track_path.display()
        );
    }
    Ok(config)
}

async fn initialize_audio_engine(
    app: &tauri::AppHandle,
) -> Result<Vec<audio::AudioVoice>, String> {
    audio::emit_audio_init_progress(&app, 10, "Spawn du process aldus-audio-server.exe");
    let initialization = async {
        audio::ensure_bundled_engine(app).await?;
        if !cfg!(all(windows, not(debug_assertions))) {
            audio::emit_audio_init_progress(app, 35, "Runtime vocal local disponible");
            audio::emit_audio_init_progress(app, 65, "Vérification du moteur vocal local");
            audio::emit_audio_init_progress(app, 85, "Indexation des profils vocaux");
        }
        audio::emit_audio_init_progress(app, 95, "Requête /voices et analyse des profils");
        let voices = audio::list_voices().await?;
        if voices.is_empty() {
            return Err(String::from(
                "Aucun profil vocal français n'est disponible dans le moteur local.",
            ));
        }
        Ok(voices)
    };

    match tokio::time::timeout(Duration::from_secs(60), initialization).await {
        Ok(Ok(voices)) => {
            audio::emit_audio_init_progress(app, 100, "Prêt");
            Ok(voices)
        }
        Ok(Err(error)) => {
            log::error!("audio voice initialization failed: {error}");
            audio::emit_audio_init_failure(app, &error);
            Err(error)
        }
        Err(_) => {
            let error = "Délai d'initialisation du Studio Audio dépassé après 60 secondes.";
            audio::stop_bundled_engine(app);
            log::error!("audio voice initialization timeout: {error}");
            audio::emit_audio_init_failure(app, error);
            Err(error.into())
        }
    }
}

#[tauri::command]
pub async fn get_audio_consent(app: tauri::AppHandle) -> Result<audio::AudioConfig, String> {
    audio::get_audio_consent(&app).inspect_err(|error| {
        log::error!("read audio consent config failed: {error}");
    })
}

#[tauri::command]
pub async fn save_audio_consent(
    app: tauri::AppHandle,
    accepted: bool,
) -> Result<audio::AudioConfig, String> {
    audio::save_audio_consent(&app, accepted).inspect_err(|error| {
        log::error!("save audio consent config failed: {error}");
    })
}

#[tauri::command]
pub async fn start_audio_engine(
    app: tauri::AppHandle,
) -> Result<Vec<audio::AudioVoice>, String> {
    initialize_audio_engine(&app).await
}

#[tauri::command]
pub async fn list_audio_voices(
    app: tauri::AppHandle,
) -> Result<Vec<audio::AudioVoice>, String> {
    initialize_audio_engine(&app).await
}

#[tauri::command]
pub async fn list_book_audio_chapters(
    app: tauri::AppHandle,
    book_id: String,
) -> Result<Vec<audio::AudioChapterChoice>, String> {
    audio::list_book_chapters(&app, &book_id)
}

#[tauri::command]
pub async fn generate_book_audio(
    app: tauri::AppHandle,
    book_id: String,
    export_directory: String,
    voice_id: String,
    chapter_index: u32,
) -> Result<LibraryConfig, String> {
    audio::generate_book_audio(app, book_id, export_directory, voice_id, chapter_index).await
}

#[tauri::command]
pub async fn create_custom_shelf(
    app: tauri::AppHandle,
    id: String,
    label: String,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    config.create_shelf(id, label)?;
    write_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub async fn delete_custom_shelf(
    app: tauri::AppHandle,
    id: String,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    config.delete_shelf(&id)?;
    write_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub async fn update_custom_shelf(
    app: tauri::AppHandle,
    id: String,
    label: String,
    is_visible: bool,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    let shelf = config
        .shelves
        .iter_mut()
        .find(|shelf| shelf.is_custom && shelf.id == id)
        .ok_or_else(|| "Étagère personnalisée inconnue.".to_string())?;
    let label = label.trim();
    if label.is_empty() {
        return Err("Le nom de l'étagère ne peut pas être vide.".into());
    }
    shelf.label = label.to_string();
    shelf.is_visible = is_visible;
    write_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub async fn move_book(
    app: tauri::AppHandle,
    book_id: String,
    new_shelf_id: ShelfId,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    if !config
        .shelves
        .iter()
        .any(|shelf| shelf.id == new_shelf_id && shelf.is_visible)
    {
        return Err("Étagère de destination introuvable ou masquée.".into());
    }
    let book = config
        .books
        .iter_mut()
        .find(|book| book.id == book_id)
        .ok_or_else(|| "Livre introuvable dans la bibliothèque.".to_string())?;
    book.shelf_id = new_shelf_id;
    write_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub async fn add_library_book(
    app: tauri::AppHandle,
    mut book: Book,
) -> Result<LibraryConfig, String> {
    let mut config = read_config(&app)?;
    if book.title.trim().is_empty() {
        return Err("Le titre du livre ne peut pas être vide.".into());
    }
    if !config
        .shelves
        .iter()
        .any(|shelf| shelf.id == book.shelf_id && shelf.is_visible)
    {
        return Err("Étagère de destination introuvable ou masquée.".into());
    }
    for file in &mut book.files {
        let path = Path::new(&file.path)
            .canonicalize()
            .map_err(|e| format!("Fichier d'import introuvable : {e}"))?;
        let extension = path
            .extension()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !path.is_file() || !["epub", "pdf", "docx"].contains(&extension.as_str()) {
            return Err("Seuls les fichiers EPUB, PDF et DOCX peuvent être importés.".into());
        }
        file.path = path.to_string_lossy().to_string();
        file.format = extension;
    }
    if let Some(cover) = &book.cover_path {
        let path = Path::new(cover);
        let extension = path
            .extension()
            .and_then(|part| part.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !path.is_file() || !["png", "jpg", "jpeg"].contains(&extension.as_str()) {
            book.cover_path = None;
        }
    }
    book.title = book.title.trim().to_string();
    let index = config.merge_book(book);
    metadata::refresh(&mut config.books[index]);
    write_config(&app, &config)?;
    Ok(config)
}

#[cfg(test)]
mod tests {
    use super::{scan_directory, Book, LibraryConfig, LibraryFile, Shelf};

    #[test]
    fn groups_accented_names_with_spaces_and_underscores_and_keeps_distinct_volumes() {
        let root = std::env::temp_dir().join(format!(
            "aldus-scan-names-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        for name in [
            "Les_Schattenjägers.docx",
            "Les Schattenjägers.epub",
            "Les_Schattenjägers.PDF",
            "Les_Schattenjägers_cover.jpg",
            "Les_Schattenjägers_2.pdf",
        ] {
            std::fs::write(root.join(name), "fixture").unwrap();
        }
        let books = scan_directory(&root, &LibraryConfig::default()).unwrap();
        assert_eq!(books.len(), 2);
        let book = books
            .iter()
            .find(|book| book.title == "Les Schattenjägers")
            .unwrap();
        assert_eq!(book.files.len(), 3);
        assert!(book
            .files
            .iter()
            .all(|file| std::path::Path::new(&file.path).is_absolute()));
        assert!(book.cover_path.is_some());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn merges_new_formats_and_migrates_duplicate_books_without_changing_the_original_identity() {
        let mut config = LibraryConfig::default();
        let original = Book {
            id: "original".into(),
            title: "Titre corrigé".into(),
            shelf_id: "completed".into(),
            files: vec![LibraryFile {
                path: "exports/Nunael.epub".into(),
                format: "epub".into(),
            }],
            ..Book::default()
        };
        config.merge_book(original);
        let incoming = Book {
            id: "new".into(),
            title: "Nunael".into(),
            shelf_id: "in_progress".into(),
            files: vec![
                LibraryFile {
                    path: "exports/Nunael.pdf".into(),
                    format: "pdf".into(),
                },
                LibraryFile {
                    path: "exports/Nunael.docx".into(),
                    format: "docx".into(),
                },
            ],
            ..Book::default()
        };
        config.merge_book(incoming.clone());
        config.merge_book(incoming.clone());
        assert_eq!(config.books.len(), 1);
        assert_eq!(config.books[0].files.len(), 3);
        assert_eq!(config.books[0].id, "original");
        assert_eq!(config.books[0].title, "Titre corrigé");
        assert_eq!(config.books[0].shelf_id, "completed");
        config.books.push(incoming);
        config.normalize();
        assert_eq!(config.books.len(), 1);
        assert_eq!(config.books[0].files.len(), 3);
        let restored: LibraryConfig =
            serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(restored.books.len(), 1);
        assert_eq!(restored.books[0].files.len(), 3);
    }

    #[test]
    fn scan_groups_formats_associates_covers_and_excludes_known_files() {
        let root = std::env::temp_dir().join(format!(
            "aldus-library-scan-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        std::fs::create_dir_all(&root).unwrap();
        for name in [
            "Roman.epub",
            "Roman.PDF",
            "Roman.DOCX",
            "Roman_cover.jpg",
            "Autre.pdf",
            "notes.txt",
            "Sans_livre.png",
        ] {
            std::fs::write(root.join(name), b"fixture").unwrap();
        }
        std::fs::create_dir(root.join("Dossier.pdf")).unwrap();
        let mut config = LibraryConfig::default();
        let result = scan_directory(&root, &config).unwrap();
        assert_eq!(result.len(), 2);
        let roman = result.iter().find(|book| book.title == "Roman").unwrap();
        assert_eq!(roman.files.len(), 3);
        assert!(roman
            .cover_path
            .as_ref()
            .unwrap()
            .ends_with("Roman_cover.jpg"));
        config.books.push(Book {
            id: "roman".into(),
            title: "Roman".into(),
            shelf_id: "completed".into(),
            files: roman.files.clone(),
            ..Book::default()
        });
        let remaining = scan_directory(&root, &config).unwrap();
        assert_eq!(remaining.len(), 1);
        assert_eq!(remaining[0].title, "Autre");
        config.books[0].files = vec![LibraryFile {
            path: root
                .join("Roman.epub")
                .canonicalize()
                .unwrap()
                .to_string_lossy()
                .to_string(),
            format: "epub".into(),
        }];
        let remaining = scan_directory(&root, &config).unwrap();
        assert_eq!(
            remaining
                .iter()
                .find(|book| book.title == "Roman")
                .unwrap()
                .existing_book_id
                .as_deref(),
            Some("roman")
        );
        assert_eq!(
            remaining
                .iter()
                .find(|book| book.title == "Roman")
                .unwrap()
                .files
                .len(),
            2
        );
        std::fs::remove_dir_all(&root).unwrap();
        assert!(scan_directory(&root, &config).is_err());
    }

    #[test]
    fn legacy_books_without_file_links_still_deserialize() {
        let book: Book =
            serde_json::from_str(r#"{"id":"legacy","title":"Livre","shelfId":"in_progress"}"#)
                .unwrap();
        assert!(book.files.is_empty());
        assert!(book.cover_path.is_none());
    }

    #[test]
    fn library_json_matches_the_frontend_contract() {
        let config = LibraryConfig::default();
        let value = serde_json::to_value(config).expect("config serializes");
        assert_eq!(value["shelves"][0]["id"], "in_progress");
        assert_eq!(value["shelves"][0]["isCustom"], false);
        assert_eq!(value["shelves"][0]["isVisible"], true);

        let book = Book {
            id: "book-1".into(),
            title: "Aldus".into(),
            tome: None,
            shelf_id: "completed".into(),
            color_hex: None,
            ..Book::default()
        };
        let value = serde_json::to_value(book).expect("book serializes");
        assert_eq!(value["shelfId"], "completed");
        assert!(value.get("tome").is_none());
        assert!(value.get("colorHex").is_none());
    }

    #[test]
    fn custom_shelves_are_dynamic_and_deletion_preserves_books() {
        let mut config = LibraryConfig::default();
        assert_eq!(config.shelves.len(), 2);
        for index in 0..5 {
            config
                .create_shelf(format!("custom-{index}"), format!(" Rayon {index} "))
                .unwrap();
        }
        assert_eq!(config.shelves.len(), 7);
        assert_eq!(config.shelves[2].label, "Rayon 0");
        assert!(config
            .create_shelf("custom-0".into(), "Doublon".into())
            .is_err());
        assert!(config.create_shelf("empty".into(), " ".into()).is_err());
        config.books.push(Book {
            id: "book".into(),
            title: "Livre".into(),
            tome: None,
            shelf_id: "custom-0".into(),
            color_hex: None,
            ..Book::default()
        });
        config.delete_shelf("custom-0").unwrap();
        assert_eq!(config.books[0].shelf_id, "in_progress");
        assert!(config.delete_shelf("completed").is_err());
        let restored: LibraryConfig =
            serde_json::from_str(&serde_json::to_string(&config).unwrap()).unwrap();
        assert_eq!(restored.shelves.len(), 6);
    }

    #[test]
    fn migration_removes_archives_and_unused_custom_slots_without_losing_books() {
        let mut config = LibraryConfig::default();
        config.shelves.push(Shelf {
            id: "archived".into(),
            label: "Archives".into(),
            is_custom: false,
            is_visible: true,
        });
        config.shelves.push(Shelf {
            id: "custom_1".into(),
            label: "Romans".into(),
            is_custom: true,
            is_visible: false,
        });
        config.shelves.push(Shelf {
            id: "custom_2".into(),
            label: "Vide".into(),
            is_custom: true,
            is_visible: false,
        });
        for shelf_id in ["archived", "custom_1"] {
            config.books.push(Book {
                id: shelf_id.into(),
                title: "Livre".into(),
                tome: None,
                shelf_id: shelf_id.into(),
                color_hex: None,
                ..Book::default()
            });
        }
        config.normalize();
        assert_eq!(config.shelves.len(), 3);
        assert_eq!(config.books[0].shelf_id, "completed");
        assert_eq!(config.books[1].shelf_id, "custom_1");
        assert!(config.shelves[2].is_visible);
        let before = serde_json::to_value(&config).unwrap();
        config.normalize();
        assert_eq!(before, serde_json::to_value(&config).unwrap());
    }
}
