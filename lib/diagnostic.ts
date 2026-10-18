import type { Lesson } from "./content";
import { PILLARS, type Pillar } from "./engine";

/**
 * Entry diagnostic: a short sample of each pillar's knowledge-check questions.
 * It is a baseline, NOT evidence: it awards no XP, unlocks nothing and counts toward no competency level.
 * Values live here so they are visible and testable. Documented in docs/DIAGNOSTIC.md.
 */
export const DIAGNOSTIC_RULES = {
  perPillar: 6,
  /** Retakes allowed, but at most this many per UTC day so the sample cannot be probed repeatedly. */
  maxPerDay: 1,
  /** Fraction correct at or above which a pillar sample reads as strong, and below which as weak. */
  strongAt: 0.8,
  weakBelow: 0.5,
  /** Self-rating (1 to 5) gaps that are worth a look. */
  selfHigh: 4,
  selfLow: 2,
} as const;

export interface DiagnosticItem {
  id: string; // `${lessonId}:${questionId}`
  lessonId: string;
  pillar: Pillar;
  question: string;
  options: string[]; // shuffled for this seed
  /** Index into `options`. Server only: never sent to the browser. */
  answer: number;
}
export type PublicItem = Omit<DiagnosticItem, "answer">;

/** Small deterministic PRNG so a seed always yields the same questions and option order. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Pick `perPillar` questions per pillar, spreading them across as many different lessons as possible
 * (round-robin over lessons in a seeded random order), and shuffle each question's options.
 */
export function buildDiagnostic(lessons: Lesson[], seed: number, perPillar: number = DIAGNOSTIC_RULES.perPillar): DiagnosticItem[] {
  const out: DiagnosticItem[] = [];
  for (const pillar of PILLARS) {
    const rnd = mulberry32(hash(`${seed}|${pillar}`));
    const ls = shuffle(lessons.filter((l) => l.pillar === pillar && l.knowledgeCheck.length > 0), rnd);
    const queues = ls.map((l) => shuffle(l.knowledgeCheck, rnd).map((q) => ({ l, q })));
    const picked: { l: Lesson; q: Lesson["knowledgeCheck"][number] }[] = [];
    for (let round = 0; picked.length < perPillar && queues.some((q) => q.length > round); round++) {
      for (const q of queues) {
        if (picked.length >= perPillar) break;
        if (q[round]) picked.push(q[round]);
      }
    }
    for (const { l, q } of picked) {
      const id = `${l.id}:${q.id}`;
      const order = shuffle(q.options.map((_, i) => i), mulberry32(hash(`${seed}|${id}`)));
      out.push({
        id,
        lessonId: l.id,
        pillar,
        question: q.question,
        options: order.map((i) => q.options[i]),
        answer: order.indexOf(q.answer),
      });
    }
  }
  return out;
}

export function publicItems(items: DiagnosticItem[]): PublicItem[] {
  return items.map(({ answer: _answer, ...rest }) => rest);
}

export interface PillarResult {
  pillar: Pillar;
  correct: number;
  total: number;
  /** Lessons whose sampled question was missed or unanswered, in sample order, without repeats. */
  missedLessonIds: string[];
}

export function scoreDiagnostic(items: DiagnosticItem[], answers: Record<string, number>): PillarResult[] {
  return PILLARS.map((pillar) => {
    const mine = items.filter((i) => i.pillar === pillar);
    const missed = mine.filter((i) => !(Number.isInteger(answers[i.id]) && answers[i.id] === i.answer));
    return {
      pillar,
      correct: mine.length - missed.length,
      total: mine.length,
      missedLessonIds: [...new Set(missed.map((i) => i.lessonId))],
    };
  }).filter((r) => r.total > 0);
}

/** Wilson score interval for a proportion (95% by default). */
export function wilson(k: number, n: number, z = 1.959964): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / d;
  const half = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, centre - half), Math.min(1, centre + half)];
}

/** Exact chance of getting at least `k` right by pure guessing, given each question's number of options. */
export function guessChance(optionCounts: number[], k: number): number {
  let dist = [1];
  for (const c of optionCounts) {
    const p = 1 / c;
    const next = new Array(dist.length + 1).fill(0);
    dist.forEach((v, i) => {
      next[i] += v * (1 - p);
      next[i + 1] += v * p;
    });
    dist = next;
  }
  return dist.slice(Math.max(0, k)).reduce((a, b) => a + b, 0);
}

export type Band = "strong" | "mixed" | "weak";
export function band(correct: number, total: number): Band {
  const f = total === 0 ? 0 : correct / total;
  return f >= DIAGNOSTIC_RULES.strongAt ? "strong" : f < DIAGNOSTIC_RULES.weakBelow ? "weak" : "mixed";
}

export type SelfGap = "possible overestimate" | "possible underestimate" | "consistent" | "not rated";
/** Compare a 1-5 self-rating with the sample. A signal to check, not a finding. */
export function selfGap(self: number | null | undefined, correct: number, total: number): SelfGap {
  if (!self || !Number.isInteger(self) || self < 1 || self > 5 || total === 0) return "not rated";
  const f = correct / total;
  if (self >= DIAGNOSTIC_RULES.selfHigh && f < DIAGNOSTIC_RULES.weakBelow) return "possible overestimate";
  if (self <= DIAGNOSTIC_RULES.selfLow && f >= DIAGNOSTIC_RULES.strongAt) return "possible underestimate";
  return "consistent";
}
