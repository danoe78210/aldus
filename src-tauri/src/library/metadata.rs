use super::{Book, FileStatistics, LibraryFile};
use std::collections::BTreeSet;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use std::time::UNIX_EPOCH;
use zip::ZipArchive;

pub(super) fn parse_xml(text: &str) -> Option<roxmltree::Document<'_>> {
    roxmltree::Document::parse_with_options(
        text,
        roxmltree::ParsingOptions {
            allow_dtd: true,
            nodes_limit: 100_000,
        },
    )
    .ok()
}

pub(super) fn xml_entry(archive: &mut ZipArchive<File>, name: &str) -> Option<String> {
    let mut entry = archive.by_name(name).ok()?;
    if entry.size() > 8 * 1024 * 1024 {
        return None;
    }
    let mut text = String::new();
    entry.read_to_string(&mut text).ok()?;
    Some(text)
}

fn positive_number(text: &str) -> Option<u32> {
    text.trim()
        .split_whitespace()
        .next()?
        .parse::<u32>()
        .ok()
        .filter(|value| *value > 0)
}

fn estimated_pages(word_count: u32) -> Option<u32> {
    u32::try_from((u64::from(word_count) + 249) / 250).ok()
}

fn text_word_count(text: &str) -> Option<u32> {
    u32::try_from(text.split_whitespace().count()).ok()
}

pub(super) fn archive_path(origin: &str, href: &str) -> String {
    let mut parts: Vec<&str> = origin
        .rsplit_once('/')
        .map(|(base, _)| base.split('/').collect())
        .unwrap_or_default();
    for part in href.split(['#', '?']).next().unwrap_or("").split('/') {
        match part {
            "" | "." => {}
            ".." => {
                parts.pop();
            }
            _ => parts.push(part),
        }
    }
    parts.join("/")
}

pub(super) fn excluded_section(path: &str, document: &roxmltree::Document<'_>) -> bool {
    let stem = Path::new(path)
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("")
        .to_lowercase();
    [
        "title",
        "titlepage",
        "title-page",
        "cover",
        "toc",
        "nav",
        "copyright",
        "colophon",
        "dedication",
        "foreword",
        "preface",
        "introduction",
        "prologue",
        "epilogue",
        "afterword",
        "contents",
        "part",
        "acknowledgements",
        "appendix",
        "glossary",
        "index",
    ]
    .contains(&stem.as_str())
        || document.descendants().any(|node| {
            (node.has_tag_name("body") || node.has_tag_name("section"))
                && node
                    .attribute(("http://www.idpf.org/2007/ops", "type"))
                    .is_some_and(|types| {
                        types.split_whitespace().any(|kind| {
                            [
                                "frontmatter",
                                "backmatter",
                                "cover",
                                "toc",
                                "titlepage",
                                "copyright-page",
                                "part",
                                "appendix",
                                "glossary",
                                "index",
                            ]
                            .contains(&kind)
                        })
                    })
        })
}

