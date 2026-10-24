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

/// 40% text metrics, 60% weighted alerts per 250 words (an 8-point rule = one alert).
/// The smooth density curve has no hard saturation threshold.
pub(crate) fn risk_components(base: f32, penalty: f32, words: usize) -> (f32, f32) {
    if words == 0 {
        return (0.0, 0.0);
    }
    let density = penalty.max(0.0) / 8.0 / (words as f32 / 250.0).max(1.0);
    (
        base.clamp(0.0, 100.0) * 0.4,
        (density / 2.0).atan() * 120.0 / std::f32::consts::PI,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn five_corrections_reduce_risk_without_a_saturation_plateau() {
        let mut previous = 100.0;
        let mut scores = Vec::new();
        for alerts in (15..=20).rev() {
            let (background, alerts) = risk_components(100.0, alerts as f32 * 8.0, 2500);
            let score = background + alerts;
            assert!(score < previous);
            previous = score;
            scores.push(score);
        }
        assert!(scores[0] - scores[5] > 5.0);
        let (_, eleven) = risk_components(100.0, 11.0 * 8.0, 2500);
        assert!(scores[0] - (40.0 + eleven) > 10.0);
    }

    #[test]
    fn density_respects_volume_weights_and_component_bounds() {
        let (background, alerts) = risk_components(80.0, 160.0, 2500);
        assert_eq!(background, 32.0);
        assert_eq!(risk_components(80.0, 320.0, 5000).1, alerts);
        assert!(risk_components(80.0, 80.0, 2500).1 < alerts);
        assert!(risk_components(80.0, 160.0, 5000).1 < alerts);
        assert_eq!(risk_components(100.0, 0.0, 2500), (40.0, 0.0));
        assert_eq!(risk_components(100.0, 160.0, 0), (0.0, 0.0));
        let (background, alerts) = risk_components(200.0, 8000.0, 250);
        assert_eq!(background, 40.0);
        assert!(alerts > 0.0 && alerts < 60.0);
    }

    #[test]
    fn breaking_an_isometric_cadence_changes_burstiness_at_decimal_precision() {
        let words = vec!["mot".to_string(); 2000];
        let (_, regular, _) = base_risk(&[20; 100], &words);
        let mut revised = vec![20; 100];
        revised.splice(45..46, [5, 15]);
        let (_, varied, _) = base_risk(&revised, &words);
        assert!((varied * 10.0).round() > (regular * 10.0).round());
    }
}
