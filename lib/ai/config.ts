/**
 * Limits and thresholds for the AI tutor and assessor. Documented in docs/AI.md.
 * Change values here; tests in tests/ai.test.ts document the behaviour.
 */
export const AI_RULES = {
  /** Bump when the assessor prompt or output schema changes, so old audit records stay interpretable. */
  promptVersion: "assessor-v1",
  /** Independent scoring passes per defence. The API accepts only temperature 1.0 on newer models, so scores are noisy. */
  samples: 2,
  /** If any criterion differs by more than this many levels (0 to 4) between passes, send to a human. */
  maxCriterionDisagreement: 1,
  /** Below this model-reported confidence (0..1, averaged over passes), send to a human. */
  minConfidence: 0.6,
  /** Scores within this distance of the pass mark are too close to call by AI alone. */
  borderlineBand: 0.05,
  /** Follow-up rounds the assessor may ask before scoring. */
  maxFollowUpRounds: 2,
  /** Minimum learner characters across the whole defence before scoring is attempted. */
  minLearnerChars: 300,
  /** Longest single learner message accepted (characters). */
  maxMessageChars: 6000,
  /** Tutor conversation turns kept as context. */
  maxTutorHistory: 10,
  /** Longest quote the assessor may cite, and shortest that counts as evidence. */
  maxQuoteChars: 240,
  minQuoteChars: 12,
  /** Output token budgets. */
  tutorMaxTokens: 900,
  assessorMaxTokens: 1800,
  followUpMaxTokens: 500,
  feedbackMaxTokens: 1200,
  /** Cost and gaming guards. */
  dailyCallCap: 60,
  maxDefenceSessionsPerLessonPerDay: 2,
  /** Raw model responses kept in the audit log are truncated to this many characters. */
  auditRawChars: 12000,
} as const;

export const CRITERION_LEVELS = ["absent or wrong", "weak", "partial", "good", "excellent"] as const;
