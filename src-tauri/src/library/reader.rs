use super::{metadata, read_config};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs::File;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use zip::ZipArchive;

static BOOKMARK_LOCK: Mutex<()> = Mutex::new(());
const MAX_BOOKMARKS_PER_BOOK: usize = 500;
const MAX_EXCERPT_CHARS: usize = 240;
const MAX_TITLE_CHARS: usize = 160;

const BLOCK_TAGS: [&str; 26] = [
    "p", "div", "section", "article", "blockquote", "ul", "ol", "li", "h1", "h2", "h3", "h4", "h5",
    "h6", "hr", "aside", "header", "footer", "table", "tr", "pre", "main", "dl", "dt", "dd", "body",
];

fn is_false(value: &bool) -> bool {
    !*value
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderRun {
    pub text: String,
    #[serde(skip_serializing_if = "is_false")]
    pub italic: bool,
    #[serde(skip_serializing_if = "is_false")]
    pub bold: bool,
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderBlock {
    /// `heading`, `paragraph`, `dialogue`, `quote` ou `rule`.
    pub kind: &'static str,
    pub level: u8,
    pub runs: Vec<ReaderRun>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderChapter {
    pub title: String,
    pub blocks: Vec<ReaderBlock>,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderContent {
    pub format: String,
    pub chapters: Vec<ReaderChapter>,
}

fn is_collapsible(character: char) -> bool {
    character.is_whitespace() && !matches!(character, '\u{a0}' | '\u{202f}' | '\u{2009}')
}

fn run(text: &str, italic: bool, bold: bool) -> ReaderRun {
    ReaderRun {
        text: text.to_string(),
        italic,
        bold,
    }
}

/// Réduit les blancs ordinaires (les insécables français sont conservés), fusionne
/// les segments de même graisse et retire les marges de la ligne.
fn normalize_runs(runs: Vec<ReaderRun>) -> Vec<ReaderRun> {
    let mut output: Vec<ReaderRun> = Vec::new();
    let mut previous_space = true;
    for source in runs {
        let mut text = String::new();
        for character in source.text.chars() {
            if is_collapsible(character) {
                if !previous_space {
                    text.push(' ');
                    previous_space = true;
                }
            } else {
                text.push(character);
                previous_space = false;
            }
        }
        if text.is_empty() {
            continue;
        }
        match output.last_mut() {
            Some(last) if last.italic == source.italic && last.bold == source.bold => {
                last.text.push_str(&text);
            }
            _ => output.push(ReaderRun {
                text,
                italic: source.italic,
                bold: source.bold,
            }),
        }
    }
    while let Some(last) = output.last_mut() {
        last.text.truncate(last.text.trim_end_matches(' ').len());
        if last.text.is_empty() {
            output.pop();
        } else {
            break;
        }
    }
    output
}

fn plain_text(block: &ReaderBlock) -> String {
    block.runs.iter().map(|run| run.text.as_str()).collect()
}

fn inline_block(runs: Vec<ReaderRun>, quote: bool) -> Option<ReaderBlock> {
    let runs = normalize_runs(runs);
    let first = runs.first()?.text.chars().next()?;
    let text: String = runs.iter().map(|run| run.text.as_str()).collect();
    if text.chars().all(|c| matches!(c, '*' | '⁂' | '•' | ' ' | '\u{a0}')) {
        return Some(ReaderBlock {
            kind: "rule",
            level: 0,
            runs: Vec::new(),
        });
    }
    let kind = if quote {
        "quote"
    } else if matches!(first, '—' | '–' | '«' | '-') {
        "dialogue"
    } else {
        "paragraph"
    };
    Some(ReaderBlock {
        kind,
        level: 0,
        runs,
    })
}

fn collect_runs(
    node: roxmltree::Node<'_, '_>,
    italic: bool,
    bold: bool,
    runs: &mut Vec<ReaderRun>,
) {
    for child in node.children() {
        if let Some(text) = child.text().filter(|_| child.is_text()) {
            runs.push(run(text, italic, bold));
        } else if child.is_element() {
            match child.tag_name().name() {
                "script" | "style" | "img" | "svg" | "nav" => {}
                "br" => runs.push(run(" ", italic, bold)),
                "em" | "i" | "cite" | "dfn" => collect_runs(child, true, bold, runs),
                "strong" | "b" => collect_runs(child, italic, true, runs),
                _ => collect_runs(child, italic, bold, runs),
            }
        }
    }
}

fn push_inline(node: roxmltree::Node<'_, '_>, quote: bool, blocks: &mut Vec<ReaderBlock>) {
    let mut runs = Vec::new();
    collect_runs(node, false, false, &mut runs);
    blocks.extend(inline_block(runs, quote));
}

fn has_block_descendant(node: roxmltree::Node<'_, '_>) -> bool {
    node.descendants()
        .skip(1)
        .any(|child| child.is_element() && BLOCK_TAGS.contains(&child.tag_name().name()))
}

fn collect_blocks(node: roxmltree::Node<'_, '_>, quote: bool, blocks: &mut Vec<ReaderBlock>) {
    for child in node.children().filter(|child| child.is_element()) {
        let name = child.tag_name().name();
        match name {
            "head" | "script" | "style" | "nav" | "svg" | "img" => {}
            "hr" => blocks.push(ReaderBlock {
                kind: "rule",
                level: 0,
                runs: Vec::new(),
            }),
            "h1" | "h2" | "h3" | "h4" | "h5" | "h6" => {
                let mut runs = Vec::new();
                collect_runs(child, false, false, &mut runs);
                let runs = normalize_runs(runs);
                if !runs.is_empty() {
                    blocks.push(ReaderBlock {
                        kind: "heading",
                        level: name[1..].parse().unwrap_or(2),
                        runs,
                    });
                }
            }
            "p" | "li" | "dt" | "dd" | "pre" | "figcaption" | "caption" | "td" | "th" => {
                push_inline(child, quote, blocks);
            }
            _ => {
                let quote = quote || name == "blockquote";
                if has_block_descendant(child) {
                    collect_blocks(child, quote, blocks);
                } else {
                    push_inline(child, quote, blocks);
                }
            }
        }
    }
}

fn xhtml_to_blocks(document: &roxmltree::Document<'_>) -> Vec<ReaderBlock> {
    let root = document
        .descendants()
        .find(|node| node.has_tag_name("body"))
        .unwrap_or_else(|| document.root_element());
    let mut blocks = Vec::new();
    collect_blocks(root, false, &mut blocks);
    blocks
}

/// Chemins des documents XHTML de la colonne vertébrale (`spine`) d'un EPUB, dans l'ordre de lecture.
pub(super) fn epub_spine_entries(archive: &mut ZipArchive<File>) -> Result<Vec<String>, String> {
    let container = metadata::xml_entry(archive, "META-INF/container.xml")
        .ok_or("EPUB sans META-INF/container.xml.")?;
    let container = metadata::parse_xml(&container).ok_or("Container EPUB invalide.")?;
    let package_path = container
        .descendants()
        .find(|node| node.has_tag_name("rootfile"))
        .and_then(|node| node.attribute("full-path"))
        .ok_or("Chemin OPF absent du conteneur EPUB.")?;
    let package_xml = metadata::xml_entry(archive, package_path).ok_or("OPF EPUB introuvable.")?;
    let package = metadata::parse_xml(&package_xml).ok_or("OPF EPUB invalide.")?;
    let spine = package
        .descendants()
        .find(|node| node.has_tag_name("spine"))
        .ok_or("Structure spine absente de l'EPUB.")?;
    Ok(spine
        .children()
        .filter(|node| node.has_tag_name("itemref") && node.attribute("linear") != Some("no"))
        .filter_map(|item_ref| {
            let id = item_ref.attribute("idref")?;
            let item = package
                .descendants()
                .find(|node| node.has_tag_name("item") && node.attribute("id") == Some(id))?;
            if item.attribute("media-type") != Some("application/xhtml+xml") {
                return None;
            }
            Some(metadata::archive_path(package_path, item.attribute("href")?))
        })
        .collect())
}

fn read_epub(path: &Path) -> Result<Vec<ReaderChapter>, String> {
    let mut archive = ZipArchive::new(File::open(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("EPUB illisible : {error}"))?;
    let mut chapters = Vec::new();
    for entry_path in epub_spine_entries(&mut archive)? {
        let Some(text) = metadata::xml_entry(&mut archive, &entry_path) else {
            log::warn!("Lecteur d'Atelier : section EPUB illisible « {entry_path} ».");
            continue;
        };
        let Some(document) = metadata::parse_xml(&text) else {
            log::warn!("Lecteur d'Atelier : section EPUB invalide « {entry_path} ».");
            continue;
        };
        let blocks = xhtml_to_blocks(&document);
        if blocks.is_empty() {
            continue;
        }
        let title = blocks
            .iter()
            .find(|block| block.kind == "heading")
            .map(plain_text)
            .or_else(|| {
                Path::new(&entry_path)
                    .file_stem()
                    .and_then(|stem| stem.to_str())
                    .map(|stem| stem.replace(['_', '-'], " "))
            })
            .unwrap_or_else(|| format!("Chapitre {}", chapters.len() + 1));
        chapters.push(ReaderChapter { title, blocks });
    }
    if chapters.is_empty() {
        return Err("Aucun texte lisible dans l'EPUB.".into());
    }
    Ok(chapters)
}

fn heading_level(style: &str) -> Option<u8> {
    let name: String = style
        .chars()
        .filter(|character| !character.is_whitespace() && !['_', '-'].contains(character))
        .flat_map(char::to_lowercase)
        .collect();
    name.strip_prefix("heading")
        .or_else(|| name.strip_prefix("titre"))?
        .parse::<u8>()
        .ok()
        .filter(|level| (1..=6).contains(level))
}

fn docx_runs(paragraph: roxmltree::Node<'_, '_>) -> Vec<ReaderRun> {
    paragraph
        .descendants()
        .filter(|node| node.has_tag_name("r"))
        .map(|node| {
            let properties = node.children().find(|child| child.has_tag_name("rPr"));
            let enabled = |name: &str| {
                properties
                    .and_then(|properties| {
                        properties.children().find(|child| child.has_tag_name(name))
                    })
                    .is_some_and(|flag| {
                        !matches!(
                            metadata::word_attribute(flag, "val"),
                            Some("0" | "false" | "off")
                        )
                    })
            };
            let mut text = String::new();
            for part in node.children() {
                match part.tag_name().name() {
                    "t" => text.push_str(part.text().unwrap_or("")),
                    "tab" | "br" | "cr" => text.push(' '),
                    _ => {}
                }
            }
            ReaderRun {
                text,
                italic: enabled("i"),
                bold: enabled("b"),
            }
        })
        .collect()
}

fn docx_blocks(
    document: &roxmltree::Document<'_>,
    heading_styles: &BTreeMap<String, u8>,
) -> Vec<ReaderBlock> {
    let mut blocks = Vec::new();
    for paragraph in document.descendants().filter(|node| node.has_tag_name("p")) {
        let style = paragraph
            .children()
            .filter(|node| node.has_tag_name("pPr"))
            .flat_map(|node| node.children())
            .find(|node| node.has_tag_name("pStyle"))
            .and_then(|node| metadata::word_attribute(node, "val"));
        let level = style.and_then(|style| {
            heading_styles
                .get(style)
                .copied()
                .or_else(|| heading_level(style))
        });
        let runs = docx_runs(paragraph);
        if let Some(level) = level {
            let runs = normalize_runs(runs);
            if !runs.is_empty() {
                blocks.push(ReaderBlock {
                    kind: "heading",
                    level,
                    runs,
                });
            }
            continue;
        }
        let quote = style.is_some_and(|style| {
            matches!(
                style.to_lowercase().as_str(),
                "quote" | "citation" | "blockquote"
            )
        });
        blocks.extend(inline_block(runs, quote));
    }
    blocks
}

fn chapters_from_blocks(blocks: Vec<ReaderBlock>) -> Vec<ReaderChapter> {
    let split_level = blocks
        .iter()
        .filter(|block| block.kind == "heading")
        .map(|block| block.level)
        .min();
    let fallback = if split_level.is_some() {
        "Début"
    } else {
        "Livre"
    };
    let mut chapters: Vec<ReaderChapter> = Vec::new();
    for block in blocks {
        if block.kind == "heading" && Some(block.level) == split_level {
            chapters.push(ReaderChapter {
                title: plain_text(&block),
                blocks: vec![block],
            });
        } else if let Some(chapter) = chapters.last_mut() {
            chapter.blocks.push(block);
        } else {
            chapters.push(ReaderChapter {
                title: fallback.into(),
                blocks: vec![block],
            });
        }
    }
    chapters
}

fn read_docx(path: &Path) -> Result<Vec<ReaderChapter>, String> {
    let mut archive = ZipArchive::new(File::open(path).map_err(|error| error.to_string())?)
        .map_err(|error| format!("DOCX illisible : {error}"))?;
    let document_xml = metadata::xml_entry(&mut archive, "word/document.xml")
        .ok_or("DOCX sans word/document.xml.")?;
    let document = metadata::parse_xml(&document_xml).ok_or("word/document.xml invalide.")?;
    let mut heading_styles = BTreeMap::new();
    if let Some(styles_xml) = metadata::xml_entry(&mut archive, "word/styles.xml") {
        if let Some(styles) = metadata::parse_xml(&styles_xml) {
            for style in styles
                .descendants()
                .filter(|node| node.has_tag_name("style"))
            {
                let level = style
                    .children()
                    .find(|child| child.has_tag_name("name"))
                    .and_then(|name| metadata::word_attribute(name, "val"))
                    .and_then(heading_level);
                if let (Some(id), Some(level)) = (metadata::word_attribute(style, "styleId"), level)
                {
                    heading_styles.insert(id.to_string(), level);
                }
            }
        }
    }
    let chapters = chapters_from_blocks(docx_blocks(&document, &heading_styles));
    if chapters.is_empty() {
        return Err("Aucun texte lisible dans le DOCX.".into());
    }
    Ok(chapters)
}

fn readable_path(
    app: &tauri::AppHandle,
    book_id: &str,
    resource: &str,
) -> Result<(PathBuf, String), String> {
    let config = read_config(app)?;
    let book = config
        .books
        .iter()
        .find(|book| book.id == book_id)
        .ok_or("Livre introuvable.")?;
    let file = book
        .files
        .iter()
        .find(|file| file.path == resource && ["epub", "docx"].contains(&file.format.as_str()))
        .ok_or("Seuls les fichiers EPUB et DOCX référencés peuvent être lus.")?;
    let path = Path::new(&file.path)
        .canonicalize()
        .map_err(|error| format!("Fichier introuvable : {error}"))?;
    if !path.is_file() {
        return Err("Le fichier référencé est introuvable.".into());
    }
    Ok((path, file.format.clone()))
}

#[tauri::command]
pub async fn read_book_content(
    app: tauri::AppHandle,
    book_id: String,
    resource: String,
) -> Result<ReaderContent, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let (path, format) = readable_path(&app, &book_id, &resource)?;
        let chapters = if format == "epub" {
            read_epub(&path)?
        } else {
            read_docx(&path)?
        };
        Ok(ReaderContent { format, chapters })
    })
    .await
    .map_err(|error| format!("Lecture du livre interrompue : {error}"))?
    .inspect_err(|error: &String| log::error!("Lecteur d'Atelier : {error}"))
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReaderBookmark {
    pub id: String,
    pub book_id: String,
    pub format: String,
    /// Index du chapitre (EPUB, DOCX) ou de la page (PDF), à partir de 0.
    pub chapter: u32,
    pub chapter_title: String,
    /// Avancement dans le chapitre, de 0 à 1 (part des blocs précédant le repère).
    pub position: f64,
    pub excerpt: String,
    pub created_at: u64,
}

#[derive(Default, Deserialize, Serialize)]
struct BookmarkFile {
    #[serde(default)]
    bookmarks: Vec<ReaderBookmark>,
}

fn bookmarks_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let root = match crate::commands::configured_sources_directory(app) {
        Ok(root) => root,
        Err(reason) => {
            log::info!("Signets du Lecteur d'Atelier : {reason} Repli sur les données locales.");
            crate::user_data::persistent_data_dir(app)?
        }
    };
    let directory = root.join(".aldus");
    match std::fs::symlink_metadata(&directory) {
        Ok(metadata) if metadata.file_type().is_symlink() || !metadata.is_dir() => {
            return Err("Le dossier .aldus doit être un dossier régulier.".into());
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            std::fs::create_dir(&directory)
                .map_err(|error| format!("Création du dossier .aldus impossible : {error}"))?;
        }
        Err(error) => return Err(format!("Accès au dossier .aldus impossible : {error}")),
    }
    Ok(directory.join("bookmarks.json"))
}

fn read_bookmark_file(path: &Path) -> Result<BookmarkFile, String> {
    match std::fs::read(path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|error| format!("Fichier des signets invalide : {error}")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(BookmarkFile::default()),
        Err(error) => Err(format!("Lecture des signets impossible : {error}")),
    }
}

fn replace_book_bookmarks(
    mut file: BookmarkFile,
    book_id: &str,
    incoming: Vec<ReaderBookmark>,
) -> Result<BookmarkFile, String> {
    if incoming.len() > MAX_BOOKMARKS_PER_BOOK {
        return Err(format!(
            "Un livre ne peut porter plus de {MAX_BOOKMARKS_PER_BOOK} signets."
        ));
    }
    let mut cleaned = Vec::with_capacity(incoming.len());
    for mut bookmark in incoming {
        if bookmark.book_id != book_id || bookmark.id.is_empty() || bookmark.id.len() > 80 {
            return Err("Signet invalide : identifiant ou livre incohérent.".into());
        }
        bookmark.excerpt = bookmark.excerpt.chars().take(MAX_EXCERPT_CHARS).collect();
        bookmark.chapter_title = bookmark.chapter_title.chars().take(MAX_TITLE_CHARS).collect();
        bookmark.position = if bookmark.position.is_finite() {
            bookmark.position.clamp(0.0, 1.0)
        } else {
            0.0
        };
        cleaned.push(bookmark);
    }
    file.bookmarks.retain(|bookmark| bookmark.book_id != book_id);
    file.bookmarks.extend(cleaned);
    Ok(file)
}

#[tauri::command]
pub async fn load_reader_bookmarks(
    app: tauri::AppHandle,
    book_id: String,
) -> Result<Vec<ReaderBookmark>, String> {
    let result = (|| {
        let _guard = BOOKMARK_LOCK
            .lock()
            .map_err(|_| "Verrou des signets indisponible.".to_string())?;
        let file = read_bookmark_file(&bookmarks_path(&app)?)?;
        Ok(file
            .bookmarks
            .into_iter()
            .filter(|bookmark| bookmark.book_id == book_id)
            .collect())
    })();
    result.inspect_err(|error: &String| log::error!("Signets du Lecteur d'Atelier : {error}"))
}

#[tauri::command]
pub async fn save_reader_bookmarks(
    app: tauri::AppHandle,
    book_id: String,
    bookmarks: Vec<ReaderBookmark>,
) -> Result<(), String> {
    let result = (|| {
        let _guard = BOOKMARK_LOCK
            .lock()
            .map_err(|_| "Verrou des signets indisponible.".to_string())?;
        let path = bookmarks_path(&app)?;
        let file = replace_book_bookmarks(read_bookmark_file(&path)?, &book_id, bookmarks)?;
        let bytes = serde_json::to_vec_pretty(&file)
            .map_err(|error| format!("Sérialisation des signets impossible : {error}"))?;
        crate::storage::atomic_write(&path, &bytes)
    })();
    result.inspect_err(|error: &String| log::error!("Signets du Lecteur d'Atelier : {error}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn now_seconds() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_nanos() as u64)
            .unwrap_or(0)
    }

    fn xhtml(body: &str) -> String {
        format!("<html xmlns=\"http://www.w3.org/1999/xhtml\" xmlns:epub=\"http://www.idpf.org/2007/ops\"><body>{body}</body></html>")
    }

    fn blocks_of(body: &str) -> Vec<ReaderBlock> {
        let text = xhtml(body);
        let document = metadata::parse_xml(&text).unwrap();
        xhtml_to_blocks(&document)
    }

    fn zip_fixture(name: &str, entries: &[(&str, &str)]) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "aldus-reader-{name}-{}-{}",
            std::process::id(),
            now_seconds()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join(name);
        let mut archive = zip::ZipWriter::new(File::create(&path).unwrap());
        for (entry, text) in entries {
            archive
                .start_file(*entry, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        path
    }

    #[test]
    fn xhtml_keeps_italics_dialogue_quotes_and_scene_breaks() {
        let blocks = blocks_of(
            "<nav epub:type=\"toc\"><p>Sommaire</p></nav><h2>Chapitre <em>un</em></h2>\
             <p>Il dit : <em>« Bonjour »</em>\n   puis   partit.</p>\
             <p>— Reste ici.</p><blockquote><p>Citation</p></blockquote><p>* * *</p>",
        );
        let kinds: Vec<_> = blocks.iter().map(|block| block.kind).collect();
        assert_eq!(kinds, ["heading", "paragraph", "dialogue", "quote", "rule"]);
        assert_eq!(blocks[0].level, 2);
        assert_eq!(plain_text(&blocks[1]), "Il dit : « Bonjour » puis partit.");
        assert!(blocks[1].runs.iter().any(|run| run.italic && run.text == "« Bonjour »"));
    }

    #[test]
    fn normalization_preserves_french_non_breaking_spaces() {
        let blocks = blocks_of("<p>  Quoi\u{a0}? Oui\u{202f}!  </p>");
        assert_eq!(plain_text(&blocks[0]), "Quoi\u{a0}? Oui\u{202f}!");
    }

    #[test]
    fn reads_every_linear_epub_section_including_prologue_and_skips_the_toc() {
        let path = zip_fixture(
            "book.epub",
            &[
                (
                    "META-INF/container.xml",
                    r#"<container><rootfiles><rootfile full-path="OEBPS/book.opf"/></rootfiles></container>"#,
                ),
                (
                    "OEBPS/book.opf",
                    r#"<package><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml"/><item id="pro" href="prologue.xhtml" media-type="application/xhtml+xml"/><item id="one" href="chapter01.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="nav"/><itemref idref="pro"/><itemref idref="one"/></spine></package>"#,
                ),
                (
                    "OEBPS/nav.xhtml",
                    r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li>Prologue</li></ol></nav></body></html>"#,
                ),
                (
                    "OEBPS/prologue.xhtml",
                    "<html><body><h1>Prologue</h1><p>Il y avait un temps.</p></body></html>",
                ),
                (
                    "OEBPS/chapter01.xhtml",
                    "<html><body><h1>Chapitre premier</h1><p>Le récit.</p></body></html>",
                ),
            ],
        );
        let chapters = read_epub(&path).unwrap();
        let titles: Vec<_> = chapters.iter().map(|chapter| chapter.title.as_str()).collect();
        assert_eq!(titles, ["Prologue", "Chapitre premier"]);
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    #[test]
    fn docx_splits_on_the_top_heading_and_keeps_italic_runs() {
        let path = zip_fixture(
            "book.docx",
            &[
                (
                    "word/styles.xml",
                    r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="T1"><w:name w:val="Titre 1"/></w:style></w:styles>"#,
                ),
                (
                    "word/document.xml",
                    r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Avant-propos libre</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="T1"/></w:pPr><w:r><w:t>Premier</w:t></w:r></w:p><w:p><w:r><w:t xml:space="preserve">Il </w:t></w:r><w:r><w:rPr><w:i/></w:rPr><w:t>pensa</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Section</w:t></w:r></w:p><w:p><w:pPr><w:pStyle w:val="T1"/></w:pPr><w:r><w:t>Second</w:t></w:r></w:p><w:p><w:r><w:t>— Oui.</w:t></w:r></w:p></w:body></w:document>"#,
                ),
            ],
        );
        let chapters = read_docx(&path).unwrap();
        let titles: Vec<_> = chapters.iter().map(|chapter| chapter.title.as_str()).collect();
        assert_eq!(titles, ["Début", "Premier", "Second"]);
        assert!(chapters[1].blocks[1].runs.iter().any(|run| run.italic && run.text == "pensa"));
        assert_eq!(chapters[1].blocks[2].kind, "heading");
        assert_eq!(chapters[2].blocks[1].kind, "dialogue");
        std::fs::remove_dir_all(path.parent().unwrap()).unwrap();
    }

    fn bookmark(id: &str, book_id: &str) -> ReaderBookmark {
        ReaderBookmark {
            id: id.into(),
            book_id: book_id.into(),
            format: "epub".into(),
            chapter: 2,
            chapter_title: "Titre".into(),
            position: 0.4,
            excerpt: "Extrait".into(),
            created_at: 1,
        }
    }

    #[test]
    fn replaces_only_the_requested_books_bookmarks_and_sanitizes_values() {
        let file = BookmarkFile {
            bookmarks: vec![bookmark("a", "livre-1"), bookmark("b", "livre-2")],
        };
        let mut long = bookmark("c", "livre-1");
        long.excerpt = "x".repeat(1000);
        long.position = f64::NAN;
        let file = replace_book_bookmarks(file, "livre-1", vec![long]).unwrap();
        assert_eq!(file.bookmarks.len(), 2);
        assert_eq!(file.bookmarks[0].id, "b");
        assert_eq!(file.bookmarks[1].excerpt.chars().count(), MAX_EXCERPT_CHARS);
        assert_eq!(file.bookmarks[1].position, 0.0);
        assert!(replace_book_bookmarks(file, "livre-1", vec![bookmark("d", "livre-2")]).is_err());
    }

    #[test]
    fn bookmark_file_round_trips_atomically() {
        let root = std::env::temp_dir().join(format!(
            "aldus-bookmarks-{}-{}",
            std::process::id(),
            now_seconds()
        ));
        std::fs::create_dir_all(&root).unwrap();
        let path = root.join("bookmarks.json");
        assert!(read_bookmark_file(&path).unwrap().bookmarks.is_empty());
        let file = replace_book_bookmarks(BookmarkFile::default(), "livre-1", vec![bookmark("a", "livre-1")]).unwrap();
        crate::storage::atomic_write(&path, &serde_json::to_vec_pretty(&file).unwrap()).unwrap();
        let stored = read_bookmark_file(&path).unwrap();
        assert_eq!(stored.bookmarks[0].chapter_title, "Titre");
        assert!(!root.join("bookmarks.json.tmp").exists());
        std::fs::remove_dir_all(root).unwrap();
    }
}
