use regex::Regex;
use serde::{Deserialize, Serialize};

use super::rules::{PatternType, RuleKind, StylometryRule};
use super::scorer::base_risk;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StylometryIssue {
    pub id: String,
    pub rule_id: String,
    pub original_text: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub category: String,
    pub explanation: String,
    pub suggested_rewrite: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StylometryReport {
    pub chapter_id: String,
    pub ai_risk_percent: u8,
    pub burstiness_score: f32,
    pub lexical_richness: f32,
    pub issues_count: usize,
    pub issues: Vec<StylometryIssue>,
}

#[derive(Clone)]
struct Span {
    start: usize,
    end: usize,
    words: usize,
}

fn masked_frontmatter(text: &str) -> String {
    if !text.starts_with("---") {
        return text.to_string();
    }
    let Some(end) = text
        .match_indices("\n---")
        .map(|(index, _)| index + 4)
        .find(|end| *end == text.len() || text.as_bytes().get(*end) == Some(&b'\n'))
    else {
        return text.to_string();
    };
    text.char_indices()
        .map(|(index, character)| {
            if index < end && character != '\n' && character != '\r' {
                ' '
            } else {
                character
            }
        })
        .collect()
}

fn spans(text: &str, split: impl Fn(char) -> bool) -> Vec<Span> {
    let mut result = Vec::new();
    let mut start = 0;
    for (index, character) in text.char_indices() {
        if split(character) {
            let end = index + character.len_utf8();
            if text[start..end].trim().len() > 0 {
                result.push(Span {
                    start,
                    end,
                    words: text[start..end].split_whitespace().count(),
                });
            }
            start = end;
        }
    }
    if start < text.len() && !text[start..].trim().is_empty() {
        result.push(Span {
            start,
            end: text.len(),
            words: text[start..].split_whitespace().count(),
        });
    }
    result
}

fn paragraph_spans(text: &str) -> Vec<Span> {
    let mut result = Vec::new();
    let mut start = 0;
    let mut offset = 0;
    for line in text.split_inclusive('\n') {
        if line.trim().is_empty() {
            let paragraph = &text[start..offset];
            if !paragraph.trim().is_empty() {
                result.push(Span {
                    start,
                    end: offset,
                    words: paragraph.split_whitespace().count(),
                });
            }
            start = offset + line.len();
        }
        offset += line.len();
    }
    let paragraph = &text[start..];
    if !paragraph.trim().is_empty() {
        result.push(Span {
            start,
            end: text.len(),
            words: paragraph.split_whitespace().count(),
        });
    }
    result
}

fn matching_spans(
    text: &str,
    pattern_type: &PatternType,
    pattern: &str,
) -> Result<Vec<(usize, usize)>, String> {
    if pattern.is_empty() {
        return Ok(Vec::new());
    }
    let expression = match pattern_type {
        PatternType::Regex
        | PatternType::TriadPattern
        | PatternType::MarkdownList
        | PatternType::ChapterConclusion => Regex::new(pattern)
            .map_err(|error| format!("Expression régulière invalide « {pattern} » : {error}"))?,
        PatternType::ExactMatch | PatternType::AuthorLexicon => {
            Regex::new(&format!("(?i){}", regex::escape(pattern)))
                .map_err(|error| format!("Motif exact invalide : {error}"))?
        }
        _ => return Ok(Vec::new()),
    };
    Ok(expression
        .find_iter(text)
        .map(|found| (found.start(), found.end()))
        .collect())
}

fn capitalize_first(text: &str) -> String {
    let mut characters = text.chars();
    characters
        .next()
        .map(|first| first.to_uppercase().chain(characters).collect())
        .unwrap_or_default()
}

/// « Proposition de la Forge » pour les motifs structurels sans suggestion fixe.
fn forge_rewrite(pattern_type: &PatternType, original: &str) -> Option<String> {
    let rewrite = match pattern_type {
        PatternType::IsometryChain => {
            if let Some(index) = original.find(", ") {
                format!(
                    "{}. {}",
                    &original[..index],
                    capitalize_first(&original[index + 2..])
                )
            } else {
                let index = original.find(['.', '!', '?', '…'])?;
                let terminator = original[index..].chars().next()?.len_utf8();
                let mut rest = original[index + terminator..].trim_start().chars();
                // shortcut: lowercases the next sentence's first letter, even for proper nouns; the author reviews before applying.
                let joined: String = rest.next()?.to_lowercase().chain(rest).collect();
                format!("{} ; {joined}", original[..index].trim_end())
            }
        }
        PatternType::TriadPattern => {
            let index = original.rfind(" et ")?;
            format!("{}, {}", &original[..index], &original[index + 4..])
        }
        PatternType::MarkdownList => original.replace("**", ""),
        PatternType::ChapterConclusion => {
            let formula = Regex::new(r"(?i)^(?:en conclusion|pour conclure|en définitive|en somme|il est important de retenir que)\s*,?\s*").ok()?;
            capitalize_first(&formula.replace(original, ""))
        }
        PatternType::LexicalPredictability | PatternType::EntropyUniform => {
            forge_lexical(original)?
        }
        _ => return None,
    };
    (rewrite != original && !rewrite.trim().is_empty()).then_some(rewrite)
}

/// Forge des motifs lexicaux : retrait des intensifs parasites, sinon inversion
/// syntaxique du complément final, sinon brisure de cadence.
fn forge_lexical(original: &str) -> Option<String> {
    let pruned = Regex::new(r"(?i)\b(?:très|vraiment|réellement|totalement|complètement|simplement|extrêmement|absolument)\s+")
        .ok()?
        .replace_all(original, "")
        .into_owned();
    if pruned != original && pruned.split_whitespace().count() >= 2 {
        return Some(if original.starts_with(char::is_uppercase) {
            capitalize_first(&pruned)
        } else {
            pruned
        });
    }
    syntactic_inversion(original).or_else(|| forge_rewrite(&PatternType::IsometryChain, original))
}

/// « Il marchait lentement dans la forêt. » → « Dans la forêt, il marchait lentement. »
fn syntactic_inversion(original: &str) -> Option<String> {
    let trimmed = original.trim_end();
    let body = trimmed.trim_end_matches(['.', '!', '?', '…']);
    let terminator = &trimmed[body.len()..];
    let index = [
        " dans ",
        " sous ",
        " sur ",
        " vers ",
        " devant ",
        " derrière ",
        " avec ",
        " sans ",
        " parmi ",
        " contre ",
        " entre ",
    ]
    .iter()
    .filter_map(|preposition| body.rfind(preposition))
    .max()?;
    let head = body[..index].trim();
    let complement = body[index + 1..].trim();
    if head.split_whitespace().count() < 2
        || !(2..=6).contains(&complement.split_whitespace().count())
        || complement.contains([',', ';', ':'])
        || !head.ends_with(char::is_alphanumeric)
    {
        return None;
    }
    let first = head.split_whitespace().next()?.to_lowercase();
    let elided = first.contains(['\'', '’'])
        && matches!(
            first.split(['\'', '’']).next(),
            Some("l" | "d" | "j" | "c" | "n" | "s" | "m" | "t" | "qu")
        );
    // shortcut: only function words and elisions lose their capital; a capitalised common noun opening the sentence keeps it.
    let head = if common_word(&first) || elided {
        let mut characters = head.chars();
        characters
            .next()?
            .to_lowercase()
            .chain(characters)
            .collect()
    } else {
        head.to_string()
    };
    Some(format!(
        "{}, {head}{terminator}",
        capitalize_first(complement)
    ))
}

fn word_tokens(text: &str) -> Vec<String> {
    text.split_whitespace()
        .map(|word| {
            word.chars()
                .filter(|character| character.is_alphanumeric() || *character == '\'')
                .flat_map(char::to_lowercase)
                .collect::<String>()
        })
        .filter(|word| !word.is_empty())
        .collect()
}

/// Phrase qui incarne le mieux une mesure globale (poids maximal), en privilégiant
/// celles que la Forge sait reformuler, pour que l'alerte reste surlignable et applicable.
fn representative_sentence(
    text: &str,
    sentences: &[Span],
    weight: impl Fn(&[String]) -> f32,
) -> (usize, usize) {
    let long = sentences
        .iter()
        .filter(|sentence| sentence.words >= 4)
        .collect::<Vec<_>>();
    let candidates = if long.is_empty() {
        sentences.iter().collect()
    } else {
        long
    };
    candidates
        .into_iter()
        .map(|sentence| {
            let passage = text[sentence.start..sentence.end].trim();
            let key = (
                forge_lexical(passage).is_some(),
                weight(&word_tokens(passage)),
            );
            (key, (sentence.start, sentence.end))
        })
        .max_by(|(left, _), (right, _)| left.0.cmp(&right.0).then(left.1.total_cmp(&right.1)))
        .map(|(_, span)| span)
        .unwrap_or((0, text.len()))
}

fn issue(
    text: &str,
    byte_to_char: &[usize],
    rule: &StylometryRule,
    start: usize,
    end: usize,
    category: &str,
    explanation: &str,
    suggestion: &Option<String>,
) -> StylometryIssue {
    let original_text = text[start..end].to_string();
    let replacement = original_text.to_lowercase();
    let (RuleKind::Detection { pattern_type, .. } | RuleKind::Humanisation { pattern_type, .. }) =
        &rule.kind;
    let suggestion = suggestion
        .as_ref()
        .map(|value| {
            value.replace("{text}", &original_text).replace(
                "{connector}",
                match replacement.as_str() {
                    "en effet" => "De fait",
                    "par ailleurs" => "Dans le même temps",
                    "il convient de" => "Il faut",
                    "force est de constater" => "Nous constatons",
                    "témoigne de" => "révèle",
                    "crucial" => "essentiel",
                    "paysage" => "horizon",
                    "au-delà de" => "plus loin que",
                    _ => &original_text,
                },
            )
        })
        .or_else(|| forge_rewrite(pattern_type, &original_text));
    StylometryIssue {
        id: format!("{}-{}", rule.id, byte_to_char[start]),
        rule_id: rule.id.clone(),
        original_text: original_text.clone(),
        start_offset: byte_to_char[start],
        end_offset: byte_to_char[end],
        category: category.to_string(),
        explanation: explanation.to_string(),
        suggested_rewrite: suggestion,
    }
}

fn add_structural_issues(
    text: &str,
    byte_to_char: &[usize],
    words: &[String],
    exemptions: &[Regex],
    rules: &[StylometryRule],
    issues: &mut Vec<StylometryIssue>,
    penalty: &mut f32,
) {
    let sentences = spans(text, |character| matches!(character, '.' | '!' | '?' | '…'));
    let paragraphs = paragraph_spans(text);
    for rule in rules.iter().filter(|rule| rule.enabled) {
        let RuleKind::Detection {
            pattern_type,
            penalty_weight,
            category,
            explanation,
            default_suggestion,
            ..
        } = &rule.kind
        else {
            continue;
        };
        let mut measured: Option<String> = None;
        let targets = match pattern_type {
            PatternType::IsometryChain => {
                let mut result = Vec::new();
                let mut index = 0;
                while index + 2 < sentences.len() {
                    if (sentences[index].words as isize - sentences[index + 1].words as isize).abs()
                        <= 2
                        && (sentences[index + 1].words as isize
                            - sentences[index + 2].words as isize)
                            .abs()
                            <= 2
                    {
                        let start = sentences[index].start;
                        let mut end = sentences[index + 2].end;
                        index += 3;
                        while index < sentences.len()
                            && (sentences[index - 1].words as isize
                                - sentences[index].words as isize)
                                .abs()
                                <= 2
                        {
                            end = sentences[index].end;
                            index += 1;
                        }
                        result.push((start, end));
                    } else {
                        index += 1;
                    }
                }
                result
            }
            PatternType::ParagraphSymmetry => {
                let mut result = Vec::new();
                let mut index = 0;
                while index + 1 < paragraphs.len() {
                    let calibrated = |left: usize, right: usize| {
                        paragraphs[left].words >= 8
                            && paragraphs[right].words >= 8
                            && (paragraphs[left].words as isize - paragraphs[right].words as isize)
                                .abs()
                                <= 2
                    };
                    if calibrated(index, index + 1) {
                        let start = paragraphs[index].start;
                        let mut end = paragraphs[index + 1].end;
                        index += 2;
                        while index < paragraphs.len() && calibrated(index - 1, index) {
                            end = paragraphs[index].end;
                            index += 1;
                        }
                        result.push((start, end));
                    } else {
                        index += 1;
                    }
                }
                result
            }
            PatternType::LexicalPredictability => {
                let Some(ratio) = lexical_predictability(words, exemptions) else {
                    continue;
                };
                measured = Some(format!(
                    "Mesure du chapitre : {:.0} % de mots-outils très fréquents (seuil 62 %) ; voici la phrase la plus prévisible.",
                    ratio * 100.0
                ));
                vec![representative_sentence(text, &sentences, |passage| {
                    let eligible = passage.iter().filter(|word| !is_exempt(word, exemptions));
                    let (common, total) = eligible.fold((0, 0), |(common, total), word| {
                        (common + usize::from(common_word(word)), total + 1)
                    });
                    common as f32 / total.max(1) as f32
                })]
            }
            PatternType::EntropyUniform => {
                let Some(variation) = lexical_uniformity(words) else {
                    continue;
                };
                measured = Some(format!(
                    "Mesure du chapitre : la diversité lexicale ne varie que de {:.1} % d'une fenêtre de 100 mots à l'autre (seuil 8 %) ; voici la phrase la plus répétitive.",
                    variation * 100.0
                ));
                vec![representative_sentence(text, &sentences, |passage| {
                    let distinct = passage
                        .iter()
                        .collect::<std::collections::HashSet<_>>()
                        .len();
                    1.0 - distinct as f32 / passage.len().max(1) as f32
                })]
            }
            _ => continue,
        };
        for (start, end) in targets {
            let start = end - text[start..end].trim_start().len();
            let end = if measured.is_some() {
                start + text[start..end].trim_end().len()
            } else {
                end
            };
            let explanation = if matches!(pattern_type, PatternType::IsometryChain) {
                let lengths = sentences
                    .iter()
                    .filter(|sentence| sentence.end > start && sentence.end <= end)
                    .map(|sentence| sentence.words)
                    .collect::<Vec<_>>();
                let shortest = lengths.iter().min().copied().unwrap_or(0);
                let longest = lengths.iter().max().copied().unwrap_or(0);
                let range = if shortest == longest {
                    format!("{shortest} mots")
                } else {
                    format!("{shortest} à {longest} mots")
                };
                format!(
                    "{} phrases consécutives de longueur quasi identique ({range}). {explanation} Brisez la régularité.",
                    lengths.len()
                )
            } else if let Some(measure) = &measured {
                format!("{measure} {explanation}")
            } else {
                explanation.clone()
            };
            *penalty += (*penalty_weight).max(0.0);
            issues.push(issue(
                text,
                byte_to_char,
                rule,
                start,
                end,
                category,
                &explanation,
                default_suggestion,
            ));
        }
    }
}

fn expressive_count(text: &str) -> usize {
    let punctuation = text
        .chars()
        .filter(|character| matches!(character, '—' | ';' | '…' | '(' | ')'))
        .count();
    let short_sentences = spans(text, |character| matches!(character, '.' | '!' | '?' | '…'))
        .iter()
        .filter(|sentence| sentence.words <= 3)
        .count();
    (punctuation + short_sentences).min(20)
}

fn common_word(word: &str) -> bool {
    matches!(
        word,
        "a" | "à"
            | "ai"
            | "ainsi"
            | "alors"
            | "après"
            | "au"
            | "aucun"
            | "aussi"
            | "autre"
            | "aux"
            | "avec"
            | "avoir"
            | "ce"
            | "cela"
            | "ces"
            | "cet"
            | "cette"
            | "ceux"
            | "chaque"
            | "comme"
            | "comment"
            | "dans"
            | "de"
            | "des"
            | "du"
            | "elle"
            | "elles"
            | "en"
            | "encore"
            | "est"
            | "et"
            | "eux"
            | "fait"
            | "faire"
            | "fois"
            | "il"
            | "ils"
            | "je"
            | "la"
            | "le"
            | "les"
            | "leur"
            | "lui"
            | "ma"
            | "mais"
            | "me"
            | "même"
            | "mes"
            | "moi"
            | "mon"
            | "ne"
            | "ni"
            | "nos"
            | "notre"
            | "nous"
            | "on"
            | "ou"
            | "où"
            | "par"
            | "pas"
            | "peu"
            | "plus"
            | "pour"
            | "que"
            | "quel"
            | "quelle"
            | "qui"
            | "sa"
            | "sans"
            | "se"
            | "ses"
            | "si"
            | "son"
            | "sont"
            | "sous"
            | "sur"
            | "ta"
            | "te"
            | "tes"
            | "toi"
            | "ton"
            | "tous"
            | "tout"
            | "tu"
            | "un"
            | "une"
            | "vers"
            | "vos"
            | "votre"
            | "vous"
            | "y"
    )
}

fn lexical_exemptions(rules: &[StylometryRule]) -> Result<Vec<Regex>, String> {
    rules
        .iter()
        .filter(|rule| rule.enabled)
        .filter_map(|rule| match &rule.kind {
            RuleKind::Humanisation {
                pattern_type: PatternType::AuthorLexicon,
                pattern,
                ..
            } if !pattern.trim().is_empty() => Some(
                Regex::new(&format!("(?i){}", regex::escape(pattern.trim())))
                    .map_err(|error| format!("Lexique d'auteur invalide : {error}")),
            ),
            _ => None,
        })
        .collect()
}

fn is_exempt(word: &str, exemptions: &[Regex]) -> bool {
    exemptions
        .iter()
        .any(|expression| expression.is_match(word))
}

/// Part de mots-outils quand elle dépasse le seuil de prévisibilité.
fn lexical_predictability(words: &[String], exemptions: &[Regex]) -> Option<f32> {
    let eligible = words
        .iter()
        .filter(|word| !is_exempt(word, exemptions))
        .collect::<Vec<_>>();
    if eligible.len() < 100 {
        return None;
    }
    let common = eligible.iter().filter(|word| common_word(word)).count();
    let ratio = common as f32 / eligible.len() as f32;
    (ratio >= 0.62).then_some(ratio)
}

/// Coefficient de variation de la diversité lexicale quand il est sous le seuil d'uniformité.
fn lexical_uniformity(words: &[String]) -> Option<f32> {
    if words.len() < 300 {
        return None;
    }
    let diversities = words
        .chunks(100)
        .filter(|window| window.len() == 100)
        .map(|window| {
            window
                .iter()
                .collect::<std::collections::HashSet<_>>()
                .len() as f32
                / 100.0
        })
        .collect::<Vec<_>>();
    if diversities.len() < 3 {
        return None;
    }
    let mean = diversities.iter().sum::<f32>() / diversities.len() as f32;
    let variance = diversities
        .iter()
        .map(|value| (value - mean).powi(2))
        .sum::<f32>()
        / diversities.len() as f32;
    let variation = variance.sqrt() / mean.max(f32::EPSILON);
    (mean > 0.0 && variation < 0.08).then_some(variation)
}

fn reduce_score_by_percent(score: &mut f32, weight: f32) {
    *score -= (*score).max(0.0) * weight.clamp(0.0, 20.0) / 100.0;
}

pub fn analyze(
    chapter_id: &str,
    original: &str,
    rules: &[StylometryRule],
) -> Result<StylometryReport, String> {
    let text = masked_frontmatter(original);
    let mut byte_to_char = vec![0; text.len() + 1];
    for (char_index, (byte_index, _)) in text.char_indices().enumerate() {
        byte_to_char[byte_index] = char_index;
    }
    byte_to_char[text.len()] = text.chars().count();
    let tokens = word_tokens(&text);
    let sentence_lengths = spans(&text, |character| {
        matches!(character, '.' | '!' | '?' | '…')
    })
    .iter()
    .map(|sentence| sentence.words)
    .collect::<Vec<_>>();
    let (mut score, burstiness_score, lexical_richness) = base_risk(&sentence_lengths, &tokens);
    let mut issues = Vec::new();
    let exemptions = lexical_exemptions(rules)?;

    for rule in rules.iter().filter(|rule| rule.enabled) {
        match &rule.kind {
            RuleKind::Detection {
                pattern_type,
                pattern,
                penalty_weight,
                category,
                explanation,
                default_suggestion,
            } if matches!(
                pattern_type,
                PatternType::ExactMatch
                    | PatternType::Regex
                    | PatternType::TriadPattern
                    | PatternType::MarkdownList
                    | PatternType::ChapterConclusion
            ) => {
                for (start, end) in matching_spans(&text, pattern_type, pattern)? {
                    score += (*penalty_weight).max(0.0);
                    issues.push(issue(
                        &text,
                        &byte_to_char,
                        rule,
                        start,
                        end,
                        category,
                        explanation,
                        default_suggestion,
                    ));
                }
            }
            RuleKind::Humanisation {
                pattern_type: PatternType::PunctuationExpressive,
                bonus_weight,
                ..
            } if expressive_count(&text) > 0 => reduce_score_by_percent(&mut score, *bonus_weight),
            RuleKind::Humanisation {
                pattern_type: PatternType::HumanisationAnchoring,
                bonus_weight,
                ..
            } if Regex::new(r#"(?i)\b(?:je|j'|moi|mon|ma|mes|nous|me|m'|sent|entend|écout|respir|frissonn|trembl|senteur|odeur|froid|chaud|sang|fer|amer|rugueux|hélas|ah|oh|hein)\w*|[«»“”]"#)
                .map_err(|error| error.to_string())?
                .is_match(&text) => reduce_score_by_percent(&mut score, *bonus_weight),
            RuleKind::Humanisation {
                pattern_type,
                pattern,
                bonus_weight,
                ..
            } if matches!(pattern_type, PatternType::ExactMatch | PatternType::Regex)
                && !pattern.is_empty() =>
            {
                score -= (*bonus_weight).max(0.0)
                    * matching_spans(&text, pattern_type, pattern)?.len() as f32;
            }
            RuleKind::Humanisation {
                pattern_type: PatternType::AuthorLexicon,
                pattern,
                bonus_weight,
                ..
            } if !pattern.is_empty() => {
                let matches = matching_spans(&text, &PatternType::AuthorLexicon, pattern)?.len();
                score -= (*bonus_weight).max(0.0) * matches as f32;
            }
            _ => {}
        }
    }
    add_structural_issues(
        &text,
        &byte_to_char,
        &tokens,
        &exemptions,
        rules,
        &mut issues,
        &mut score,
    );
    issues.sort_by_key(|found| found.start_offset);
    Ok(StylometryReport {
        chapter_id: chapter_id.into(),
        ai_risk_percent: score.round().clamp(0.0, 100.0) as u8,
        burstiness_score,
        lexical_richness,
        issues_count: issues.len(),
        issues,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::stylometry::rules::default_rules;

    #[test]
    fn reports_french_offsets_after_yaml_frontmatter() -> Result<(), String> {
        let text = "---\ntitle: En effet\n---\nEn effet, la forêt répond.";
        let report = analyze("chapitre.md", text, &default_rules())?;
        let found = report
            .issues
            .iter()
            .find(|issue| issue.rule_id == "rlhf-connectors")
            .ok_or("tic de liaison non détecté")?;
        assert_eq!(found.start_offset, 24);
        assert_eq!(found.original_text, "En effet");
        assert!(report.ai_risk_percent <= 100);
        Ok(())
    }

    #[test]
    fn invalid_regular_expression_is_reported() {
        let mut rules = default_rules();
        rules.push(StylometryRule {
            id: "bad-regex".into(),
            name: "Invalide".into(),
            enabled: true,
            is_builtin: false,
            kind: RuleKind::Detection {
                pattern_type: PatternType::Regex,
                pattern: "(".into(),
                penalty_weight: 5.0,
                category: "Test".into(),
                explanation: "Test".into(),
                default_suggestion: None,
            },
        });
        assert!(analyze("x.md", "Un texte.", &rules).is_err());
    }

    #[test]
    fn paragraph_symmetry_uses_paragraphs_not_wrapped_lines() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "paragraph-symmetry");
        let report = analyze(
            "chapitre.md",
            "Le premier paragraphe contient assez de mots pour être examiné ici.\nIl continue sur une seconde ligne.\n\nLe second paragraphe contient également un nombre très proche de mots dans son ensemble maintenant encore.",
            &rules,
        )?;
        assert_eq!(report.issues_count, 1);
        assert_eq!(report.issues[0].rule_id, "paragraph-symmetry");
        Ok(())
    }

    #[test]
    fn isometry_merges_three_near_equal_sentences_into_one_issue() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "isometry-chain");
        let report = analyze(
            "chapitre.md",
            "Un roi regarde les portes. Le roi ferme les portes. Son roi franchit les portes.",
            &rules,
        )?;
        assert_eq!(report.issues_count, 1);
        assert_eq!(report.issues[0].rule_id, "isometry-chain");
        assert!(report.issues[0]
            .explanation
            .starts_with("3 phrases consécutives de longueur quasi identique (5 mots)."));
        assert_eq!(
            report.issues[0].suggested_rewrite.as_deref(),
            Some(
                "Un roi regarde les portes ; le roi ferme les portes. Son roi franchit les portes."
            )
        );
        Ok(())
    }

    #[test]
    fn forge_breaks_cadence_triads_lists_and_conclusions() {
        assert_eq!(
            forge_rewrite(
                &PatternType::IsometryChain,
                "Un battement régulier, profond, traverse la gemme."
            )
            .as_deref(),
            Some("Un battement régulier. Profond, traverse la gemme.")
        );
        assert_eq!(
            forge_rewrite(&PatternType::TriadPattern, "rouge, vieux et sombre").as_deref(),
            Some("rouge, vieux, sombre")
        );
        assert_eq!(
            forge_rewrite(&PatternType::MarkdownList, "- **Indice :**").as_deref(),
            Some("- Indice :")
        );
        assert_eq!(
            forge_rewrite(
                &PatternType::ChapterConclusion,
                "En conclusion, la porte demeure fermée."
            )
            .as_deref(),
            Some("La porte demeure fermée.")
        );
        assert!(forge_rewrite(&PatternType::EntropyUniform, "texte").is_none());
    }

    #[test]
    fn forge_prunes_intensifiers_or_inverts_the_final_complement() {
        assert_eq!(
            forge_rewrite(
                &PatternType::LexicalPredictability,
                "Très vite, il est vraiment las."
            )
            .as_deref(),
            Some("Vite, il est las.")
        );
        assert_eq!(
            forge_rewrite(
                &PatternType::EntropyUniform,
                "Il marchait lentement dans la forêt."
            )
            .as_deref(),
            Some("Dans la forêt, il marchait lentement.")
        );
        assert_eq!(
            forge_rewrite(
                &PatternType::EntropyUniform,
                "Marie attendait sous le vieux porche."
            )
            .as_deref(),
            Some("Sous le vieux porche, Marie attendait.")
        );
    }

    #[test]
    fn global_lexical_alerts_target_an_actionable_sentence() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "r-det-zipf");
        let text = format!(
            "{} Il est dans la maison avec le chat.",
            "Il y a le chat et le chien dans la cour de la maison. ".repeat(10)
        );
        let report = analyze("x.md", &text, &rules)?;
        assert_eq!(report.issues_count, 1);
        let found = &report.issues[0];
        assert!(found.explanation.starts_with("Mesure du chapitre :"));
        assert_eq!(
            found.original_text,
            &text[text.len() - found.original_text.len()..]
        );
        assert!(found.end_offset - found.start_offset < text.chars().count());
        assert!(found.suggested_rewrite.is_some());
        Ok(())
    }

    #[test]
    fn report_exposes_lexical_richness_and_trims_mid_text_spans() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "isometry-chain");
        let report = analyze(
            "x.md",
            "Il pleut fort depuis ce matin sur la vieille ville endormie. Un roi regarde les portes. Le roi ferme les portes. Son roi franchit les portes.",
            &rules,
        )?;
        assert!(report.lexical_richness > 0.0 && report.lexical_richness <= 100.0);
        assert!(report.issues[0].original_text.starts_with("Un roi"));
        Ok(())
    }

    #[test]
    fn triad_and_markdown_bullet_patterns_are_isolated() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| matches!(rule.id.as_str(), "r-det-triads" | "r-det-markdown-list"));
        let text = "Il vit rouge, vieux et sombre.\n\n- **Indice :** l'encre était sèche.";
        let report = analyze("chapitre.md", text, &rules)?;
        assert_eq!(report.issues_count, 2);
        assert_eq!(report.issues[0].rule_id, "r-det-triads");
        assert_eq!(report.issues[1].original_text, "- **Indice :**");
        Ok(())
    }

    #[test]
    fn connector_catalog_reports_each_match_once() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "rlhf-connectors");
        let report = analyze(
            "chapitre.md",
            "En effet, il vint. Force est de constater qu'il repart.",
            &rules,
        )?;
        assert_eq!(report.issues_count, 2);
        assert!(report
            .issues
            .iter()
            .all(|issue| issue.rule_id == "rlhf-connectors"));
        assert_eq!(
            report.issues[0].suggested_rewrite.as_deref(),
            Some("De fait")
        );
        assert_eq!(
            report.issues[1].suggested_rewrite.as_deref(),
            Some("Nous constatons")
        );
        Ok(())
    }

    #[test]
    fn sensory_and_expressive_markers_reduce_risk() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| {
            matches!(
                rule.id.as_str(),
                "humanisation-anchoring" | "expressive-punctuation"
            )
        });
        for rule in &mut rules {
            if let RuleKind::Humanisation { pattern_type, .. } = &mut rule.kind {
                *pattern_type = if rule.id == "humanisation-anchoring" {
                    PatternType::HumanisationAnchoring
                } else {
                    PatternType::PunctuationExpressive
                };
            }
        }
        let plain = analyze("x.md", "La porte est ouverte.", &rules)?;
        let embodied = analyze("x.md", "Je frissonne — le fer est froid…", &rules)?;
        assert!(embodied.ai_risk_percent < plain.ai_risk_percent);
        Ok(())
    }

    #[test]
    fn lexical_predictability_and_uniform_entropy_rules_trigger() -> Result<(), String> {
        let mut zipf_rules = default_rules();
        zipf_rules.retain(|rule| rule.id == "r-det-zipf");
        let frequent = ["le", "de", "et", "un", "dans", "la", "que", "il"]
            .iter()
            .cycle()
            .take(200)
            .copied()
            .collect::<Vec<_>>()
            .join(" ");
        let zipf = analyze("x.md", &frequent, &zipf_rules)?;
        assert_eq!(zipf.issues_count, 1);
        assert_eq!(zipf.issues[0].rule_id, "r-det-zipf");

        let mut entropy_rules = default_rules();
        entropy_rules.retain(|rule| rule.id == "r-det-entropy");
        let uniform = (0..50)
            .map(|index| format!("mot{index} mot{} ", (index + 1) % 50))
            .collect::<String>()
            .repeat(3);
        let entropy = analyze("x.md", &uniform, &entropy_rules)?;
        assert_eq!(entropy.issues_count, 1);
        assert_eq!(entropy.issues[0].rule_id, "r-det-entropy");
        Ok(())
    }

    #[test]
    fn stereotyped_chapter_conclusion_is_detected_only_at_the_end() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| rule.id == "r-det-conclusion");
        let report = analyze("x.md", "En conclusion, la porte demeure fermée.", &rules)?;
        assert_eq!(report.issues_count, 1);
        assert_eq!(
            report.issues[0].original_text,
            "En conclusion, la porte demeure fermée."
        );
        Ok(())
    }

    #[test]
    fn author_lexicon_is_exempt_from_predictability_denominator() -> Result<(), String> {
        let mut rules = default_rules();
        rules.retain(|rule| matches!(rule.id.as_str(), "r-det-zipf" | "author-lexicon"));
        if let Some(rule) = rules.iter_mut().find(|rule| rule.id == "author-lexicon") {
            if let RuleKind::Humanisation { pattern, .. } = &mut rule.kind {
                *pattern = "le".into();
            }
        }
        let text = std::iter::repeat("le")
            .take(120)
            .collect::<Vec<_>>()
            .join(" ");
        let report = analyze("x.md", &text, &rules)?;
        assert_eq!(report.issues_count, 0);
        Ok(())
    }
}
