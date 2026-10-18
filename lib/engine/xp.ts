import { RULES, type Rules } from "./rules";
import type { Evidence } from "./types";

export interface LedgerEntry {
  evidenceId: string;
  lessonId: string;
  reason: string;
  xp: number;
}

/** Evidence counts only if assessed by a countable assessor and not flagged for review. */
export function counts(e: Evidence, rules: Rules = RULES): boolean {
  return rules.countableAssessors.includes(e.assessedBy) && !e.needsHumanReview;
}

/**
 * XP is derived from evidence, never stored, so it cannot drift or be edited.
 * Each (lesson, type) pair pays out once, on the first counted pass.
 */
export function computeXp(evidence: Evidence[], rules: Rules = RULES) {
  const sorted = [...evidence]
    .filter((e) => counts(e, rules))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const firstScore = new Map<string, number>();
  const paid = new Set<string>();
  const ledger: LedgerEntry[] = [];

  for (const e of sorted) {
    const key = `${e.lessonId}:${e.type}`;
    if (!firstScore.has(key)) firstScore.set(key, e.score);
    if (!e.passed || paid.has(key)) continue;
    paid.add(key);
    ledger.push({
      evidenceId: e.id,
      lessonId: e.lessonId,
      reason: `Passed ${e.type.replace("_", " ")}`,
      xp: rules.xp[e.type],
    });
    const first = firstScore.get(key)!;
    if (first < rules.improvementWeakBelow && e.score - first >= rules.improvementMinGain) {
      ledger.push({
        evidenceId: e.id,
        lessonId: e.lessonId,
        reason: "Improved a previously weak result",
        xp: rules.improvementBonus,
      });
    }
  }
  return { total: ledger.reduce((s, l) => s + l.xp, 0), ledger };
}

export function levelFromXp(xp: number, rules: Rules = RULES) {
  let level = 1;
  rules.levelThresholds.forEach((t, i) => {
    if (xp >= t) level = i + 1;
  });
  const next = rules.levelThresholds[level] ?? null;
  const current = rules.levelThresholds[level - 1];
  return { level, xpIntoLevel: xp - current, xpForNext: next === null ? null : next - current };
}
