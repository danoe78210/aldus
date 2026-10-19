use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::Serialize;
use serde_json::Value;
use tauri::Emitter;

use crate::project::{OrganizationNode, ProjectPayload};
use crate::storage::{atomic_write, PROJECT_LOCK};

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PaginationResult {
    pub page_count: u32,
    pub is_measured: bool,
}

pub(crate) fn source_path(payload: &ProjectPayload, name: &str) -> Result<PathBuf, String> {
    let root = payload
        .directories
        .sources
        .as_deref()
        .ok_or("Dossier des sources non configuré.")?;
    let root = Path::new(root)
        .canonicalize()
        .map_err(|error| format!("Workspace inaccessible : {error}"))?;
    let path = root
        .join(name)
        .canonicalize()
        .map_err(|error| format!("Source inaccessible {name} : {error}"))?;
    if !path.starts_with(&root) || !path.is_file() {
        return Err(format!("Source hors du workspace : {name}"));
    }
    Ok(path)
}

pub(crate) fn source_text(path: &Path) -> Result<String, String> {
    if path
        .extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("docx"))
    {
        let file = std::fs::File::open(path).map_err(|error| error.to_string())?;
        let mut archive = zip::ZipArchive::new(file).map_err(|error| error.to_string())?;
        let mut xml = String::new();
        archive
            .by_name("word/document.xml")
            .map_err(|error| error.to_string())?
            .read_to_string(&mut xml)
            .map_err(|error| error.to_string())?;
        let document = roxmltree::Document::parse(&xml).map_err(|error| error.to_string())?;
        return Ok(document
            .descendants()
            .filter(|node| {
                node.has_tag_name((
                    "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                    "p",
                ))
            })
            .map(|paragraph| {
                paragraph
                    .descendants()
                    .filter(|node| {
                        node.has_tag_name((
                            "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
                            "t",
                        ))
                    })
                    .filter_map(|node| node.text())
                    .collect::<String>()
            })
            .collect::<Vec<_>>()
            .join("\n\n"));
    }
    std::fs::read_to_string(path)
        .map_err(|error| format!("Lecture de {} : {error}", path.display()))
}

fn visit_sources(
    payload: &ProjectPayload,
    nodes: &[OrganizationNode],
    include_images: bool,
    visitor: &mut impl FnMut(&OrganizationNode, Option<PathBuf>) -> Result<(), String>,
) -> Result<(), String> {
    for node in nodes {
        let path = node
            .source_file_name
            .as_deref()
            .filter(|name| !name.is_empty() && (include_images || node.kind != "image"))
            .map(|name| source_path(payload, name))
            .transpose()?;
        visitor(node, path)?;
        visit_sources(payload, &node.children, include_images, visitor)?;
    }
    Ok(())
}

pub(crate) fn estimate_words(payload: &ProjectPayload) -> Result<u32, String> {
    let mut words = 0usize;
    visit_sources(payload, &payload.organization, false, &mut |node, path| {
        if matches!(node.kind.as_str(), "chapter" | "act" | "special") {
            words += node
                .display_name
                .as_deref()
                .unwrap_or("")
                .split_whitespace()
                .count();
            if let Some(path) = path {
                let text = source_text(&path)?;
                words += crate::markdown::strip_frontmatter(&text)
                    .split_whitespace()
                    .count();
            }
        }
        Ok(())
    })?;
    pages_from_words(words)
}

fn pages_from_words(words: usize) -> Result<u32, String> {
    let pages = words.div_ceil(250);
    u32::try_from(pages + pages % 2)
        .map_err(|error| format!("Pagination trop importante : {error}"))
}

pub(crate) fn signature(payload: &ProjectPayload) -> Result<String, String> {
    let mut hasher = DefaultHasher::new();
    serde_json::to_vec(&serde_json::json!({
        "metadata": payload.metadata,
        "layout": payload.layout_config,
        "sources": payload.directories.sources,
        "organization": payload.organization,
        "imageColorMode": payload.options.image_color_mode,
    }))
    .map_err(|error| error.to_string())?
    .hash(&mut hasher);
    visit_sources(payload, &payload.organization, true, &mut |_, path| {
        if let Some(path) = path {
            std::fs::read(&path)
                .map_err(|error| format!("Lecture de {} : {error}", path.display()))?
                .hash(&mut hasher);
        }
        Ok(())
    })?;
    Ok(format!("{:016x}", hasher.finish()))
}

