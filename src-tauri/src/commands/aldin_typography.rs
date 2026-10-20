use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use regex::Regex;
use serde::Serialize;
use walkdir::{DirEntry, WalkDir};

use crate::commands::history_workspace;

static DIALOGUE_DASH: OnceLock<Regex> = OnceLock::new();
static OE_WORDS: OnceLock<Regex> = OnceLock::new();
static AE_WORDS: OnceLock<Regex> = OnceLock::new();

#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TypoBatchSummary {
    pub chapters_modified: usize,
    pub apostrophes_count: usize,
    pub spaces_count: usize,
    pub dashes_count: usize,
    pub ligatures_count: usize,
}

struct PlannedChapter {
    relative_path: String,
    content: String,
    updated: String,
    counts: TypoBatchSummary,
}

fn is_hidden(entry: &DirEntry) -> bool {
    entry.depth() > 0 && entry.file_name().to_string_lossy().starts_with('.')
}

fn replace_counted<F>(input: &str, regex: &Regex, replacement: F) -> (String, usize)
where
    F: Fn(&regex::Captures<'_>) -> String,
{
    let mut count = 0;
    let output = regex
        .replace_all(input, |captures: &regex::Captures<'_>| {
            let replacement = replacement(captures);
            if replacement != captures[0] {
                count += 1;
            }
            replacement
        })
        .into_owned();
    (output, count)
}

fn normalize_ligature_word(word: &str, regex: &Regex, letters: &str, ligature: char) -> String {
    regex
        .replace_all(word, |captures: &regex::Captures<'_>| {
            let matched = &captures[0];
            let first = matched.chars().next().unwrap_or(' ');
            let uppercase = first.is_uppercase();
            let ligature = if uppercase {
                ligature.to_uppercase().next().unwrap_or(ligature)
            } else {
                ligature
            };
            let position = matched.to_ascii_lowercase().find(letters);
            if let Some(position) = position {
                format!(
                    "{}{}{}",
                    &matched[..position],
                    ligature,
                    &matched[position + letters.len()..]
                )
            } else {
                matched.to_string()
            }
        })
        .into_owned()
}

fn normalize_text(content: &str) -> (String, TypoBatchSummary) {
    let apostrophes_count = content.matches('\'').count();
    let content = content.replace('\'', "’");
    let mut summary = TypoBatchSummary {
        apostrophes_count,
        ..TypoBatchSummary::default()
    };

    let punctuation = Regex::new(r"[ \t\u{00a0}\u{202f}]*([:;!?])")
        .expect("expression d'espacement avant ponctuation valide");
    let (content, punctuation_spaces) = replace_counted(&content, &punctuation, |captures| {
        format!(" {}", &captures[1])
    });
    summary.spaces_count += punctuation_spaces;

    let opening_quote =
        Regex::new(r"«[ \t\u{00a0}\u{202f}]*").expect("expression de guillemet ouvrant valide");
    let (content, opening_spaces) = replace_counted(&content, &opening_quote, |_| "« ".into());
    summary.spaces_count += opening_spaces;
    let closing_quote =
        Regex::new(r"[ \t\u{00a0}\u{202f}]*»").expect("expression de guillemet fermant valide");
    let (content, closing_spaces) = replace_counted(&content, &closing_quote, |_| " »".into());
    summary.spaces_count += closing_spaces;

    let dialogue_dash = DIALOGUE_DASH.get_or_init(|| {
        Regex::new(r"(?m)^([ \t]*)-{1,2}([ \t]+)([A-ZÀ-ÖØ-Þ«“—])")
            .expect("expression de tiret de dialogue valide")
    });
    let oe_words = OE_WORDS.get_or_init(|| {
        Regex::new(
            r"(?i)\b(coeur|coeurs|soeur|soeurs|oeuvre|oeuvres|moeurs|manoeuvre|manoeuvres|boeuf|boeufs|noeud|noeuds|voeu|voeux|oeil|oeils|oeillet|oeillets|oeuf|oeufs|foetus)\b",
        )
        .expect("expression de ligature oe valide")
    });
    let ae_words = AE_WORDS.get_or_init(|| {
        Regex::new(r"(?i)\b(aequo|caetera|caeteris|aether|aeternum)\b")
            .expect("expression de ligature ae valide")
    });
    let (content, dashes_count) = replace_counted(&content, dialogue_dash, |captures| {
        format!("{}—{}{}", &captures[1], &captures[2], &captures[3])
    });
    summary.dashes_count = dashes_count;

    let (content, oe_count) = replace_counted(&content, oe_words, |captures| {
        normalize_ligature_word(&captures[0], oe_words, "oe", 'œ')
    });
    let (content, ae_count) = replace_counted(&content, ae_words, |captures| {
        normalize_ligature_word(&captures[0], ae_words, "ae", 'æ')
    });
    summary.ligatures_count = oe_count + ae_count;
    (content, summary)
}

