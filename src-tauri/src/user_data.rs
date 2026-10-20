use std::path::{Path, PathBuf};

use tauri::Manager;

const PERSISTENT_FILES: [&str; 6] = [
    "project.danoe",
    "library.json",
    "ignored_words.json",
    "places.json",
    "corrector_options.json",
    "stylometry_rules.json",
];

fn copy_legacy_file(source: &Path, destination: &Path) -> Result<(), String> {
    let metadata = match std::fs::symlink_metadata(source) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(error) => {
            return Err(format!(
                "Lecture des métadonnées de migration impossible {} : {error}",
                source.display()
            ));
        }
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(format!(
            "Fichier de données historique non régulier : {}",
            source.display()
        ));
    }

    let legacy = std::fs::read(source)
        .map_err(|error| format!("Lecture de {} impossible : {error}", source.display()))?;
    let mut conflict_backup = None;
    match std::fs::symlink_metadata(destination) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            crate::storage::atomic_write(destination, &legacy)?;
        }
        Err(error) => {
            return Err(format!(
                "Lecture des métadonnées de {} impossible : {error}",
                destination.display()
            ));
        }
        Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => {
            return Err(format!(
                "Fichier local non régulier : {}",
                destination.display()
            ));
        }
        Ok(_) => {
            let current = std::fs::read(destination).map_err(|error| {
                format!("Lecture de {} impossible : {error}", destination.display())
            })?;
            if current != legacy {
                let timestamp = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map_err(|error| format!("Horloge système invalide : {error}"))?
                    .as_nanos();
                let filename = source
                    .file_name()
                    .ok_or("Nom de fichier historique manquant.")?
                    .to_string_lossy();
                let backup =
                    destination.with_file_name(format!("{filename}.legacy-{timestamp}.bak"));
                crate::storage::atomic_write(&backup, &legacy)?;
                conflict_backup = Some(backup.clone());
                log::warn!(
                    "Données locales existantes conservées dans {}; ancienne copie archivée dans {}.",
                    destination.display(),
                    backup.display()
                );
            }
        }
    }

    let migrated = std::fs::read(destination).map_err(|error| {
        format!(
            "Vérification de la migration de {} impossible : {error}",
            destination.display()
        )
    })?;
    if migrated != legacy {
        let backup = conflict_backup.ok_or("Archive locale de migration introuvable.")?;
        let archived = std::fs::read(&backup).map_err(|error| {
            format!("Vérification de {} impossible : {error}", backup.display())
        })?;
        if archived != legacy {
            return Err(format!(
                "Vérification de l'archive historique impossible : {}",
                backup.display()
            ));
        }
    }

    std::fs::remove_file(source).map_err(|error| {
        format!(
            "Suppression de l'ancienne copie {} impossible après vérification : {error}",
            source.display()
        )
    })?;
    log::info!(
        "Migration de données terminée : {} vers LocalAppData.",
        source.display()
    );
    Ok(())
}

fn migrate_legacy_directories(
    destination: &Path,
    legacy_directories: &[PathBuf],
) -> Result<(), String> {
    std::fs::create_dir_all(destination).map_err(|error| {
        format!(
            "Création du dossier LocalAppData impossible {} : {error}",
            destination.display()
        )
    })?;
    for directory in legacy_directories {
        if directory == destination {
            continue;
        }
        for filename in PERSISTENT_FILES {
            copy_legacy_file(&directory.join(filename), &destination.join(filename))?;
        }
    }
    Ok(())
}

pub(crate) fn persistent_data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let result = (|| {
        let local = app
            .path()
            .app_local_data_dir()
            .map_err(|error| format!("Dossier LocalAppData Aldus introuvable : {error}"))?;
        let legacy_data = app
            .path()
            .app_data_dir()
            .map_err(|error| format!("Ancien dossier de données Aldus introuvable : {error}"))?;
        let legacy_config = app.path().app_config_dir().map_err(|error| {
            format!("Ancien dossier de configuration Aldus introuvable : {error}")
        })?;
        let mut legacy = vec![legacy_data];
        if !legacy.contains(&legacy_config) {
            legacy.push(legacy_config);
        }
        migrate_legacy_directories(&local, &legacy)?;
        Ok(local)
    })();
    result.inspect_err(|error| log::error!("Migration vers LocalAppData : {error}"))
}

#[cfg(test)]
mod tests {
    use super::migrate_legacy_directories;
    use std::fs;

    fn temp_dir(name: &str) -> Result<std::path::PathBuf, String> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_nanos();
        Ok(std::env::temp_dir().join(format!(
            "aldus-user-data-{name}-{}-{timestamp}",
            std::process::id()
        )))
    }

    #[test]
    fn migrates_legacy_files_atomically_and_archives_conflicts() -> Result<(), String> {
        let root = temp_dir("migration")?;
        let legacy = root.join("roaming");
        let local = root.join("local");
        fs::create_dir_all(&legacy).map_err(|error| error.to_string())?;
        fs::create_dir_all(&local).map_err(|error| error.to_string())?;
        fs::write(legacy.join("project.danoe"), "legacy project")
            .map_err(|error| error.to_string())?;
        fs::write(legacy.join("library.json"), "legacy library")
            .map_err(|error| error.to_string())?;
        fs::write(local.join("library.json"), "local library")
            .map_err(|error| error.to_string())?;

        migrate_legacy_directories(&local, std::slice::from_ref(&legacy))?;

        assert_eq!(
            fs::read_to_string(local.join("project.danoe")).map_err(|error| error.to_string())?,
            "legacy project"
        );
        assert_eq!(
            fs::read_to_string(local.join("library.json")).map_err(|error| error.to_string())?,
            "local library"
        );
        let archives = fs::read_dir(&local)
            .map_err(|error| error.to_string())?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .is_some_and(|name| name.to_string_lossy().starts_with("library.json.legacy-"))
            })
            .collect::<Vec<_>>();
        assert_eq!(archives.len(), 1);
        assert_eq!(
            fs::read_to_string(&archives[0]).map_err(|error| error.to_string())?,
            "legacy library"
        );
        assert!(!legacy.join("project.danoe").exists());
        assert!(!legacy.join("library.json").exists());
        migrate_legacy_directories(&local, std::slice::from_ref(&legacy))?;

        fs::remove_dir_all(root).map_err(|error| error.to_string())?;
        Ok(())
    }
}
