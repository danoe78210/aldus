/// Returns `(risk, burstiness, lexical_richness)`, the last two on a 0–100 scale.
pub(crate) fn base_risk(sentences: &[usize], words: &[String]) -> (f32, f32, f32) {
    if words.is_empty() {
        return (0.0, 0.0, 0.0);
    }

    let mean = sentences.iter().sum::<usize>() as f32 / sentences.len().max(1) as f32;
    let variance = sentences
        .iter()
        .map(|length| (*length as f32 - mean).powi(2))
        .sum::<f32>()
        / sentences.len().max(1) as f32;
    let coefficient = if mean == 0.0 {
        0.0
    } else {
        variance.sqrt() / mean
    };
    let burstiness = coefficient / (1.0 + coefficient) * 100.0;

    let window = 100.min(words.len());
    let mut frequencies = std::collections::HashMap::<&str, usize>::new();
    let mut mattr_sum = 0.0;
    let mut windows = 0;
    for (index, word) in words.iter().enumerate() {
        *frequencies.entry(word).or_default() += 1;
        if index >= window {
            let previous = words[index - window].as_str();
            if let Some(count) = frequencies.get_mut(previous) {
                *count -= 1;
                if *count == 0 {
                    frequencies.remove(previous);
                }
            }
        }
        if index + 1 >= window {
            mattr_sum += frequencies.len() as f32 / window as f32;
            windows += 1;
        }
    }
    let mattr = mattr_sum / windows.max(1) as f32;
    let risk = (100.0 - burstiness) * 0.55 + (100.0 * (1.0 - mattr)) * 0.45;
    (risk.clamp(0.0, 100.0), burstiness, mattr * 100.0)
}
