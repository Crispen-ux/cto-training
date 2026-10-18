import type { Assessor, EvidenceType } from "./types";

/**
 * All progression rules live here so they are transparent and configurable.
 * Documented in docs/RULES.md. Academy levels are NOT official CTO Framework levels.
 */
export interface Rules {
  /** Score at or above which an attempt counts as passed (0..1). */
  passMark: number;
  /** XP awarded the first time a (lesson, evidence type) pair is passed. */
  xp: Record<EvidenceType, number>;
  /** Bonus when a first attempt below weakBelow is later passed with at least minGain improvement. */
  improvementBonus: number;
  improvementWeakBelow: number;
  improvementMinGain: number;
  /** Assessors whose evidence counts. "self" is deliberately absent. */
  countableAssessors: Assessor[];
  /** Level 5 needs at least one human-assessed defence. */
  l5RequiresHuman: boolean;
  /** Defence score needed for the two level 5 defences. */
  strongDefenceScore: number;
  /** Cumulative XP needed for each XP level (index 0 = level 1). */
  levelThresholds: number[];
  /** Missed days forgiven between active days before a streak breaks. */
  streakGraceDays: number;
}

export const RULES: Rules = {
  passMark: 0.7,
  xp: {
    knowledge_check: 20,
    lab: 40,
    artifact: 60,
    defence: 80,
    milestone: 100,
    outcome: 120,
  },
  improvementBonus: 50,
  improvementWeakBelow: 0.6,
  improvementMinGain: 0.15,
  countableAssessors: ["auto", "ai", "human"],
  l5RequiresHuman: true,
  strongDefenceScore: 0.85,
  levelThresholds: [0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000],
  streakGraceDays: 1,
};

export const MASTERY_LABELS = [
  "Not assessed",
  "Understands the concept",
  "Applies it with guidance",
  "Executes independently",
  "Designs and leads complex implementations",
  "Makes strategic decisions and defends measurable outcomes",
] as const;