fn markdown_files(root: &Path) -> Result<Vec<(PathBuf, String)>, String> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|entry| {
            !is_hidden(entry)
                && !["node_modules", "target", "dist"]
                    .contains(&entry.file_name().to_string_lossy().as_ref())
        })
    {
        let entry = entry.map_err(|error| format!("Parcours du workspace impossible : {error}"))?;
        if !entry.file_type().is_file()
            || !entry
                .path()
                .extension()
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
        {
            continue;
        }
        let canonical = entry
            .path()
            .canonicalize()
            .map_err(|error| format!("Fichier Markdown inaccessible : {error}"))?;
        if !canonical.starts_with(root) {
            return Err(format!(
                "Le fichier Markdown sort du workspace : {}",
                entry.path().display()
            ));
        }
        let relative = canonical
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .components()
            .map(|part| part.as_os_str().to_string_lossy())
            .collect::<Vec<_>>()
            .join("/");
        files.push((canonical, relative));
    }
    files.sort_by(|left, right| left.1.cmp(&right.1));
    Ok(files)
}

fn run_batch(root: &Path, dry_run: bool) -> Result<TypoBatchSummary, String> {
    let root = root
        .canonicalize()
        .map_err(|error| format!("Workspace inaccessible : {error}"))?;
    let mut planned = Vec::new();
    for (path, relative_path) in markdown_files(&root)? {
        let content = std::fs::read_to_string(&path)
            .map_err(|error| format!("Lecture de {} impossible : {error}", path.display()))?;
        let (updated, counts) = normalize_text(&content);
        if content != updated {
            planned.push(PlannedChapter {
                relative_path,
                content,
                updated,
                counts,
            });
        }
    }

    let mut summary = TypoBatchSummary::default();
    for chapter in &planned {
        summary.chapters_modified += 1;
        summary.apostrophes_count += chapter.counts.apostrophes_count;
        summary.spaces_count += chapter.counts.spaces_count;
        summary.dashes_count += chapter.counts.dashes_count;
        summary.ligatures_count += chapter.counts.ligatures_count;
    }

    if !dry_run {
        for chapter in planned {
            crate::storage::save_chapter_with_marker(
                &root,
                &chapter.relative_path,
                &chapter.content,
                &chapter.updated,
                "before_global_aldin",
            )?;
        }
    }
    Ok(summary)
}

#[tauri::command]
pub async fn apply_aldin_typography_to_project(
    app: tauri::AppHandle,
    workspace: String,
    dry_run: bool,
) -> Result<TypoBatchSummary, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let root = history_workspace(&app, &workspace)?;
        let _guard = crate::storage::PROJECT_LOCK
            .lock()
            .map_err(|_| "Verrou du workspace indisponible.")?;
        run_batch(&root, dry_run)
    })
    .await
    .map_err(|error| format!("Normalisation aldin interrompue : {error}"))
    .and_then(|result| result);
    result.inspect_err(|error| log::error!("Normalisation typographique aldin : {error}"))
}

#[cfg(test)]
mod tests {
    use super::{normalize_text, run_batch};
    use std::fs;

    #[test]
    fn normalizes_french_typography_and_is_idempotent() {
        let input = "'Cœur', soeur, oeuvre! — non\n- Bonjour !\n« un mot »";
        let (normalized, counts) = normalize_text(input);
        assert_eq!(
            normalized,
            "’Cœur’, sœur, œuvre ! — non\n— Bonjour !\n« un mot »"
        );
        assert_eq!(counts.apostrophes_count, 2);
        assert_eq!(counts.spaces_count, 4);
        assert_eq!(counts.dashes_count, 1);
        assert_eq!(counts.ligatures_count, 2);
        assert_eq!(normalize_text(&normalized).0, normalized);
    }

    #[test]
    fn batch_dry_run_does_not_write_and_apply_creates_restorable_snapshot() -> Result<(), String> {
        let root = std::env::temp_dir().join(format!(
            "aldus-aldin-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|error| error.to_string())?
                .as_nanos()
        ));
        fs::create_dir_all(root.join("chapitres")).map_err(|error| error.to_string())?;
        fs::create_dir_all(root.join(".aldus")).map_err(|error| error.to_string())?;
        fs::write(root.join("chapitres/01.md"), "'Cœur !").map_err(|error| error.to_string())?;
        fs::write(root.join(".aldus/ignore.md"), "'Cœur !").map_err(|error| error.to_string())?;

        let dry_run = run_batch(&root, true)?;
        assert_eq!(dry_run.chapters_modified, 1);
        assert_eq!(
            fs::read_to_string(root.join("chapitres/01.md")).map_err(|error| error.to_string())?,
            "'Cœur !"
        );

        let applied = run_batch(&root, false)?;
        assert_eq!(applied, dry_run);
        assert_eq!(
            fs::read_to_string(root.join("chapitres/01.md")).map_err(|error| error.to_string())?,
            "’Cœur !"
        );
        let history = root.join(".aldus/history");
        let snapshots = fs::read_dir(&history)
            .map_err(|error| error.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|error| error.to_string())?;
        assert_eq!(snapshots.len(), 1);
        let filename = snapshots[0].file_name().to_string_lossy().into_owned();
        assert!(filename.contains("_before_global_aldin_"));
        assert_eq!(
            fs::read_to_string(snapshots[0].path()).map_err(|error| error.to_string())?,
            "'Cœur !"
        );
        assert_eq!(
            crate::storage::list_history(&root, "chapitres/01.md")?.len(),
            1
        );
        crate::storage::restore_snapshot(&root, "chapitres/01.md", &filename)?;
        assert_eq!(
            fs::read_to_string(root.join("chapitres/01.md")).map_err(|error| error.to_string())?,
            "'Cœur !"
        );
        let _ = fs::remove_dir_all(root);
        Ok(())
    }
}
