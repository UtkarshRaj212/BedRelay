/**
 * Patient Condition Change Detection Engine
 * Evaluates semantic and textual similarity between previous and new condition notes
 * to deterministically identify material clinical changes requiring hospital review.
 */

// Common medical/grammar stopwords that do not indicate clinical change
const STOPWORDS = new Set([
  "patient",
  "is",
  "a",
  "an",
  "the",
  "in",
  "on",
  "at",
  "with",
  "and",
  "or",
  "of",
  "for",
  "reported",
  "observed",
  "currently",
  "shows",
  "showing",
  "noted",
  "status",
  "condition",
]);

// Clinical severity classes
const CRITICAL_KEYWORDS = new Set([
  "critical",
  "arrest",
  "cardiac arrest",
  "respiratory distress",
  "unresponsive",
  "intubated",
  "hypoxia",
  "shock",
  "severe",
  "coma",
  "hemorrhage",
  "stroke",
  "massive",
  "unconscious",
  "ventilator",
  "infarction",
]);

const URGENT_KEYWORDS = new Set([
  "urgent",
  "unstable",
  "chest pain",
  "acute",
  "fracture",
  "moderate",
  "bleeding",
  "altered",
  "dyspnea",
  "tachycardia",
]);

const STABLE_KEYWORDS = new Set([
  "stable",
  "conscious",
  "minor",
  "normal",
  "non-critical",
  "controlled",
  "alert",
]);

/**
 * Normalizes text: lowercases, removes punctuation, filters stopwords.
 */
export function normalizeConditionText(text: string): string[] {
  if (!text) return [];
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
  return cleaned;
}

/**
 * Determines clinical severity tier for a given text.
 */
export function getSeverityTier(text: string): "CRITICAL" | "URGENT" | "STABLE" | "UNKNOWN" {
  const lower = text.toLowerCase();
  for (const kw of CRITICAL_KEYWORDS) {
    if (lower.includes(kw)) return "CRITICAL";
  }
  for (const kw of URGENT_KEYWORDS) {
    if (lower.includes(kw)) return "URGENT";
  }
  for (const kw of STABLE_KEYWORDS) {
    if (lower.includes(kw)) return "STABLE";
  }
  return "UNKNOWN";
}

/**
 * Levenshtein distance between two normalized strings.
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Deterministic threshold for condition similarity.
 * Normalized similarity below 0.65 indicates a material change.
 */
export const CONDITION_SIMILARITY_THRESHOLD = 0.65;

export interface ConditionComparisonResult {
  isMaterialChange: boolean;
  similarity: number;
  oldSeverity: string;
  newSeverity: string;
  reason: string | null;
}

/**
 * Evaluates whether a change in patient condition text represents a material clinical change.
 */
export function evaluateConditionChange(
  oldCondition: string,
  newCondition: string
): ConditionComparisonResult {
  const normOld = normalizeConditionText(oldCondition);
  const normNew = normalizeConditionText(newCondition);

  const strOld = normOld.join(" ");
  const strNew = normNew.join(" ");

  // Exact match after stopword normalization
  if (strOld === strNew) {
    return {
      isMaterialChange: false,
      similarity: 1.0,
      oldSeverity: getSeverityTier(oldCondition),
      newSeverity: getSeverityTier(newCondition),
      reason: null,
    };
  }

  // Check clinical severity transition (e.g. STABLE -> CRITICAL)
  const oldTier = getSeverityTier(oldCondition);
  const newTier = getSeverityTier(newCondition);

  if (oldTier !== "UNKNOWN" && newTier !== "UNKNOWN" && oldTier !== newTier) {
    return {
      isMaterialChange: true,
      similarity: 0.2,
      oldSeverity: oldTier,
      newSeverity: newTier,
      reason: `Clinical severity changed from ${oldTier} to ${newTier}`,
    };
  }

  // Word token Jaccard similarity
  const setOld = new Set(normOld);
  const setNew = new Set(normNew);
  const intersection = new Set([...setOld].filter((x) => setNew.has(x)));
  const union = new Set([...setOld, ...setNew]);
  const jaccard = union.size === 0 ? 1.0 : intersection.size / union.size;

  // Character-level Levenshtein similarity
  const maxLen = Math.max(strOld.length, strNew.length);
  const levDist = levenshteinDistance(strOld, strNew);
  const levSim = maxLen === 0 ? 1.0 : 1.0 - levDist / maxLen;

  // Combined score (weighted average)
  const combinedSimilarity = Math.round((jaccard * 0.6 + levSim * 0.4) * 100) / 100;
  const isMaterial = combinedSimilarity < CONDITION_SIMILARITY_THRESHOLD;

  return {
    isMaterialChange: isMaterial,
    similarity: combinedSimilarity,
    oldSeverity: oldTier,
    newSeverity: newTier,
    reason: isMaterial
      ? `Material wording change detected (similarity: ${(combinedSimilarity * 100).toFixed(0)}% < ${(CONDITION_SIMILARITY_THRESHOLD * 100).toFixed(0)}%)`
      : null,
  };
}