fn markdown_chapters(directory: &Path) -> Option<u32> {
    let mut count = 0_u32;
    for entry in std::fs::read_dir(directory).ok()? {
        let entry = entry.ok()?;
        if entry.file_name().to_string_lossy().starts_with('.') {
            continue;
        }
        let kind = entry.file_type().ok()?;
        if kind.is_dir() {
            count = count.checked_add(markdown_chapters(&entry.path())?)?;
        } else if kind.is_file()
            && entry
                .path()
                .extension()
                .and_then(|extension| extension.to_str())
                .is_some_and(|extension| extension.eq_ignore_ascii_case("md"))
        {
            count = count.checked_add(1)?;
        }
    }
    Some(count)
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
struct EpubStatistics {
    page_count: Option<u32>,
    chapter_count: Option<u32>,
    word_count: Option<u32>,
}

fn epub_counts(path: &Path) -> Option<EpubStatistics> {
    let mut archive = ZipArchive::new(File::open(path).ok()?).ok()?;
    let container = xml_entry(&mut archive, "META-INF/container.xml")?;
    let container = parse_xml(&container)?;
    let package_path = container
        .descendants()
        .find(|node| node.has_tag_name("rootfile"))?
        .attribute("full-path")?;
    let package = xml_entry(&mut archive, package_path)?;
    let package = parse_xml(&package)?;
    let mut pages = None;
    let mut chapters = None;
    let mut words = None;
    for node in package
        .descendants()
        .filter(|node| node.has_tag_name("meta"))
    {
        let key = node
            .attribute("property")
            .or_else(|| node.attribute("name"))
            .unwrap_or("");
        let value = node
            .attribute("content")
            .or_else(|| node.text())
            .and_then(positive_number);
        match key {
            "schema:numberOfPages" | "calibre:pages" => pages = value.or(pages),
            "aldus:chapter-count" | "chapter-count" => chapters = value.or(chapters),
            "schema:wordCount" | "calibre:words" | "word-count" => words = value.or(words),
            _ => {}
        }
    }
    let mut identified_chapters = 0;
    let mut body_words = 0_u32;
    let mut readable_content = false;
    let mut spine_documents = BTreeSet::new();
    let mut navigation_documents = Vec::new();
    let mut unreadable_spine = false;
    for item in package
        .descendants()
        .filter(|node| node.has_tag_name("item"))
    {
        let href = match item.attribute("href") {
            Some(href) => href,
            None => continue,
        };
        let media_type = item.attribute("media-type");
        if media_type == Some("application/x-dtbncx+xml") {
            navigation_documents.push((archive_path(package_path, href), "src"));
            continue;
        }
        if media_type != Some("application/xhtml+xml") {
            continue;
        }
        let in_spine = package.descendants().any(|node| {
            node.has_tag_name("itemref")
                && node.attribute("idref") == item.attribute("id")
                && node.attribute("linear") != Some("no")
        });
        let path = archive_path(package_path, href);
        let text = match xml_entry(&mut archive, &path) {
            Some(text) => text,
            None => {
                unreadable_spine |= in_spine;
                continue;
            }
        };
        let document = match parse_xml(&text) {
            Some(document) => document,
            None => {
                unreadable_spine |= in_spine;
                continue;
            }
        };
        if item.attribute("properties").is_some_and(|properties| {
            properties
                .split_whitespace()
                .any(|property| property == "nav")
        }) {
            navigation_documents.push((path.clone(), "href"));
            if pages.is_none() {
                pages = document
                    .descendants()
                    .find(|node| {
                        node.has_tag_name("nav")
                            && node
                                .attribute(("http://www.idpf.org/2007/ops", "type"))
                                .is_some_and(|value| {
                                    value.split_whitespace().any(|value| value == "page-list")
                                })
                    })
                    .and_then(|nav| {
                        u32::try_from(
                            nav.descendants()
                                .filter(|node| node.has_tag_name("a"))
                                .count(),
                        )
                        .ok()
                    })
                    .filter(|count| *count > 0);
            }
            continue;
        }
        if in_spine {
            let excluded = excluded_section(&path, &document);
            if !excluded {
                spine_documents.insert(path);
                let count = document
                    .descendants()
                    .filter(|node| {
                        node.is_text()
                            && node
                                .ancestors()
                                .any(|ancestor| ancestor.has_tag_name("body"))
                    })
                    .filter_map(|node| node.text())
                    .map(str::split_whitespace)
                    .map(Iterator::count)
                    .sum::<usize>();
                body_words = body_words.checked_add(u32::try_from(count).ok()?)?;
                readable_content = true;
            }
            if !excluded {
                identified_chapters += document
                    .descendants()
                    .filter(|node| {
                        node.attribute(("http://www.idpf.org/2007/ops", "type"))
                            .is_some_and(|value| {
                                value.split_whitespace().any(|value| value == "chapter")
                            })
                            || node.attribute("role").is_some_and(|value| {
                                value.split_whitespace().any(|value| value == "doc-chapter")
                            })
                    })
                    .count() as u32;
            }
        }
    }
    let mut navigation_targets = BTreeSet::new();
    for (path, attribute) in navigation_documents {
        if let Some(text) = xml_entry(&mut archive, &path) {
            if let Some(document) = parse_xml(&text) {
                for node in document.descendants().filter(|node| {
                    if attribute == "src" {
                        return node.has_tag_name("content")
                            && node
                                .ancestors()
                                .any(|ancestor| ancestor.has_tag_name("navMap"));
                    }
                    node.has_tag_name("a")
                        && node.ancestors().any(|ancestor| {
                            ancestor.has_tag_name("nav")
                                && ancestor
                                    .attribute(("http://www.idpf.org/2007/ops", "type"))
                                    .is_some_and(|types| {
                                        types.split_whitespace().any(|kind| kind == "toc")
                                    })
                        })
                }) {
                    if let Some(href) = node.attribute(attribute) {
                        let target = archive_path(&path, href);
                        if spine_documents.contains(&target) {
                            navigation_targets.insert(target);
                        }
                    }
                }
            }
        }
    }
    let fallback_count = if !navigation_targets.is_empty() {
        Some(navigation_targets.len() as u32)
    } else if !unreadable_spine && !spine_documents.is_empty() {
        Some(spine_documents.len() as u32)
    } else {
        None
    };
    let chapter_count = chapters
        .or((identified_chapters > 0).then_some(identified_chapters))
        .or(fallback_count);
    let word_count = words.or(readable_content.then_some(body_words));
    Some(EpubStatistics {
        page_count: pages.or_else(|| word_count.and_then(estimated_pages)),
        chapter_count,
        word_count,
    })
}

pub(super) fn word_attribute<'node, 'input: 'node>(
    node: roxmltree::Node<'node, 'input>,
    name: &str,
) -> Option<&'node str> {
    node.attributes()
        .find(|attribute| {
            attribute.name() == name
                && matches!(
                    attribute.namespace(),
                    Some(
                        "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
                            | "http://purl.oclc.org/ooxml/wordprocessingml/main"
                    )
                )
        })
        .map(|attribute| attribute.value())
}

