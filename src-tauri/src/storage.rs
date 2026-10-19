use std::io::Write;
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use chrono::{NaiveDateTime, Utc};
use serde::Serialize;

static CHAPTER_LOCK: Mutex<()> = Mutex::new(());
pub(crate) static PROJECT_LOCK: Mutex<()> = Mutex::new(());

pub(crate) fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let name = path.file_name().ok_or("Nom de fichier manquant.")?;
    let temporary = path.with_file_name(format!("{}.tmp", name.to_string_lossy()));
    let result = (|| {
        let mut file = std::fs::File::create(&temporary)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        std::fs::rename(&temporary, path)
    })();
    result.map_err(|error| {
        if let Err(cleanup) = std::fs::remove_file(&temporary) {
            if cleanup.kind() != std::io::ErrorKind::NotFound {
                log::warn!("Nettoyage impossible {} : {cleanup}", temporary.display());
            }
        }
        format!("Écriture atomique impossible {} : {error}", path.display())
    })
}

pub(crate) fn resolve_chapter(root: &Path, chapter: &str) -> Result<PathBuf, String> {
    let relative = Path::new(chapter);
    if relative.as_os_str().is_empty()
        || relative
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
        || !relative
            .extension()
            .is_some_and(|ext| ext.eq_ignore_ascii_case("md"))
    {
        return Err("Le chapitre doit être un chemin relatif Markdown du workspace.".into());
    }
    let root = root
        .canonicalize()
        .map_err(|error| format!("Workspace inaccessible : {error}"))?;
    let path = root
        .join(relative)
        .canonicalize()
        .map_err(|error| format!("Chapitre inaccessible {chapter} : {error}"))?;
    if !path.starts_with(&root) || !path.is_file() || path.starts_with(root.join(".aldus")) {
        return Err("Le chapitre doit rester dans le workspace, hors de .aldus.".into());
    }
    Ok(path)
}

fn history_directory(root: &Path) -> Result<PathBuf, String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("Workspace inaccessible : {error}"))?;
    let directory = root.join(".aldus").join("history");
    for path in [root.join(".aldus"), directory.clone()] {
        match std::fs::symlink_metadata(&path) {
            Ok(metadata) if metadata.file_type().is_symlink() => {
                return Err("L'historique ne peut pas être un lien symbolique.".into());
            }
            Ok(_) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                std::fs::create_dir(&path)
                    .map_err(|error| format!("Création de l'historique : {error}"))?;
            }
            Err(error) => return Err(format!("Accès à l'historique : {error}")),
        }
    }
    let directory = directory
        .canonicalize()
        .map_err(|error| format!("Historique inaccessible : {error}"))?;
    if !directory.starts_with(root) {
        return Err("L'historique doit rester dans le workspace.".into());
    }
    Ok(directory)
}

fn chapter_key(root: &Path, path: &Path) -> Result<String, String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("Workspace inaccessible : {error}"))?;
    let relative = path.strip_prefix(root).map_err(|error| error.to_string())?;
    let identity = relative.to_string_lossy().replace('\\', "/");
    // Stable FNV-1a keeps homonyms and sanitized path collisions distinct across releases.
    let hash = identity.bytes().fold(0xcbf29ce484222325u64, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3)
    });
    let stem: String = path
        .file_stem()
        .ok_or("Nom de chapitre manquant.")?
        .to_string_lossy()
        .chars()
        .take(40)
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' {
                c
            } else {
                '_'
            }
        })
        .collect();
    Ok(format!("{stem}-{hash:016x}"))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotEntry {
    pub filename: String,
    pub created_at: String,
    pub size_bytes: u64,
}

fn entries(directory: &Path, key: &str) -> Result<Vec<SnapshotEntry>, String> {
    let mut snapshots = Vec::new();
    let prefix = format!("{key}_");
    for entry in std::fs::read_dir(directory)
        .map_err(|error| format!("Lecture de l'historique : {error}"))?
    {
        let entry = entry.map_err(|error| format!("Lecture d'un instantané : {error}"))?;
        let filename = entry.file_name().to_string_lossy().into_owned();
        let Some(timestamp) = filename
            .strip_prefix(&prefix)
            .and_then(|s| s.strip_suffix(".bak.md"))
        else {
            continue;
        };
        let date = NaiveDateTime::parse_from_str(timestamp, "%Y%m%d_%H%M%S_%f")
            .map_err(|error| format!("Date d'instantané invalide {filename} : {error}"))?;
        let metadata = std::fs::symlink_metadata(entry.path())
            .map_err(|error| format!("Métadonnées de l'instantané : {error}"))?;
        if !metadata.is_file() || metadata.file_type().is_symlink() {
            return Err(format!("Instantané non régulier : {filename}"));
        }
        snapshots.push(SnapshotEntry {
            filename,
            created_at: date.and_utc().to_rfc3339(),
            size_bytes: metadata.len(),
        });
    }
    snapshots.sort_by(|a, b| b.filename.cmp(&a.filename));
    Ok(snapshots)
}