pub(crate) fn resolve(
    payload: &ProjectPayload,
    cached: &ProjectPayload,
) -> Result<PaginationResult, String> {
    if let Some(page_count) = cached.last_compiled_page_count {
        if cached.compiled_pagination_signature.as_deref() == Some(&signature(payload)?) {
            return Ok(PaginationResult {
                page_count,
                is_measured: true,
            });
        }
    }
    Ok(PaginationResult {
        page_count: estimate_words(payload)?,
        is_measured: false,
    })
}

pub(crate) fn write_project(path: &Path, contents: &str) -> Result<(), String> {
    let _guard = PROJECT_LOCK
        .lock()
        .map_err(|_| "Verrou du projet indisponible.")?;
    let mut project: Value =
        serde_json::from_str(contents).map_err(|error| format!("Projet invalide : {error}"))?;
    let object = project
        .as_object_mut()
        .ok_or("Le projet doit être un objet JSON.")?;
    if path.exists() {
        let stored: Value =
            serde_json::from_slice(&std::fs::read(path).map_err(|error| error.to_string())?)
                .map_err(|error| format!("Projet persistant illisible : {error}"))?;
        // Compilation owns these fields; an older autosave must not erase the measurement.
        for key in ["lastCompiledPageCount", "compiledPaginationSignature"] {
            if let Some(value) = stored.get(key) {
                object.insert(key.into(), value.clone());
            } else {
                object.remove(key);
            }
        }
    }
    atomic_write(
        path,
        &serde_json::to_vec_pretty(&project).map_err(|error| error.to_string())?,
    )
}

fn record_at(path: &Path, payload: &Value, signature: &str, page_count: u32) -> Result<(), String> {
    let _guard = PROJECT_LOCK
        .lock()
        .map_err(|_| "Verrou du projet indisponible.")?;
    let mut project: Value = if path.exists() {
        serde_json::from_slice(&std::fs::read(path).map_err(|error| error.to_string())?)
            .map_err(|error| format!("Projet persistant illisible : {error}"))?
    } else {
        payload.clone()
    };
    let object = project
        .as_object_mut()
        .ok_or("Le projet doit être un objet JSON.")?;
    object.insert("lastCompiledPageCount".into(), page_count.into());
    object.insert("compiledPaginationSignature".into(), signature.into());
    atomic_write(
        path,
        &serde_json::to_vec_pretty(&project).map_err(|error| error.to_string())?,
    )
}

pub(crate) fn record_compilation(
    app: &tauri::AppHandle,
    payload: &Value,
    signature: &str,
    page_count: u32,
) -> Result<(), String> {
    record_at(
        &crate::project_data_path(app)?,
        payload,
        signature,
        page_count,
    )?;
    app.emit("book-pagination-changed", ())
        .map_err(|error| format!("Notification de pagination impossible : {error}"))
}

