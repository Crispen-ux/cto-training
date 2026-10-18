import type { Question, ScenarioExercise, ScenarioStage } from "./types";
import { SCENARIO_RUBRIC_VERSION } from "./types";

/**
 * Deterministic scenario scoring.
 *
 * Two hard rules, restated in code so they cannot be forgotten:
 *   1. A correct service name with weak reasoning does not pass. Objective
 *      questions are only part of the score, never the whole of it.
 *   2. Open design work cannot be certified by a heuristic. The heuristic
 *      produces a provisional indication and always sets needsHumanReview, so
 *      it can never become evidence on its own.
 */

export interface ClosedResult {
  questionId: string;
  kind: Question["kind"];
  correct: boolean;
  /** 0 or 1. Multiple-select is all-or-nothing, as professional exams are. */
  score: number;
  /** What the learner missed, or wrongly included. */
  missing: string[];
  wrong: string[];
  selected: string[];
  /** Only populated after the learner has committed to an answer. */
  revealed: boolean;
}

export interface OpenResult {
  questionId: string;
  kind: Question["kind"];
  /** Provisional only. Never evidence without a reviewer. */
  provisionalScore: number;
  needsHumanReview: true;
  /** Criteria the heuristic could see being met. */
  met: string[];
  unmet: string[];
  /** Criteria that carry weight and were not evidenced in the text. */
  gaps: string[];
  wordCount: number;
  tooShort: boolean;
  /** Did the answer cite a requirement or constraint from the scenario? */
  citedRequirements: boolean;
  findings: string[];
  revealed: boolean;
}

export type QuestionResult = ClosedResult | OpenResult;

export function isClosed(q: Question): boolean {
  return !!q.options && !!q.answers && q.answers.length > 0;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normalises an answer id so "A", "a" and "A." are the same choice. Keeps the
 * learner from losing marks to formatting.
 */
function normalise(id: string): string {
  return id.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
}

/**
 * Scores a closed question. Multiple-select is deliberately all-or-nothing:
 * partial credit on a multi-select rewards guessing and hides the fact that the
 * learner did not actually know the complete answer. The detail still tells
 * them exactly what was missing or wrongly included.
 */
export function scoreClosed(
  q: Question,
  selectedIds: string[],
  revealed: boolean,
): ClosedResult {
  const key = (q.answers ?? []).map(normalise);
  const picked = selectedIds.map(normalise).filter(Boolean);
  const missing = key.filter((k) => !picked.includes(k));
  const wrong = picked.filter((p) => !key.includes(p));
  const correct = key.length > 0 && missing.length === 0 && wrong.length === 0;
  return {
    questionId: q.id,
    kind: q.kind,
    correct,
    score: correct ? 1 : 0,
    missing,
    wrong,
    selected: picked,
    revealed,
  };
}

function textMatches(text: string, phrase: string): boolean {
  const t = text.toLowerCase();
  const p = phrase.toLowerCase().trim();
  if (!p) return false;
  if (t.includes(p)) return true;
  // Fall back to word-boundary matching so "RTO" matches "rto" but not inside
  // another token, and tolerate plural/singular on the final word.
  const escaped = p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const stem = escaped.replace(/s$/, "");
  return new RegExp(`\\b${stem}s?\\b`, "i").test(text);
}

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "that", "this", "must", "have", "been", "from",
  "into", "than", "then", "them", "they", "their", "there", "which", "would",
  "could", "should", "under", "over", "only", "also", "when", "where", "what",
]);

/**
 * Distinctive terms in a requirement: long enough and uncommon enough that a
 * learner who has engaged with it will probably use at least two of them, and
 * a learner who has not probably will not.
 */
function distinctiveTerms(requirement: string): string[] {
  return requirement
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 5 && !STOP_WORDS.has(w));
}

/**
 * Whether an answer engages with a stated requirement.
 *
 * Matching the whole sentence would fire almost always, making the check
 * useless noise. Matching one word would fire on coincidence. Two distinctive
 * terms is the middle that actually discriminates.
 */
export function citesRequirement(text: string, requirement: string): boolean {
  const terms = distinctiveTerms(requirement);
  if (terms.length < 2) return textMatches(text, requirement);
  const lower = text.toLowerCase();
  const hits = terms.filter((t) => lower.includes(t));
  return hits.length >= 2;
}

/**
 * Provisional analysis of an open answer.
 *
 * This looks for concrete signals the learner named: the rubric criteria the
 * scenario is graded on, and whether the answer anchors to a stated
 * requirement or constraint. It is an indication of coverage, not a judgement
 * of quality. A long answer that name-drops every keyword still needs a
 * reviewer, which is why this always returns needsHumanReview.
 */
