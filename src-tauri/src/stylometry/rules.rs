use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum PatternType {
    ExactMatch,
    Regex,
    IsometryChain,
    ParagraphSymmetry,
    AuthorLexicon,
    PunctuationExpressive,
    TriadPattern,
    MarkdownList,
    ChapterConclusion,
    LexicalPredictability,
    EntropyUniform,
    HumanisationAnchoring,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase"
)]
pub enum RuleKind {
    Detection {
        pattern_type: PatternType,
        pattern: String,
        penalty_weight: f32,
        category: String,
        explanation: String,
        default_suggestion: Option<String>,
    },
    Humanisation {
        pattern_type: PatternType,
        pattern: String,
        bonus_weight: f32,
        category: String,
        explanation: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StylometryRule {
    pub id: String,
    pub name: String,
    pub enabled: bool,
    pub is_builtin: bool,
    pub kind: RuleKind,
}

fn detection(id: &str, name: &str, pattern: &str, suggestion: &str) -> StylometryRule {
    StylometryRule {
        id: id.into(),
        name: name.into(),
        enabled: true,
        is_builtin: true,
        kind: RuleKind::Detection {
            pattern_type: PatternType::Regex,
            pattern: pattern.into(),
            penalty_weight: 8.0,
            category: "Tics & Triades RLHF".into(),
            explanation: "Une formule de transition ou un tic lexical peut rendre la prose prévisible ; ce signal stylistique ne permet pas d'identifier l'origine du texte.".into(),
            default_suggestion: Some(suggestion.into()),
        },
    }
}

fn structural_detection(
    id: &str,
    name: &str,
    pattern_type: PatternType,
    pattern: &str,
    weight: f32,
    category: &str,
    explanation: &str,
    suggestion: Option<&str>,
) -> StylometryRule {
    StylometryRule {
        id: id.into(),
        name: name.into(),
        enabled: true,
        is_builtin: true,
        kind: RuleKind::Detection {
            pattern_type,
            pattern: pattern.into(),
            penalty_weight: weight,
            category: category.into(),
            explanation: explanation.into(),
            default_suggestion: suggestion.map(str::to_owned),
        },
    }
}

fn humanisation(
    id: &str,
    name: &str,
    pattern_type: PatternType,
    pattern: &str,
    bonus_weight: f32,
    explanation: &str,
) -> StylometryRule {
    StylometryRule {
        id: id.into(),
        name: name.into(),
        enabled: true,
        is_builtin: true,
        kind: RuleKind::Humanisation {
            pattern_type,
            pattern: pattern.into(),
            bonus_weight,
            category: "Ancrage & Humanisation".into(),
            explanation: explanation.into(),
        },
    }
}

pub fn default_rules() -> Vec<StylometryRule> {
    vec![
        detection(
            "rlhf-connectors",
            "Connecteurs pompeux et tics lexicaux",
            r"(?i)\b(?:en effet|par ailleurs|il convient de|force est de constater|témoigne de|crucial|paysage|au-delà de)\b",
            "{connector}",
        ),
        structural_detection(
            "isometry-chain",
            "Isométrie et rupture de burstiness",
            PatternType::IsometryChain,
            "",
            12.0,
            "Cadence & Burstiness",
            "Rythme isométrique monotone : absence de brisure de souffle caractéristique de l'écriture humaine.",
            None,
        ),
        structural_detection(
            "paragraph-symmetry",
            "Paragraphes de calibre identique",
            PatternType::ParagraphSymmetry,
            "",
            10.0,
            "Cadence & Burstiness",
            "Des paragraphes successifs de longueur très proche peuvent donner une mise en page trop régulière.",
            None,
        ),
        structural_detection(
            "r-det-triads",
            "Triades rhétoriques",
            PatternType::TriadPattern,
            r"(?i)\b[\p{L}-]+(?:\s*,\s*[\p{L}-]+){1,2}\s+et\s+[\p{L}-]+\b",
            7.0,
            "Tics & Triades RLHF",
            "Une énumération rythmée peut être une formule rhétorique répétée ; examinez-la selon son contexte.",
            None,
        ),
        structural_detection(
            "r-det-markdown-list",
            "Listes à puces avec amorce en gras",
            PatternType::MarkdownList,
            r"(?m)^[ \t]*[-*+]\s+\*\*[^*\r\n]{1,100}:\*\*",
            6.0,
            "Tics & Triades RLHF",
            "Une liste à puces dont chaque entrée commence par une amorce en gras peut évoquer une mise en forme explicative standardisée.",
            None,
        ),
        structural_detection(
            "r-det-conclusion",
            "Conclusion stéréotypée",
            PatternType::ChapterConclusion,
            r"(?is)(?:en conclusion|pour conclure|en définitive|en somme|il est important de retenir que)[^.!?]{0,300}[.!?]?\s*$",
            7.0,
            "Tics & Triades RLHF",
            "La conclusion reprend une formule de synthèse convenue ; une fin ancrée dans la scène peut être plus singulière.",
            None,
        ),
        structural_detection(
            "r-det-zipf",
            "Prédictibilité lexicale excessive",
            PatternType::LexicalPredictability,
            "",
            8.0,
            "Rareté & Perplexité",
            "Le vocabulaire est concentré sur des mots très fréquents. Ce repère approximatif dépend du genre et ne constitue pas une preuve.",
            None,
        ),
        structural_detection(
            "r-det-entropy",
            "Densité lexicale trop uniforme",
            PatternType::EntropyUniform,
            "",
            7.0,
            "Rareté & Perplexité",
            "La diversité lexicale varie peu entre les fenêtres du chapitre ; cette mesure reste un indice stylistique.",
            None,
        ),
        humanisation(
            "humanisation-anchoring",
            "Incarnation et ancrage sensoriel",
            PatternType::HumanisationAnchoring,
            "",
            10.0,
            "La subjectivité, les sensations et les échanges oraux donnent au récit un ancrage incarné.",
        ),
        humanisation(
            "expressive-punctuation",
            "Ponctuation expressive et ruptures de rythme",
            PatternType::PunctuationExpressive,
            "",
            10.0,
            "Les dialogues, incises et ruptures de cadence participent à une texture stylistique variée.",
        ),
        humanisation(
            "author-lexicon",
            "Lexique singulier d'auteur",
            PatternType::AuthorLexicon,
            "",
            4.0,
            "Le lexique propre à votre univers est pris en compte et ne doit pas alimenter les signaux de vocabulaire courant.",
        ),
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rule_json_uses_the_camel_case_ipc_contract() -> Result<(), String> {
        let rule = default_rules()
            .into_iter()
            .find(|rule| rule.id == "rlhf-connectors")
            .ok_or("Règle native absente")?;
        let value = serde_json::to_value(&rule).map_err(|error| error.to_string())?;
        assert_eq!(value["isBuiltin"], true);
        assert_eq!(value["kind"]["kind"], "detection");
        assert_eq!(value["kind"]["patternType"], "regex");
        assert!(value["kind"].get("penaltyWeight").is_some());
        Ok(())
    }

    #[test]
    fn native_catalog_has_no_duplicate_ids() {
        let rules = default_rules();
        for (index, rule) in rules.iter().enumerate() {
            assert!(!rules[..index].iter().any(|previous| previous.id == rule.id));
        }
    }
}