pub(super) fn first_heading(style: &str) -> bool {
    let name: String = style
        .chars()
        .filter(|character| !character.is_whitespace() && !['_', '-'].contains(character))
        .flat_map(char::to_lowercase)
        .collect();
    matches!(name.as_str(), "heading1" | "titre1")
}

fn docx_statistics(path: &Path) -> FileStatistics {
    let mut statistics = FileStatistics::default();
    let mut archive = match File::open(path)
        .ok()
        .and_then(|file| ZipArchive::new(file).ok())
    {
        Some(archive) => archive,
        None => return statistics,
    };
    if let Some(text) = xml_entry(&mut archive, "docProps/app.xml") {
        if let Some(document) = parse_xml(&text) {
            statistics.page_count = document
                .descendants()
                .find(|node| node.has_tag_name("Pages"))
                .and_then(|node| node.text())
                .and_then(positive_number);
            statistics.word_count = document
                .descendants()
                .find(|node| node.has_tag_name("Words"))
                .and_then(|node| node.text())
                .and_then(|text| text.trim().parse().ok());
        }
    }
    if let Some(text) = xml_entry(&mut archive, "docProps/core.xml") {
        if let Some(document) = parse_xml(&text) {
            statistics.metadata_modified = document
                .descendants()
                .find(|node| node.has_tag_name(("http://purl.org/dc/terms/", "modified")))
                .and_then(|node| node.text())
                .map(|text| text.trim().to_string());
        }
    }
    let mut heading_styles = BTreeSet::new();
    if let Some(text) = xml_entry(&mut archive, "word/styles.xml") {
        if let Some(document) = parse_xml(&text) {
            for style in document
                .descendants()
                .filter(|node| node.has_tag_name("style"))
            {
                if style.children().any(|node| {
                    node.has_tag_name("name")
                        && word_attribute(node, "val").is_some_and(first_heading)
                }) {
                    if let Some(id) = word_attribute(style, "styleId") {
                        heading_styles.insert(id.to_string());
                    }
                }
            }
        }
    }
    if let Some(text) = xml_entry(&mut archive, "word/document.xml") {
        if let Some(document) = parse_xml(&text) {
            if statistics.word_count.is_none() {
                let words = document
                    .descendants()
                    .filter(|node| node.has_tag_name("t"))
                    .filter_map(|node| node.text())
                    .filter_map(text_word_count)
                    .try_fold(0_u32, u32::checked_add);
                statistics.word_count = words;
            }
            statistics.chapter_count = u32::try_from(
                document
                    .descendants()
                    .filter(|node| {
                        node.has_tag_name("p")
                            && node
                                .children()
                                .filter(|node| node.has_tag_name("pPr"))
                                .flat_map(|node| node.children())
                                .any(|node| {
                                    node.has_tag_name("pStyle")
                                        && word_attribute(node, "val").is_some_and(|style| {
                                            first_heading(style) || heading_styles.contains(style)
                                        })
                                })
                    })
                    .count(),
            )
            .ok();
        }
    }
    if statistics.page_count.is_none() {
        statistics.page_count = statistics.word_count.and_then(estimated_pages);
    }
    statistics
}

