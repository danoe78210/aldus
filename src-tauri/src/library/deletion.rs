use super::{base_names, file_identity, path_key, LibraryConfig};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

fn target(path: &Path) -> Result<Option<PathBuf>, String> {
    if !path.is_absolute() {
        return Err(format!("Chemin d'export non absolu : {}", path.display()));
    }
    match std::fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "Fichier inaccessible « {} » : {error}",
            path.display()
        )),
        Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => Err(format!(
            "Suppression refusée : « {} » n'est pas un fichier d'export régulier.",
            path.display()
        )),
        Ok(_) => path
            .canonicalize()
            .map(Some)
            .map_err(|error| format!("Chemin inaccessible : {error}")),
    }
}

fn targets(
    config: &LibraryConfig,
    book_id: &str,
    export_directory: &Path,
) -> Result<Vec<PathBuf>, String> {
    let book = config
        .books
        .iter()
        .find(|book| book.id == book_id)
        .ok_or("Ouvrage introuvable.")?;
    let names = base_names(book);
    if !export_directory.exists() {
        return Ok(Vec::new());
    }
    let root = export_directory
        .canonicalize()
        .map_err(|error| format!("Dossier d'export inaccessible : {error}"))?;
    if !root.is_dir() {
        return Err("Le chemin d'export n'est pas un dossier.".into());
    }
    let mut files = BTreeSet::new();
    for file in &book.files {
        let path = Path::new(&file.path);
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_lowercase();
        if !["epub", "pdf", "docx"].contains(&extension.as_str()) {
            return Err("Un fichier associé n'est pas un export pris en charge.".into());
        }
        let Some(resolved) = target(path)? else {
            continue;
        };
        if resolved.parent() != Some(root.as_path()) {
            return Err(format!("Suppression refusée : le fichier « {} » n'est pas dans le dossier d'export configuré.", path.display()));
        }
        files.insert(resolved);
    }
    for entry in std::fs::read_dir(&root)
        .map_err(|error| format!("Lecture du dossier d'export impossible : {error}"))?
    {
        let path = entry.map_err(|error| error.to_string())?.path();
        let stem = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .map(file_identity)
            .unwrap_or_default();
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_lowercase();
        let export = ["epub", "pdf", "docx"].contains(&extension.as_str()) && names.contains(&stem);
        let cover = ["png", "jpg", "jpeg"].contains(&extension.as_str())
            && names.iter().any(|name| {
                stem == *name
                    || [" cover", "-cover", " couverture", "-couverture"]
                        .iter()
                        .any(|suffix| stem == format!("{name}{suffix}"))
            });
        if export || cover {
            if let Some(path) = target(&path)? {
                if path.parent() != Some(root.as_path()) {
                    return Err("Un fichier associé sort du dossier d'export.".into());
                }
                files.insert(path);
            }
        }
    }
    if let Some(audio) = &book.audio {
        for chapter in &audio.chapters {
            let path = Path::new(&chapter.path);
            let extension = path.extension().and_then(|extension| extension.to_str()).unwrap_or("").to_lowercase();
            if !["mp3", "m4b"].contains(&extension.as_str()) {
                return Err("Une piste audio associée possède un format non pris en charge.".into());
            }
            if let Some(path) = target(path)? {
                if !path.starts_with(&root) { return Err("Suppression audio refusée hors du dossier d'export configuré.".into()); }
                files.insert(path);
            }
        }
    }
    if let Some(cover) = &book.cover_path {
        let path = Path::new(cover);
        let extension = path
            .extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or("")
            .to_lowercase();
        let in_export = path
            .parent()
            .and_then(|parent| parent.canonicalize().ok())
            .is_some_and(|parent| parent == root);
        if in_export && ["png", "jpg", "jpeg"].contains(&extension.as_str()) {
            if let Some(path) = target(path)? {
                files.insert(path);
            }
        }
    }
    files.retain(|path| {
        !config
            .books
            .iter()
            .filter(|other| other.id != book_id)
            .any(|other| {
                other
                    .files
                    .iter()
                    .map(|file| file.path.as_str())
                    .chain(other.cover_path.as_deref())
                    .chain(other.audio.iter().flat_map(|audio| audio.chapters.iter().map(|chapter| chapter.path.as_str())))
                    .any(|shared| {
                        let shared = Path::new(shared)
                            .canonicalize()
                            .unwrap_or_else(|_| PathBuf::from(shared));
                        path_key(path) == path_key(&shared)
                    })
            })
    });
    Ok(files.into_iter().collect())
}

fn restore(staged: &[(PathBuf, PathBuf)]) -> Result<(), String> {
    let mut errors = Vec::new();
    for (original, temporary) in staged.iter().rev() {
        if temporary.exists() {
            if let Err(error) = std::fs::rename(temporary, original) {
                errors.push(format!("{} : {error}", original.display()));
            }
        }
    }
    if errors.is_empty() {
        Ok(())
    } else {
        Err(format!("Restauration incomplète : {}", errors.join(" ; ")))
    }
}

