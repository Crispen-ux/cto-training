import { RULES, type Rules } from "./rules";
import { computeCompetency } from "./mastery";
import { counts } from "./xp";
import type { Evidence, UnlockRule } from "./types";

export interface UnlockResult {
  unlocked: boolean;
  reasons: string[];
}

/**
 * A lesson unlocks from demonstrated prerequisites and competency, never from XP alone.
 */
export function checkUnlock(rule: UnlockRule, evidence: Evidence[], rules: Rules = RULES): UnlockResult {
  const reasons: string[] = [];

  for (const p of rule.prerequisites) {
    const ok = evidence.some(
      (e) => e.lessonId === p.lessonId && e.type === p.type && e.passed && counts(e, rules),
    );
    if (!ok) reasons.push(`Pass ${p.type.replace("_", " ")} on "${p.lessonId}"`);
  }

  if (rule.minLevel) {
    const c = computeCompetency(rule.minLevel.pillar, evidence, rules);
    if (c.level < rule.minLevel.level) {
      reasons.push(`Reach ${rule.minLevel.pillar} level ${rule.minLevel.level} (currently ${c.level})`);
    }
  }
  return { unlocked: reasons.length === 0, reasons };
}
