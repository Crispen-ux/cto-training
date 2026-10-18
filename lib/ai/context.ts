import type { Lesson } from "@/lib/content";

/** Neutralise anything that could close or imitate our own delimiters inside user-supplied text. */
export function sanitiseUserText(s: string): string {
  return s.replace(/<\/?\s*(learner_transcript|lesson_material|reference_material|learner_message|learner_writeup)[^>]*>/gi, "[tag removed]");
}

/**
 * Lesson text given to the tutor and the assessor as reference.
 * Deliberately excludes the knowledge-check questions and answers, so the tutor cannot leak them.
 */
export function lessonMaterial(lesson: Lesson): string {
  const parts: string[] = [];
  parts.push(`Lesson: ${lesson.title} (pillar: ${lesson.pillar})`);
  parts.push("Objectives:\n" + lesson.objectives.map((o) => "- " + o).join("\n"));
  parts.push(
    "Sources:\n" + lesson.sources.map((s) => `- ${s.title} [${s.category}] ${s.url} (reviewed ${s.reviewed}; ${s.reviewDepth})`).join("\n"),
  );
  parts.push("Verification notes (what is unverified or wrong in the sources):\n" + lesson.verificationNotes.map((n) => "- " + n).join("\n"));
  for (const s of lesson.learn.sections) parts.push(`## ${s.heading} [${s.sourceCategory}]\n${s.body}`);
  const w = lesson.learn.workedExample;
  parts.push(`## Worked example: ${w.title} [${w.sourceCategory}]\n${w.body}`);
  parts.push("Common mistakes:\n" + lesson.learn.misconceptions.map((m) => "- " + m).join("\n"));
  parts.push("Explanation task: " + lesson.learn.explainTask);
  return parts.join("\n\n");
}

export function rubricText(lesson: Lesson): string {
  return lesson.defend.rubric.map((r, i) => `${i}. ${r.criterion} (weight ${Math.round(r.weight * 100)}%)`).join("\n");
}