fn file_statistics(file: &LibraryFile, previous: Option<&FileStatistics>) -> FileStatistics {
    let metadata = std::fs::metadata(&file.path).ok();
    let file_size = metadata.as_ref().map(|metadata| metadata.len());
    let last_modified = metadata
        .and_then(|metadata| metadata.modified().ok())
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok());
    if let Some(previous) = previous {
        let calculated = match file.format.as_str() {
            "pdf" => previous.page_count.is_some(),
            "epub" | "docx" => previous.page_count.is_some() && previous.chapter_count.is_some(),
            _ => false,
        };
        if last_modified.is_some()
            && last_modified == previous.last_modified
            && file_size == previous.file_size
            && calculated
        {
            return previous.clone();
        }
    }
    let mut statistics = match file.format.as_str() {
        "docx" => docx_statistics(Path::new(&file.path)),
        "epub" => {
            let counts = epub_counts(Path::new(&file.path));
            FileStatistics {
                page_count: counts.and_then(|counts| counts.page_count),
                chapter_count: counts.and_then(|counts| counts.chapter_count),
                word_count: counts.and_then(|counts| counts.word_count),
                ..FileStatistics::default()
            }
        }
        "pdf" => FileStatistics {
            page_count: lopdf::Document::load(&file.path)
                .ok()
                .and_then(|document| u32::try_from(document.get_pages().len()).ok())
                .filter(|count| *count > 0),
            ..FileStatistics::default()
        },
        _ => FileStatistics::default(),
    };
    statistics.file_size = file_size;
    statistics.last_modified = last_modified;
    statistics
}

pub(super) fn refresh(book: &mut Book) {
    let source_count = book
        .source_directory
        .as_deref()
        .and_then(|directory| markdown_chapters(Path::new(directory)));
    let previous = std::mem::take(&mut book.file_statistics);
    for file in &book.files {
        book.file_statistics.insert(
            file.path.clone(),
            file_statistics(file, previous.get(&file.path)),
        );
    }
    let count_for = |format: &str, chapter: bool| {
        book.files
            .iter()
            .filter(|file| file.format == format)
            .find_map(|file| {
                book.file_statistics.get(&file.path).and_then(|statistics| {
                    if chapter {
                        statistics.chapter_count
                    } else {
                        statistics.page_count
                    }
                })
            })
    };
    let pdf_pages = count_for("pdf", false);
    let epub_pages = count_for("epub", false);
    let docx_pages = count_for("docx", false);
    let epub_chapters = count_for("epub", true);
    let chapter_count = source_count
        .or(epub_chapters)
        .or_else(|| count_for("docx", true));
    for file in book.files.iter().filter(|file| file.format == "pdf") {
        if let Some(statistics) = book.file_statistics.get_mut(&file.path) {
            statistics.chapter_count = source_count.or(epub_chapters);
        }
    }
    let modified = book
        .file_statistics
        .values()
        .filter_map(|statistics| statistics.last_modified)
        .max();
    if modified.is_some() {
        book.page_count = pdf_pages.or(epub_pages).or(docx_pages);
        book.last_modified = modified;
    }
    book.chapter_count = chapter_count.unwrap_or_default();
    book.chapter_count_available = chapter_count.is_some();
}

#[cfg(test)]
mod tests {
    use super::{docx_statistics, epub_counts, refresh, File, Path, UNIX_EPOCH};
    use crate::library::{Book, FileStatistics, LibraryFile};
    use lopdf::{dictionary, Document, Object};
    use std::io::Write;

    fn temp_directory() -> std::path::PathBuf {
        static SEQUENCE: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(0);
        let root = std::env::temp_dir().join(format!(
            "aldus-stats-{}-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos(),
            SEQUENCE.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
        ));
        std::fs::create_dir_all(&root).unwrap();
        root
    }