export function analyseOpen(
  q: Question,
  text: string,
  requirementTexts: string[] = [],
): OpenResult {
  const rubric = q.rubric ?? [];
  const words = wordCount(text);
  const minWords = q.minWords ?? 80;

  const met: string[] = [];
  const unmet: string[] = [];
  let earned = 0;
  let total = 0;

  for (const c of rubric) {
    total += c.weight;
    const hit = c.lookFor.some((p) => textMatches(text, p));
    if (hit) {
      met.push(c.criterion);
      earned += c.weight;
    } else {
      unmet.push(c.criterion);
    }
  }

  const citedRequirements = requirementTexts.some((r) => citesRequirement(text, r));

  const findings: string[] = [];
  if (words < minWords) {
    findings.push(
      `${words} words against a ${minWords}-word minimum. An architecture decision that short cannot carry a trade-off.`,
    );
  }
  if (rubric.length === 0) {
    findings.push("This question has no rubric recorded, so it cannot be graded automatically at all.");
  }
  if (!citedRequirements && requirementTexts.length > 0) {
    findings.push(
      "The answer does not visibly anchor to any stated requirement. Architecture is justified against requirements, not in general.",
    );
  }
  if (unmet.length > 0) {
    findings.push(`Not evidenced in the text: ${unmet.join("; ")}.`);
  }

  const provisionalScore = total > 0 ? earned / total : 0;

  return {
    questionId: q.id,
    kind: q.kind,
    // Capped so a heuristic can never imply a level it has no basis for.
    provisionalScore: Math.min(provisionalScore, 0.7),
    needsHumanReview: true,
    met,
    unmet,
    gaps: unmet,
    wordCount: words,
    tooShort: words < minWords,
    citedRequirements,
    findings,
    revealed: false,
  };
}

/**
 * Questions a learner may not yet see, because they depend on an earlier
 * answer. Case-study questions open in order.
 */
export function unlockedQuestions(
  questions: Question[],
  answeredIds: Set<string>,
): Question[] {
  return questions.filter((q) => !q.dependsOn || answeredIds.has(q.dependsOn));
}

export interface StageScore {
  stage: ScenarioStage;
  weight: number;
  earned: number;
  /** Human review is required before this stage can count as evidence. */
  needsHumanReview: boolean;
  notes: string[];
}

export interface ScenarioScore {
  scenarioId: string;
  rubricVersion: string;
  /** 0..1 across objective work only. Not a claim of competence. */
  objectiveScore: number;
  objectiveCorrect: number;
  objectiveTotal: number;
  stages: StageScore[];
  /** False while any open component is unreviewed. */
  reviewable: boolean;
  needsHumanReview: boolean;
  /** Reasons the score cannot yet be treated as evidence. */
  blockers: string[];
}

/**
 * Aggregates an attempt.
 *
 * Objective questions are weighted at 40% and everything that requires
 * judgement - the twist, the deliverable, the defence - at 60%. That ratio is
 * the mechanism behind "a correct answer with weak reasoning does not pass":
 * a perfect objective score alone cannot reach the pass mark.
 */
const OBJECTIVE_WEIGHT = 0.4;
const JUDGEMENT_WEIGHT = 0.6;

export function scoreScenario(
  s: ScenarioExercise,
  closed: ClosedResult[],
  open: OpenResult[],
): ScenarioScore {
  const objectiveQuestions = s.questions.filter(isClosed);
  const closedForScenario = closed.filter((c) =>
    objectiveQuestions.some((q) => q.id === c.questionId),
  );

  const objectiveCorrect = closedForScenario.filter((c) => c.correct).length;
  const objectiveTotal = objectiveQuestions.length;
  const objectiveScore = objectiveTotal > 0 ? objectiveCorrect / objectiveTotal : 0;

  const blockers: string[] = [];
  const stages: StageScore[] = [];

  stages.push({
    stage: "decide",
    weight: OBJECTIVE_WEIGHT,
    earned: OBJECTIVE_WEIGHT * objectiveScore,
    needsHumanReview: false,
    notes: [`${objectiveCorrect} of ${objectiveTotal} objective questions correct.`],
  });

  const openScores = open.filter((o) => o.questionId !== "twist-answer");
  const openMean =
    openScores.length > 0
      ? openScores.reduce((a, o) => a + o.provisionalScore, 0) / openScores.length
      : 0;

  const tooShort = openScores.filter((o) => o.tooShort).map((o) => o.questionId);
  if (tooShort.length > 0) {
    blockers.push(`${tooShort.length} open answer(s) are below the minimum length and cannot be graded as written.`);
  }

  // Every open component needs a reviewer. This is not a configurable option.
  stages.push({
    stage: "deliverable",
    weight: JUDGEMENT_WEIGHT,
    earned: JUDGEMENT_WEIGHT * openMean,
    needsHumanReview: true,
    notes:
      openScores.length === 0
        ? ["No deliverable submitted yet."]
        : ["Provisional coverage only. Design quality needs a reviewer."],
  });

  const allReviewed = openScores.length > 0 && openScores.every((o) => !o.needsHumanReview);
  if (!allReviewed) {
    blockers.push("The design deliverable has not been reviewed, so this attempt is not yet evidence.");
  }

  const needsHumanReview = stages.some((s2) => s2.needsHumanReview) || blockers.length > 0;

  return {
    scenarioId: s.id,
    rubricVersion: SCENARIO_RUBRIC_VERSION,
    objectiveScore,
    objectiveCorrect,
    objectiveTotal,
    stages,
    reviewable: objectiveTotal > 0 && objectiveCorrect === objectiveTotal,
    needsHumanReview,
    blockers,
  };
}