fn snapshot_and_write(root: &Path, path: &Path, content: &[u8]) -> Result<(), String> {
    let previous =
        std::fs::read(path).map_err(|error| format!("Lecture avant sauvegarde : {error}"))?;
    if previous == content {
        return Ok(());
    }
    let directory = history_directory(root)?;
    let key = chapter_key(root, path)?;
    let filename = format!("{key}_{}.bak.md", Utc::now().format("%Y%m%d_%H%M%S_%f"));
    atomic_write(&directory.join(filename), &previous)?;
    for snapshot in entries(&directory, &key)?.into_iter().skip(15) {
        std::fs::remove_file(directory.join(snapshot.filename))
            .map_err(|error| format!("Purge de l'historique impossible : {error}"))?;
    }
    atomic_write(path, content)
}

pub(crate) fn save_chapter(root: &Path, chapter: &str, content: &str) -> Result<(), String> {
    let _guard = CHAPTER_LOCK
        .lock()
        .map_err(|_| "Verrou des chapitres indisponible.")?;
    let path = resolve_chapter(root, chapter)?;
    snapshot_and_write(root, &path, content.as_bytes())
}

pub(crate) fn list_history(root: &Path, chapter: &str) -> Result<Vec<SnapshotEntry>, String> {
    let _guard = CHAPTER_LOCK
        .lock()
        .map_err(|_| "Verrou des chapitres indisponible.")?;
    let path = resolve_chapter(root, chapter)?;
    entries(&history_directory(root)?, &chapter_key(root, &path)?)
}

pub(crate) fn restore_snapshot(root: &Path, chapter: &str, filename: &str) -> Result<(), String> {
    let _guard = CHAPTER_LOCK
        .lock()
        .map_err(|_| "Verrou des chapitres indisponible.")?;
    let path = resolve_chapter(root, chapter)?;
    let directory = history_directory(root)?;
    let snapshots = entries(&directory, &chapter_key(root, &path)?)?;
    if !snapshots
        .iter()
        .any(|snapshot| snapshot.filename == filename)
    {
        return Err("Instantané absent ou appartenant à un autre chapitre.".into());
    }
    let content = std::fs::read(directory.join(filename))
        .map_err(|error| format!("Lecture de l'instantané : {error}"))?;
    std::str::from_utf8(&content)
        .map_err(|error| format!("Instantané Markdown illisible : {error}"))?;
    snapshot_and_write(root, &path, &content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn snapshots_preserve_original_limit_retention_and_restore_without_collision(
    ) -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "aldus-history-{}",
            Utc::now().timestamp_nanos_opt().ok_or("Date invalide")?
        ));
        std::fs::create_dir_all(root.join("nested")).map_err(|e| e.to_string())?;
        let result = (|| {
            let chapter = root.join("nested").join("chapter.md");
            std::fs::write(&chapter, "original").map_err(|e| e.to_string())?;
            save_chapter(&root, "nested/chapter.md", "première retouche")?;
            let first = list_history(&root, "nested/chapter.md")?;
            assert_eq!(
                std::fs::read_to_string(history_directory(&root)?.join(&first[0].filename))
                    .map_err(|e| e.to_string())?,
                "original"
            );
            for index in 0..20 {
                save_chapter(&root, "nested/chapter.md", &format!("version {index}"))?;
            }
            let snapshots = list_history(&root, "nested/chapter.md")?;
            assert_eq!(snapshots.len(), 15);
            assert_eq!(
                std::fs::read_to_string(history_directory(&root)?.join(&snapshots[0].filename))
                    .map_err(|e| e.to_string())?,
                "version 18"
            );
            restore_snapshot(&root, "nested/chapter.md", &snapshots[0].filename)?;
            assert_eq!(
                std::fs::read_to_string(chapter).map_err(|e| e.to_string())?,
                "version 18"
            );
            assert_eq!(list_history(&root, "nested/chapter.md")?.len(), 15);
            let restored = list_history(&root, "nested/chapter.md")?;
            assert_eq!(
                std::fs::read_to_string(history_directory(&root)?.join(&restored[0].filename))
                    .map_err(|e| e.to_string())?,
                "version 19"
            );
            std::fs::write(root.join("chapter.md"), "other").map_err(|e| e.to_string())?;
            assert!(list_history(&root, "chapter.md")?.is_empty());
            assert!(restore_snapshot(&root, "chapter.md", &snapshots[0].filename).is_err());
            assert!(restore_snapshot(&root, "nested/chapter.md", "../chapter.md").is_err());
            assert!(save_chapter(&root, "../outside.md", "bad").is_err());
            assert!(save_chapter(&root, "chapter.txt", "bad").is_err());
            Ok(())
        })();
        std::fs::remove_dir_all(root).map_err(|e| e.to_string())?;
        result
    }

    #[test]
    fn failed_snapshot_leaves_manuscript_untouched() -> Result<(), String> {
        let root =
            std::env::temp_dir().join(format!("aldus-history-failure-{}", std::process::id()));
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        std::fs::write(root.join("chapter.md"), "original").map_err(|e| e.to_string())?;
        std::fs::write(root.join(".aldus"), "not a directory").map_err(|e| e.to_string())?;
        assert!(save_chapter(&root, "chapter.md", "changed").is_err());
        assert_eq!(
            std::fs::read_to_string(root.join("chapter.md")).map_err(|e| e.to_string())?,
            "original"
        );
        std::fs::remove_dir_all(root).map_err(|e| e.to_string())?;
        Ok(())
    }
}
