use crate::commands::history_workspace;
use crate::stylometry::{self, PatternType, RuleKind, StylometryRule};

fn rules_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let result = crate::user_data::persistent_data_dir(app)
        .map(|directory| directory.join("stylometry_rules.json"));
    result.inspect_err(|error| log::error!("Configuration de stylométrie : {error}"))
}

fn read_rules(path: &std::path::Path) -> Result<Vec<StylometryRule>, String> {
    match std::fs::symlink_metadata(path) {
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            Ok(stylometry::default_rules())
        }
        Err(error) => Err(format!("Lecture des règles de stylométrie : {error}")),
        Ok(metadata) if !metadata.is_file() || metadata.file_type().is_symlink() => {
            Err("Le fichier des règles de stylométrie doit être un fichier régulier.".into())
        }
        Ok(_) => {
            let bytes = std::fs::read(path)
                .map_err(|error| format!("Lecture des règles de stylométrie : {error}"))?;
            let stored: Vec<StylometryRule> = serde_json::from_slice(&bytes)
                .map_err(|error| format!("Règles de stylométrie invalides : {error}"))?;
            validate_rules(stored)
        }
    }
}

fn validate_rules(proposed: Vec<StylometryRule>) -> Result<Vec<StylometryRule>, String> {
    let defaults = stylometry::default_rules();
    let mut custom = Vec::new();
    let mut builtin_states = Vec::new();
    for rule in proposed {
        if rule.is_builtin {
            builtin_states.push((rule.id, rule.enabled));
            continue;
        }
        if rule.id.is_empty()
            || rule.id.len() > 80
            || !rule
                .id
                .chars()
                .all(|character| character.is_ascii_alphanumeric() || character == '-')
            || rule.name.trim().is_empty()
            || rule.name.chars().count() > 100
        {
            return Err("Identifiant ou nom de règle invalide.".into());
        }
        let (pattern_type, pattern, weight, category, explanation) = match &rule.kind {
            RuleKind::Detection {
                pattern_type,
                pattern,
                penalty_weight,
                category,
                explanation,
                ..
            } => (pattern_type, pattern, penalty_weight, category, explanation),
            RuleKind::Humanisation {
                pattern_type,
                pattern,
                bonus_weight,
                category,
                explanation,
            } => (pattern_type, pattern, bonus_weight, category, explanation),
        };
        if !weight.is_finite()
            || !(1.0..=20.0).contains(weight)
            || pattern.len() > 500
            || category.trim().is_empty()
            || explanation.trim().is_empty()
        {
            return Err(format!(
                "Paramètres invalides pour la règle « {} ».",
                rule.name
            ));
        }
        if matches!(pattern_type, PatternType::ExactMatch | PatternType::Regex)
            && pattern.trim().is_empty()
        {
            return Err(format!("Le motif de « {} » ne peut être vide.", rule.name));
        }
        if matches!(pattern_type, PatternType::Regex) && !pattern.is_empty() {
            regex::Regex::new(pattern).map_err(|error| {
                format!(
                    "Expression régulière invalide pour « {} » : {error}",
                    rule.name
                )
            })?;
        }
        custom.push(StylometryRule {
            is_builtin: false,
            ..rule
        });
    }
    custom.sort_by(|left, right| left.id.cmp(&right.id));
    if custom.windows(2).any(|pair| pair[0].id == pair[1].id)
        || defaults
            .iter()
            .any(|builtin| custom.iter().any(|rule| rule.id == builtin.id))
    {
        return Err("Chaque règle personnalisée doit avoir un identifiant unique.".into());
    }
    if builtin_states
        .iter()
        .map(|(id, _)| id)
        .collect::<std::collections::HashSet<_>>()
        .len()
        != builtin_states.len()
    {
        return Err("Une règle native est présente plusieurs fois.".into());
    }
    let mut merged = defaults;
    for builtin in &mut merged {
        if let Some((_, enabled)) = builtin_states.iter().find(|(id, _)| id == &builtin.id) {
            builtin.enabled = *enabled;
        }
    }
    merged.extend(custom);
    Ok(merged)
}

#[tauri::command]
pub async fn get_stylometry_rules(app: tauri::AppHandle) -> Result<Vec<StylometryRule>, String> {
    let path = rules_path(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || read_rules(&path))
        .await
        .map_err(|error| format!("Lecture des règles interrompue : {error}"))
        .and_then(|result| result);
    result.inspect_err(|error| log::error!("Règles de stylométrie : {error}"))
}

#[tauri::command]
pub async fn save_stylometry_rules(
    app: tauri::AppHandle,
    rules: Vec<StylometryRule>,
) -> Result<Vec<StylometryRule>, String> {
    let path = rules_path(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let rules = validate_rules(rules)?;
        let directory = path.parent().ok_or("Dossier des règles manquant.")?;
        std::fs::create_dir_all(directory)
            .map_err(|error| format!("Création du dossier des règles : {error}"))?;
        let bytes = serde_json::to_vec_pretty(&rules)
            .map_err(|error| format!("Sérialisation des règles : {error}"))?;
        crate::storage::atomic_write(&path, &bytes)?;
        Ok(rules)
    })
    .await
    .map_err(|error| format!("Enregistrement des règles interrompu : {error}"))
    .and_then(|result| result);
    result.inspect_err(|error| log::error!("Enregistrement des règles de stylométrie : {error}"))
}

#[tauri::command]
pub async fn audit_chapter_stylometry(
    app: tauri::AppHandle,
    workspace: String,
    chapter_id: String,
) -> Result<stylometry::StylometryReport, String> {
    let path = rules_path(&app)?;
    let result = tauri::async_runtime::spawn_blocking(move || {
        let root = history_workspace(&app, &workspace)?;
        let chapter_path = crate::storage::resolve_chapter(&root, &chapter_id)?;
        let content = std::fs::read_to_string(chapter_path)
            .map_err(|error| format!("Lecture du chapitre impossible : {error}"))?;
        stylometry::analyze(&chapter_id, &content, &read_rules(&path)?)
    })
    .await
    .map_err(|error| format!("Audit interrompu : {error}"))
    .and_then(|result| result);
    result.inspect_err(|error| log::error!("Audit de stylométrie : {error}"))
}

#[tauri::command]
pub async fn apply_stylometry_suggestion(
    app: tauri::AppHandle,
    workspace: String,
    chapter_id: String,
    start_offset: usize,
    end_offset: usize,
    original_text: String,
    replacement: String,
) -> Result<(), String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let root = history_workspace(&app, &workspace)?;
        crate::storage::replace_chapter_text(
            &root,
            &chapter_id,
            start_offset,
            end_offset,
            &original_text,
            &replacement,
        )
    })
    .await
    .map_err(|error| format!("Application de la proposition interrompue : {error}"))
    .and_then(|result| result);
    result.inspect_err(|error| log::error!("Application d'une proposition stylométrique : {error}"))
}
