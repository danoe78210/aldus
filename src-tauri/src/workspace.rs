//! Indexation **récursive** du dossier « Mes sources » (coffres Obsidian inclus).

use std::path::Path;

use serde::{Deserialize, Serialize};
use walkdir::{DirEntry, WalkDir};

const CHAPTER_EXTENSIONS: [&str; 3] = ["md", "txt", "docx"];
const IMAGE_EXTENSIONS: [&str; 5] = ["png", "jpg", "jpeg", "webp", "tiff"];
const IGNORED_DIRECTORIES: [&str; 3] = ["node_modules", "target", "dist"];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFile {
    pub name: String,
    /// Chemin relatif à la racine, toujours séparé par `/`.
    pub relative_path: String,
    pub absolute_path: String,
    /// `"chapter"` ou `"image"`.
    pub file_type: String,
    pub size_bytes: u64,
}

/// Dossiers et fichiers cachés (`.git`, `.obsidian`, `.trash`, `.aldus`…) et
/// dossiers de build ignorés. La racine elle-même n'est jamais filtrée.
fn is_ignored(entry: &DirEntry) -> bool {
    if entry.depth() == 0 {
        return false;
    }
    let name = entry.file_name().to_string_lossy();
    name.starts_with('.')
        || (entry.file_type().is_dir() && IGNORED_DIRECTORIES.contains(&name.as_ref()))
}

fn file_type_of(path: &Path) -> Option<&'static str> {
    let extension = path.extension()?.to_str()?.to_ascii_lowercase();
    if CHAPTER_EXTENSIONS.contains(&extension.as_str()) {
        Some("chapter")
    } else if IMAGE_EXTENSIONS.contains(&extension.as_str()) {
        Some("image")
    } else {
        None
    }
}

/// Parcourt `root` récursivement (liens symboliques jamais suivis) et renvoie
/// les chapitres et images trouvés, triés par chemin relatif.
pub fn scan_workspace(root: &Path) -> Result<Vec<ScannedFile>, String> {
    if !root.is_dir() {
        return Err(format!("Dossier introuvable : {}", root.display()));
    }
    let mut files = Vec::new();
    let walker = WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| !is_ignored(entry));
    for entry in walker {
        let entry = match entry {
            Ok(entry) => entry,
            Err(error) => {
                log::warn!(
                    "Entrée ignorée lors du scan de {} : {error}",
                    root.display()
                );
                continue;
            }
        };
        if !entry.file_type().is_file() {
            continue;
        }
        let path = entry.path();
        let Some(file_type) = file_type_of(path) else {
            continue;
        };
        let Ok(relative) = path.strip_prefix(root) else {
            continue;
        };
        let size_bytes = match entry.metadata() {
            Ok(metadata) => metadata.len(),
            Err(error) => {
                log::warn!("Taille illisible pour {} : {error}", path.display());
                0
            }
        };
        files.push(ScannedFile {
            name: entry.file_name().to_string_lossy().into_owned(),
            relative_path: relative
                .components()
                .map(|component| component.as_os_str().to_string_lossy())
                .collect::<Vec<_>>()
                .join("/"),
            absolute_path: path.to_string_lossy().into_owned(),
            file_type: file_type.to_string(),
            size_bytes,
        });
    }
    files.sort_by_key(|file| file.relative_path.to_lowercase());
    Ok(files)
}

/// Exécute le scan hors du thread principal pour ne jamais figer l'interface.
pub async fn scan_workspace_async(root: std::path::PathBuf) -> Result<Vec<ScannedFile>, String> {
    let result = tauri::async_runtime::spawn_blocking(move || scan_workspace(&root))
        .await
        .map_err(|error| format!("Scan du dossier interrompu : {error}"))
        .and_then(|result| result);
    if let Err(error) = &result {
        log::error!("Scan du dossier des sources impossible : {error}");
    }
    result
}

/// Liste récursivement les chapitres et images d'un dossier.
#[tauri::command]
pub async fn scan_workspace_files(path: String) -> Result<Vec<ScannedFile>, String> {
    let files = scan_workspace_async(std::path::PathBuf::from(path)).await?;
    log::info!("{} fichier(s) source indexé(s)", files.len());
    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::scan_workspace;
    use std::fs;

    #[test]
    fn scans_nested_sources_and_skips_hidden_and_build_directories() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "aldus-scan-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|error| error.to_string())?
                .as_nanos()
        ));
        let files = [
            "racine.md",
            "Chapitres/02-suite.TXT",
            "Chapitres/Acte I/03-nuit.docx",
            "Images/Planches/gravure.JPEG",
            "Images/scan.tiff",
            "Chapitres/brouillon.md.tmp",
            ".obsidian/workspace.md",
            ".trash/ancien.md",
            ".git/info.md",
            "node_modules/pkg/readme.md",
            "target/doc.md",
            "dist/index.md",
            "Chapitres/.cache.md",
        ];
        for file in files {
            let path = root.join(file);
            fs::create_dir_all(path.parent().ok_or("parent manquant")?)
                .map_err(|error| error.to_string())?;
            fs::write(&path, "abc").map_err(|error| error.to_string())?;
        }

        let scanned = scan_workspace(&root);
        let _ = fs::remove_dir_all(&root);
        let scanned = scanned?;

        let summary: Vec<(&str, &str)> = scanned
            .iter()
            .map(|file| (file.relative_path.as_str(), file.file_type.as_str()))
            .collect();
        assert_eq!(
            summary,
            [
                ("Chapitres/02-suite.TXT", "chapter"),
                ("Chapitres/Acte I/03-nuit.docx", "chapter"),
                ("Images/Planches/gravure.JPEG", "image"),
                ("Images/scan.tiff", "image"),
                ("racine.md", "chapter"),
            ]
        );
        let nested = &scanned[1];
        assert_eq!(nested.name, "03-nuit.docx");
        assert_eq!(nested.size_bytes, 3);
        assert!(nested.absolute_path.ends_with("03-nuit.docx"));
        Ok(())
    }

    #[test]
    fn missing_root_is_an_error() {
        assert!(scan_workspace(std::path::Path::new("Z:/aldus/absent")).is_err());
    }
}