#[tauri::command]
pub async fn get_book_pagination(
    app: tauri::AppHandle,
    payload: Option<Value>,
) -> Result<PaginationResult, String> {
    let result = tauri::async_runtime::spawn_blocking(move || {
        let stored = if crate::project_data_path(&app)?.is_file() {
            crate::commands::load_persisted_payload(&app)?
        } else {
            ProjectPayload::default()
        };
        let current = payload
            .map(serde_json::from_value::<ProjectPayload>)
            .transpose()
            .map_err(|error| format!("Projet invalide : {error}"))?;
        resolve(current.as_ref().unwrap_or(&stored), &stored)
    })
    .await
    .map_err(|error| format!("Calcul de pagination interrompu : {error}"))
    .and_then(|result| result);
    result.inspect_err(|error| log::error!("Pagination du livre : {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn word_estimate_rounds_up_to_even_without_kdp_clamping() -> Result<(), String> {
        assert_eq!(pages_from_words(0)?, 0);
        assert_eq!(pages_from_words(1)?, 2);
        assert_eq!(pages_from_words(500)?, 2);
        assert_eq!(pages_from_words(501)?, 4);
        assert_eq!(pages_from_words(500_000)?, 2000);
        Ok(())
    }

    #[test]
    fn counts_nested_markdown_and_docx_without_resolving_images() -> Result<(), String> {
        use std::io::Write;
        let root =
            std::env::temp_dir().join(format!("aldus-pagination-docx-{}", std::process::id()));
        std::fs::create_dir_all(root.join("nested")).map_err(|e| e.to_string())?;
        let result = (|| {
            std::fs::write(root.join("nested/chapter.md"), "mot ".repeat(500))
                .map_err(|e| e.to_string())?;
            let path = root.join("nested/chapter.docx");
            let mut archive =
                zip::ZipWriter::new(std::fs::File::create(&path).map_err(|e| e.to_string())?);
            archive
                .start_file(
                    "word/document.xml",
                    zip::write::SimpleFileOptions::default(),
                )
                .map_err(|e| e.to_string())?;
            archive.write_all(br#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>prem</w:t></w:r><w:r><w:t>ier mot</w:t></w:r></w:p><w:p><w:r><w:t>second</w:t></w:r></w:p></w:body></w:document>"#).map_err(|e| e.to_string())?;
            archive.finish().map_err(|e| e.to_string())?;
            assert_eq!(source_text(&path)?, "premier mot\n\nsecond");
            let payload: ProjectPayload = serde_json::from_value(serde_json::json!({
                "directories": { "sources": root },
                "organization": [{ "type": "act", "children": [
                    { "type": "chapter", "sourceFileName": "nested/chapter.md" },
                    { "type": "chapter", "sourceFileName": "nested/chapter.docx" },
                    { "type": "image", "sourceFileName": "missing.png" }
                ] }]
            }))
            .map_err(|e| e.to_string())?;
            assert_eq!(estimate_words(&payload)?, 4);
            Ok(())
        })();
        std::fs::remove_dir_all(&root).map_err(|e| e.to_string())?;
        result
    }

    #[test]
    fn persists_measurement_through_autosave_and_invalidates_changed_sources_and_layout(
    ) -> Result<(), String> {
        let root = std::env::temp_dir().join(format!("aldus-pagination-{}", std::process::id()));
        std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;
        let result = (|| {
            std::fs::write(root.join("chapter.md"), "mot ".repeat(501))
                .map_err(|e| e.to_string())?;
            let value = serde_json::json!({
                "directories": { "sources": root },
                "organization": [{ "type": "chapter", "sourceFileName": "chapter.md" }],
                "customField": 42
            });
            let payload: ProjectPayload =
                serde_json::from_value(value.clone()).map_err(|e| e.to_string())?;
            assert_eq!(resolve(&payload, &payload)?.page_count, 4);
            let path = root.join("project.danoe");
            record_at(&path, &value, &signature(&payload)?, 7)?;
            write_project(&path, &value.to_string())?;
            let stored: ProjectPayload =
                serde_json::from_slice(&std::fs::read(&path).map_err(|e| e.to_string())?)
                    .map_err(|e| e.to_string())?;
            assert_eq!(
                resolve(&payload, &stored)?,
                PaginationResult {
                    page_count: 7,
                    is_measured: true
                }
            );
            let mut changed: ProjectPayload =
                serde_json::from_value(value).map_err(|e| e.to_string())?;
            changed.layout_config.body_size = 14.0;
            assert!(!resolve(&changed, &stored)?.is_measured);
            std::fs::write(root.join("chapter.md"), "nouveau texte").map_err(|e| e.to_string())?;
            assert!(!resolve(&payload, &stored)?.is_measured);
            assert_eq!(resolve(&payload, &stored)?.page_count, 2);
            Ok(())
        })();
        std::fs::remove_dir_all(root).map_err(|e| e.to_string())?;
        result
    }
}
