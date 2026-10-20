mod engine;
mod rules;
mod scorer;

pub use engine::{analyze, StylometryReport};
pub use rules::{default_rules, PatternType, RuleKind, StylometryRule};