    fn write_epub(path: &Path, metadata: &str) {
        let mut archive = zip::ZipWriter::new(File::create(path).unwrap());
        let entries = [
            ("META-INF/container.xml", r#"<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>"#.to_string()),
            ("OPS/book.opf", format!(r#"<package><metadata>{metadata}</metadata><manifest><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/><item id="appendix" href="appendix.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="chapter"/><itemref idref="appendix"/></spine></package>"#)),
            ("OPS/chapter.xhtml", r#"<!DOCTYPE html><html xmlns:epub="http://www.idpf.org/2007/ops"><body><section epub:type="chapter"><h1>Chapitre 1</h1></section><section role="doc-chapter"><h1>Chapitre 2</h1></section></body></html>"#.to_string()),
            ("OPS/appendix.xhtml", "<html><body><h1>Annexe</h1></body></html>".to_string()),
        ];
        for (name, text) in entries {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    }

    fn write_pdf(path: &Path, count: u32) {
        let mut document = Document::with_version("1.5");
        let pages_id = document.new_object_id();
        let mut children = Vec::new();
        for _ in 0..count {
            let page = document.add_object(dictionary! {"Type" => "Page", "Parent" => pages_id, "MediaBox" => vec![0.into(), 0.into(), 100.into(), 100.into()]});
            children.push(Object::Reference(page));
        }
        document.objects.insert(
            pages_id,
            Object::Dictionary(
                dictionary! {"Type" => "Pages", "Kids" => children, "Count" => count},
            ),
        );
        let catalog = document.add_object(dictionary! {"Type" => "Catalog", "Pages" => pages_id});
        document.trailer.set("Root", catalog);
        document.save(path).unwrap();
    }

    fn write_docx(path: &Path, pages: u32, paragraphs: &str) {
        let mut archive = zip::ZipWriter::new(File::create(path).unwrap());
        let entries = [
            ("docProps/app.xml", format!("<Properties><Pages>{pages}</Pages><Words>4200</Words></Properties>")),
            ("docProps/core.xml", r#"<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dcterms="http://purl.org/dc/terms/"><dcterms:modified>2020-01-01T00:00:00Z</dcterms:modified></cp:coreProperties>"#.to_string()),
            ("word/styles.xml", r#"<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:style w:styleId="ChapitreLocal"><w:name w:val="Titre 1"/></w:style></w:styles>"#.to_string()),
            ("word/document.xml", format!(r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>{paragraphs}</w:body></w:document>"#)),
        ];
        for (name, text) in entries {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    }

    #[test]
    fn reads_docx_properties_and_localized_first_level_headings() {
        let root = temp_directory();
        let docx = root.join("book.docx");
        write_docx(
            &docx,
            12,
            r#"<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="ChapitreLocal"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr></w:p>"#,
        );
        let statistics = docx_statistics(&docx);
        assert_eq!(statistics.page_count, Some(12));
        assert_eq!(statistics.word_count, Some(4200));
        assert_eq!(statistics.chapter_count, Some(3));
        assert_eq!(
            statistics.metadata_modified.as_deref(),
            Some("2020-01-01T00:00:00Z")
        );
        let mut book = Book {
            files: vec![LibraryFile {
                path: docx.to_string_lossy().into(),
                format: "docx".into(),
            }],
            ..Book::default()
        };
        refresh(&mut book);
        assert_eq!(book.page_count, Some(12));
        assert_eq!(book.chapter_count, 3);
        assert_eq!(book.primary_file().unwrap().format, "docx");
        let actual_modified = std::fs::metadata(&docx)
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        assert_eq!(book.last_modified, Some(actual_modified));
        let json = serde_json::to_value(&book).unwrap();
        assert_eq!(
            json["fileStatistics"][docx.to_str().unwrap()]["wordCount"],
            4200
        );
        std::fs::write(&docx, b"not a zip archive").unwrap();
        assert!(docx_statistics(&docx).chapter_count.is_none());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn keeps_docx_and_pdf_statistics_separate_and_refreshes_each_file() {
        let root = temp_directory();
        let docx = root.join("book.docx");
        let pdf = root.join("book.pdf");
        write_docx(
            &docx,
            12,
            r#"<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p>"#,
        );
        write_pdf(&pdf, 49);
        let now = std::time::SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        File::options()
            .write(true)
            .open(&pdf)
            .unwrap()
            .set_modified(UNIX_EPOCH + std::time::Duration::from_millis(now + 10_000))
            .unwrap();
        let mut book = Book {
            files: vec![
                LibraryFile {
                    path: pdf.to_string_lossy().into(),
                    format: "pdf".into(),
                },
                LibraryFile {
                    path: docx.to_string_lossy().into(),
                    format: "docx".into(),
                },
            ],
            ..Book::default()
        };
        refresh(&mut book);
        let aggregate_modified = book.last_modified;
        assert_eq!(
            book.file_statistics[docx.to_str().unwrap()].page_count,
            Some(12)
        );
        assert_eq!(
            book.file_statistics[pdf.to_str().unwrap()].page_count,
            Some(49)
        );
        write_docx(
            &docx,
            17,
            r#"<w:p><w:pPr><w:pStyle w:val="Titre1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p>"#,
        );
        File::options()
            .write(true)
            .open(&docx)
            .unwrap()
            .set_modified(UNIX_EPOCH + std::time::Duration::from_millis(now + 2000))
            .unwrap();
        refresh(&mut book);
        assert_eq!(book.last_modified, aggregate_modified);
        assert_eq!(
            book.file_statistics[docx.to_str().unwrap()].page_count,
            Some(17)
        );
        assert_eq!(
            book.file_statistics[docx.to_str().unwrap()].chapter_count,
            Some(2)
        );
        assert_eq!(
            book.file_statistics[pdf.to_str().unwrap()].page_count,
            Some(49)
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_pdf_pages_epub_chapters_and_refreshes_changed_documents() {
        let root = temp_directory();
        let pdf = root.join("book.pdf");
        let epub = root.join("book.epub");
        write_pdf(&pdf, 3);
        write_epub(&epub, "");
        let mut book = Book {
            files: vec![
                LibraryFile {
                    path: pdf.to_string_lossy().into(),
                    format: "pdf".into(),
                },
                LibraryFile {
                    path: epub.to_string_lossy().into(),
                    format: "epub".into(),
                },
            ],
            ..Book::default()
        };
        refresh(&mut book);
        assert_eq!(book.page_count, Some(3));
        assert_eq!(book.chapter_count, 2);
        assert!(book.chapter_count_available);
        let modified = book.last_modified.unwrap();
        assert_eq!(book.primary_file().unwrap().format, "epub");
        write_pdf(&pdf, 4);
        File::options()
            .write(true)
            .open(&pdf)
            .unwrap()
            .set_modified(UNIX_EPOCH + std::time::Duration::from_millis(modified + 2000))
            .unwrap();
        refresh(&mut book);
        assert_eq!(book.page_count, Some(4));
        assert!(book.last_modified.unwrap() > modified);
        let value = serde_json::to_value(&book).unwrap();
        assert_eq!(value["pageCount"], 4);
        assert_eq!(value["chapterCount"], 2);
        assert!(value["lastModified"].is_u64());
        std::fs::remove_file(epub).unwrap();
        assert_eq!(book.primary_file().unwrap().format, "pdf");
        std::fs::remove_dir_all(root).unwrap();
        assert!(book.primary_file().is_none());
    }

    fn write_untagged_epub(path: &Path, navigation: &str) {
        let words_250 = std::iter::repeat("mot")
            .take(250)
            .collect::<Vec<_>>()
            .join(" ");
        let words_251 = std::iter::repeat("mot")
            .take(251)
            .collect::<Vec<_>>()
            .join(" ");
        let navigation_item = match navigation {
            "nav" => {
                r#"<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>"#
            }
            "ncx" => r#"<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>"#,
            _ => "",
        };
        let mut archive = zip::ZipWriter::new(File::create(path).unwrap());
        let entries = [
            ("META-INF/container.xml", r#"<container><rootfiles><rootfile full-path="OPS/book.opf"/></rootfiles></container>"#.to_string()),
            ("OPS/book.opf", format!(r#"<package><manifest>{navigation_item}<item id="cover" href="cover.xhtml" media-type="application/xhtml+xml"/><item id="title" href="title.xhtml" media-type="application/xhtml+xml"/><item id="copyright" href="copyright.xhtml" media-type="application/xhtml+xml"/><item id="one" href="chapter1.xhtml" media-type="application/xhtml+xml"/><item id="two" href="chapter2.xhtml" media-type="application/xhtml+xml"/><item id="appendix" href="appendix.xhtml" media-type="application/xhtml+xml"/></manifest><spine><itemref idref="cover"/><itemref idref="title"/><itemref idref="copyright"/><itemref idref="one"/><itemref idref="two"/><itemref idref="appendix"/></spine></package>"#)),
            ("OPS/cover.xhtml", r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><section epub:type="chapter"><p>Illustration de couverture</p></section></body></html>"#.to_string()),
            ("OPS/title.xhtml", r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><section epub:type="chapter"><h1>Mon livre</h1></section></body></html>"#.to_string()),
            ("OPS/copyright.xhtml", r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><section epub:type="chapter"><p>Mentions légales</p></section></body></html>"#.to_string()),
            ("OPS/chapter1.xhtml", format!("<html><body><p>{words_250}</p></body></html>")),
            ("OPS/chapter2.xhtml", format!("<html><body><p>{words_251}</p></body></html>")),
            ("OPS/appendix.xhtml", r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><section epub:type="chapter"><h1>Annexe</h1><p>Annexe non comptée</p></section></body></html>"#.to_string()),
            ("OPS/nav.xhtml", r#"<html xmlns:epub="http://www.idpf.org/2007/ops"><body><nav epub:type="toc"><ol><li><a href="cover.xhtml">Couverture</a></li><li><a href="title.xhtml">Titre</a></li><li><a href="copyright.xhtml">Mentions</a></li><li><a href="chapter1.xhtml">Un</a><ol><li><a href="chapter1.xhtml#section">Section</a></li></ol></li><li><a href="chapter2.xhtml">Deux</a></li><li><a href="appendix.xhtml">Annexe</a></li></ol></nav></body></html>"#.to_string()),
            ("OPS/toc.ncx", r#"<ncx><navMap><navPoint><content src="cover.xhtml"/></navPoint><navPoint><content src="title.xhtml"/></navPoint><navPoint><content src="copyright.xhtml"/></navPoint><navPoint><content src="chapter1.xhtml"/><navPoint><content src="chapter1.xhtml#section"/></navPoint></navPoint><navPoint><content src="chapter2.xhtml"/></navPoint><navPoint><content src="appendix.xhtml"/></navPoint></navMap></ncx>"#.to_string()),
        ];
        for (name, text) in entries {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
    }

    #[test]
    fn counts_untagged_epub_chapters_using_nav_ncx_or_spine_without_duplicates() {
        let root = temp_directory();
        let epub = root.join("book.epub");
        for navigation in ["nav", "ncx", "spine"] {
            write_untagged_epub(&epub, navigation);
            let statistics = epub_counts(&epub).unwrap();
            assert_eq!(statistics.chapter_count, Some(2), "{navigation}");
            assert_eq!(statistics.word_count, Some(501), "{navigation}");
            assert_eq!(statistics.page_count, Some(3), "{navigation}");
        }
        let docx = root.join("book.docx");
        write_docx(
            &docx,
            3,
            r#"<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Titre 1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr></w:p>"#,
        );
        assert_eq!(docx_statistics(&docx).chapter_count, Some(2));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn fills_missing_cached_chapters_without_changing_pdf_page_count() {
        let root = temp_directory();
        let epub = root.join("book.epub");
        let pdf = root.join("book.pdf");
        write_untagged_epub(&epub, "ncx");
        write_pdf(&pdf, 49);
        let mut book = Book {
            files: vec![
                LibraryFile {
                    path: epub.to_string_lossy().into(),
                    format: "epub".into(),
                },
                LibraryFile {
                    path: pdf.to_string_lossy().into(),
                    format: "pdf".into(),
                },
            ],
            ..Book::default()
        };
        refresh(&mut book);
        let modified = book.last_modified;
        book.chapter_count = 0;
        book.chapter_count_available = false;
        refresh(&mut book);
        assert_eq!(book.chapter_count, 2);
        assert!(book.chapter_count_available);
        assert_eq!(book.page_count, Some(49));
        assert_eq!(book.last_modified, modified);
        let legacy: Book = serde_json::from_str(
            r#"{"id":"old","title":"Livre","shelfId":"in_progress","chapterCount":null}"#,
        )
        .unwrap();
        assert_eq!(legacy.chapter_count, 0);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recalculates_missing_epub_page_estimate_in_an_older_file_cache() {
        let root = temp_directory();
        let epub = root.join("book.epub");
        write_untagged_epub(&epub, "ncx");
        let modified = std::fs::metadata(&epub)
            .unwrap()
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        let size = std::fs::metadata(&epub).unwrap().len();
        let mut book = Book {
            files: vec![LibraryFile {
                path: epub.to_string_lossy().into(),
                format: "epub".into(),
            }],
            file_statistics: [(
                epub.to_string_lossy().into(),
                FileStatistics {
                    chapter_count: Some(2),
                    last_modified: Some(modified),
                    file_size: Some(size),
                    ..FileStatistics::default()
                },
            )]
            .into(),
            ..Book::default()
        };
        refresh(&mut book);
        let statistics = &book.file_statistics[epub.to_str().unwrap()];
        assert_eq!(statistics.word_count, Some(501));
        assert_eq!(statistics.page_count, Some(3));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn recounts_markdown_sources_even_without_an_export_timestamp_change() {
        let root = temp_directory();
        std::fs::create_dir_all(root.join("partie")).unwrap();
        std::fs::create_dir_all(root.join(".cache")).unwrap();
        std::fs::write(root.join("un.md"), "# Un").unwrap();
        std::fs::write(root.join("partie/deux.MD"), "# Deux").unwrap();
        std::fs::write(root.join(".cache/ignore.md"), "cache").unwrap();
        std::fs::write(root.join("notes.txt"), "notes").unwrap();
        let mut book = Book {
            source_directory: Some(root.to_string_lossy().into()),
            page_count: Some(49),
            ..Book::default()
        };
        refresh(&mut book);
        assert_eq!(book.chapter_count, 2);
        assert!(book.chapter_count_available);
        std::fs::write(root.join("trois.md"), "# Trois").unwrap();
        refresh(&mut book);
        assert_eq!(book.chapter_count, 3);
        assert_eq!(book.page_count, Some(49));
        std::fs::remove_file(root.join("trois.md")).unwrap();
        refresh(&mut book);
        assert_eq!(book.chapter_count, 2);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_explicit_epub_page_metadata_and_tolerates_unreadable_files() {
        let root = temp_directory();
        let epub = root.join("book.epub");
        write_epub(&epub, r#"<meta property="schema:numberOfPages">240</meta>"#);
        assert_eq!(epub_counts(&epub).unwrap().page_count, Some(240));
        assert_eq!(epub_counts(&epub).unwrap().chapter_count, Some(2));
        let mut book = Book {
            files: vec![LibraryFile {
                path: epub.to_string_lossy().into(),
                format: "epub".into(),
            }],
            ..Book::default()
        };
        refresh(&mut book);
        assert_eq!(book.page_count, Some(240));
        std::fs::write(&epub, b"invalid archive").unwrap();
        File::options()
            .write(true)
            .open(&epub)
            .unwrap()
            .set_modified(
                UNIX_EPOCH + std::time::Duration::from_millis(book.last_modified.unwrap() + 2000),
            )
            .unwrap();
        refresh(&mut book);
        assert!(book.page_count.is_none());
        assert_eq!(book.chapter_count, 0);
        assert!(!book.chapter_count_available);
        assert!(book.last_modified.is_some());
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimates_docx_pages_from_words_when_word_has_no_valid_page_count() {
        let root = temp_directory();
        let docx = root.join("book.docx");
        write_docx(
            &docx,
            0,
            r#"<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr></w:p><w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr></w:p>"#,
        );
        let statistics = docx_statistics(&docx);
        assert_eq!(statistics.word_count, Some(4200));
        assert_eq!(statistics.page_count, Some(17));
        assert_eq!(statistics.chapter_count, Some(1));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn counts_docx_document_text_when_app_properties_do_not_contain_word_count() {
        let root = temp_directory();
        let docx = root.join("sans-proprietes.docx");
        let words = std::iter::repeat("mot")
            .take(251)
            .collect::<Vec<_>>()
            .join(" ");
        let mut archive = zip::ZipWriter::new(File::create(&docx).unwrap());
        for (name, text) in [
            (
                "docProps/app.xml",
                "<Properties><Pages>0</Pages></Properties>".to_string(),
            ),
            (
                "word/document.xml",
                format!(
                    r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>{words}</w:t></w:r></w:p></w:body></w:document>"#
                ),
            ),
        ] {
            archive
                .start_file(name, zip::write::SimpleFileOptions::default())
                .unwrap();
            archive.write_all(text.as_bytes()).unwrap();
        }
        archive.finish().unwrap();
        let statistics = docx_statistics(&docx);
        assert_eq!(statistics.word_count, Some(251));
        assert_eq!(statistics.page_count, Some(2));
        assert_eq!(statistics.chapter_count, Some(1));
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn estimates_pages_with_ceiling_at_the_250_word_boundary() {
        use super::estimated_pages;
        assert_eq!(estimated_pages(0), Some(0));
        assert_eq!(estimated_pages(1), Some(1));
        assert_eq!(estimated_pages(250), Some(1));
        assert_eq!(estimated_pages(251), Some(2));
        assert_eq!(estimated_pages(501), Some(3));
    }
}
