import type { Lesson } from "./content";

export interface CheckResult {
  correct: number;
  total: number;
  score: number; // 0..1
  perQuestion: { id: string; correct: boolean; why: string }[];
}

/** Scores a knowledge check. Unanswered or invalid answers count as wrong. */
export function scoreKnowledgeCheck(lesson: Lesson, answers: Record<string, number>): CheckResult {
  const perQuestion = lesson.knowledgeCheck.map((q) => ({
    id: q.id,
    correct: Number.isInteger(answers[q.id]) && answers[q.id] === q.answer,
    why: q.why,
  }));
  const correct = perQuestion.filter((p) => p.correct).length;
  const total = lesson.knowledgeCheck.length;
  return { correct, total, score: total === 0 ? 0 : correct / total, perQuestion };
}