pub(super) fn delete(
    config: &mut LibraryConfig,
    book_id: &str,
    export_directory: &Path,
    persist: impl Fn(&LibraryConfig) -> Result<(), String>,
) -> Result<(), String> {
    static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
    let files = targets(config, book_id, export_directory)?;
    let mut staged = Vec::new();
    for original in files {
        let sequence = SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let temporary = original.with_file_name(format!(
            ".{}.aldus-delete-{}-{sequence}",
            original.file_name().unwrap_or_default().to_string_lossy(),
            std::process::id()
        ));
        if temporary.exists() {
            restore(&staged)?;
            return Err("Un effacement précédent doit être résolu avant de continuer.".into());
        }
        if let Err(error) = std::fs::rename(&original, &temporary) {
            restore(&staged)?;
            return Err(format!(
                "Suppression impossible « {} » : {error}. Aucun ouvrage retiré de la bibliothèque.",
                original.display()
            ));
        }
        staged.push((original, temporary));
    }
    let mut next = config.clone();
    next.books.retain(|book| book.id != book_id);
    if let Err(error) = persist(&next) {
        restore(&staged)?;
        return Err(error);
    }
    for (_, temporary) in &staged {
        if let Err(error) = std::fs::remove_file(temporary) {
            restore(&staged)?;
            persist(config)?;
            return Err(format!("Suppression partielle : {error}. La fiche est conservée ; certains exports ont déjà été effacés. Réessayez après avoir fermé les fichiers ouverts."));
        }
    }
    for (original, _) in &staged {
        let mut parent = original.parent();
        while let Some(directory) = parent {
            if directory == export_directory || !directory.starts_with(export_directory) { break; }
            if std::fs::remove_dir(directory).is_err() { break; }
            parent = directory.parent();
        }
    }
    *config = next;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::library::{Book, LibraryFile};

    fn fixture() -> (PathBuf, LibraryConfig) {
        static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "aldus-delete-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        std::fs::create_dir_all(root.join("exports")).unwrap();
        std::fs::create_dir_all(root.join("sources")).unwrap();
        for name in [
            "Nunael.epub",
            "Nunael.pdf",
            "Nunael.docx",
            "Nunael_cover.jpg",
            "Nunael_2.pdf",
        ] {
            std::fs::write(root.join("exports").join(name), name).unwrap();
        }
        std::fs::write(root.join("sources/chapitre.md"), "Texte").unwrap();
        std::fs::write(root.join("sources/couverture.jpg"), "Source cover").unwrap();
        let mut config = LibraryConfig::default();
        config.books.push(Book {
            id: "book".into(),
            title: "Nunael".into(),
            shelf_id: "completed".into(),
            files: ["epub", "pdf"]
                .iter()
                .map(|format| LibraryFile {
                    path: root
                        .join(format!("exports/Nunael.{format}"))
                        .to_string_lossy()
                        .into(),
                    format: (*format).into(),
                })
                .collect(),
            source_directory: Some(root.join("sources").to_string_lossy().into()),
            cover_path: Some(root.join("sources/couverture.jpg").to_string_lossy().into()),
            ..Book::default()
        });
        (root, config)
    }

    #[test]
    fn deletes_all_export_formats_and_covers_but_preserves_sources_and_other_books() {
        let (root, mut config) = fixture();
        let config_path = root.join("library.json");
        let export_directory = root.join("exports");
        delete(&mut config, "book", &export_directory, |next| {
            std::fs::write(&config_path, serde_json::to_vec(next).unwrap())
                .map_err(|error| error.to_string())
        })
        .unwrap();
        assert!(config.books.is_empty());
        for name in [
            "Nunael.epub",
            "Nunael.pdf",
            "Nunael.docx",
            "Nunael_cover.jpg",
        ] {
            assert!(!root.join("exports").join(name).exists());
        }
        assert!(root.join("exports/Nunael_2.pdf").exists());
        assert!(root.join("sources/chapitre.md").exists());
        assert!(root.join("sources/couverture.jpg").exists());
        let stored: LibraryConfig =
            serde_json::from_slice(&std::fs::read(config_path).unwrap()).unwrap();
        assert!(stored.books.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn restores_exports_if_library_persistence_fails() {
        let (root, mut config) = fixture();
        assert!(delete(&mut config, "book", &root.join("exports"), |_| Err(
            "Disque indisponible".into()
        ))
        .is_err());
        assert_eq!(config.books.len(), 1);
        assert_eq!(
            std::fs::read_to_string(root.join("exports/Nunael.epub")).unwrap(),
            "Nunael.epub"
        );
        assert!(root.join("exports/Nunael_cover.jpg").exists());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn validates_every_target_before_deleting_and_tolerates_missing_files() {
        let (root, mut config) = fixture();
        std::fs::remove_file(root.join("exports/Nunael.docx")).unwrap();
        std::fs::create_dir(root.join("exports/Nunael.docx")).unwrap();
        assert!(delete(&mut config, "book", &root.join("exports"), |_| Ok(())).is_err());
        assert!(root.join("exports/Nunael.epub").exists());
        assert_eq!(config.books.len(), 1);
        std::fs::remove_dir(root.join("exports/Nunael.docx")).unwrap();
        std::fs::remove_file(root.join("exports/Nunael.pdf")).unwrap();
        delete(&mut config, "book", &root.join("exports"), |_| Ok(())).unwrap();
        assert!(config.books.is_empty());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn preserves_export_cover_referenced_by_another_book() {
        let (root, mut config) = fixture();
        config.books.push(Book {
            id: "other".into(),
            title: "Autre".into(),
            cover_path: Some(
                root.join("exports/Nunael_cover.jpg")
                    .to_string_lossy()
                    .into(),
            ),
            ..Book::default()
        });
        delete(&mut config, "book", &root.join("exports"), |_| Ok(())).unwrap();
        assert_eq!(config.books.len(), 1);
        assert!(root.join("exports/Nunael_cover.jpg").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
