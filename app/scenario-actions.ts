"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getScenario } from "@/lib/scenario/bank";
import { getLesson } from "@/lib/content";
import { addSubmission } from "@/lib/store";
import {
  createAttempt,
  requireAttempt,
  updateAttempt,
  submitAttempt,
} from "@/lib/scenario/store";
import { analyseOpen, scoreClosed, scoreScenario, isClosed, unlockedQuestions } from "@/lib/scenario/scoring";
import { challengeRationale, rationaleIsSubstantive, engagesWithChange } from "@/lib/scenario/challenge";

/**
 * Scenario server actions.
 *
 * The rule that shapes every function here: the answer key is not computed,
 * stored or returned until the learner has committed to a decision, an defence
 * of it, a revision after the change, and a deliverable. Scoring closed
 * questions at submit time is what keeps the key off the wire during the
 * exercise.
 */

const lines = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

function requirementTexts(scenarioId: string): string[] {
  const s = getScenario(scenarioId);
  if (!s) return [];
  return [...s.requirements.functional, ...s.requirements.nonFunctional];
}

/** Answers already committed for questions that are currently unlocked. */
function answeredIds(attemptAnswers: Record<string, string[]>): Set<string> {
  return new Set(Object.keys(attemptAnswers));
}

export async function startScenario(formData: FormData) {
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const attempt = createAttempt(scenarioId);
  revalidatePath("/scenario");
  redirect(`/scenario/${scenarioId}?attempt=${attempt.id}`);
}

export async function saveConstraints(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const decisive = lines(formData.get("decisive"));
  const questionsToAsk = lines(formData.get("questionsToAsk"));

  if (decisive.length === 0) {
    redirect(
      `/scenario/${scenarioId}?attempt=${attemptId}&error=${encodeURIComponent(
        "Name at least one requirement that actually decides the design. A design that satisfies all requirements equally is not a design.",
      )}`,
    );
  }

  // What the learner still needs to ask is as revealing as what they asserted,
  // so it is stored with the rest of the reasoning rather than discarded.
  updateAttempt(attemptId, {
    decisiveRequirements: [...decisive, ...questionsToAsk.map((q) => `Need to confirm: ${q}`)],
    stage: "decide",
  });
  revalidatePath(`/scenario/${scenarioId}`);
  redirect(`/scenario/${scenarioId}?attempt=${attemptId}`);
}

export async function saveDecisions(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const attempt = requireAttempt(attemptId);
  const unlocked = unlockedQuestions(scenario.questions, answeredIds(attempt.answers));

  // Only questions the learner can currently see may be answered, so a
  // case-study dependency cannot be skipped by posting a crafted form.
  const answers: Record<string, string[]> = { ...attempt.answers };
  for (const q of unlocked) {
    if (!isClosed(q)) continue;
    const picked = (formData.getAll(`q_${q.id}`) as string[]).map((s) => s.trim()).filter(Boolean);
    if (picked.length > 0) answers[q.id] = picked;
  }

  const openAnswers = { ...attempt.openAnswers };
  for (const q of unlocked) {
    if (isClosed(q)) continue;
    if (q.kind === "defence") continue; // defended at the alternatives stage
    const text = String(formData.get(`text_${q.id}`) ?? "").trim();
    if (text) openAnswers[q.id] = text;
  }

  const rationale = String(formData.get("rationale") ?? "").trim();
  const substantive = rationaleIsSubstantive(rationale);
  if (!substantive.ok) {
    redirect(
      `/scenario/${scenarioId}?attempt=${attemptId}&error=${encodeURIComponent(substantive.reason ?? "Write a rationale.")}`,
    );
  }

  // Challenges are shown as staged hints. They name what to answer; they never
  // reveal whether the choice was correct.
  const challenges = challengeRationale(rationale, requirementTexts(scenarioId));

  updateAttempt(attemptId, { answers, openAnswers, rationale, challenges, stage: "alternatives" });
  revalidatePath(`/scenario/${scenarioId}`);
  redirect(`/scenario/${scenarioId}?attempt=${attemptId}`);
}

export async function saveAlternatives(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const attempt = requireAttempt(attemptId);
  const alternatives = String(formData.get("alternatives") ?? "").trim();
  const defence = String(formData.get("defence") ?? "").trim();

  if (alternatives.length < 25) {
    redirect(
      `/scenario/${scenarioId}?attempt=${attemptId}&error=${encodeURIComponent(
        "Name at least one credible alternative and the condition under which it would win. 'There is no alternative' is not an answer.",
      )}`,
    );
  }

  const openAnswers = { ...attempt.openAnswers };
  if (defence) {
    const defenceQ = scenario.questions.find((x) => x.kind === "defence");
    if (defenceQ) openAnswers[defenceQ.id] = defence;
  }

  updateAttempt(attemptId, { alternatives, openAnswers, stage: "twist" });
  revalidatePath(`/scenario/${scenarioId}`);
  redirect(`/scenario/${scenarioId}?attempt=${attemptId}`);
}

export async function saveTwist(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const attempt = requireAttempt(attemptId);
  const twistAnswer = String(formData.get("twistAnswer") ?? "").trim();

  if (twistAnswer.length < 40) {
    redirect(
      `/scenario/${scenarioId}?attempt=${attemptId}&error=${encodeURIComponent(
        "Say what survives the change and what must be re-selected. Restating the original answer is not adapting.",
      )}`,
    );
  }

  const changedWords = [
    ...scenario.twist.change.split(/[\s,]+/),
    ...scenario.twist.revisePrompt.split(/[\s,]+/),
  ];
  const applied = engagesWithChange(attempt.rationale, twistAnswer, changedWords);

  updateAttempt(attemptId, { twistAnswer, twistApplied: applied, stage: "deliverable" });
  revalidatePath(`/scenario/${scenarioId}`);
  redirect(`/scenario/${scenarioId}?attempt=${attemptId}`);
}

export async function submitScenario(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "");
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const scenario = getScenario(scenarioId);
  if (!scenario) redirect("/scenario?error=Unknown+scenario.");

  const attempt = requireAttempt(attemptId);
  const deliverable = String(formData.get("deliverable") ?? "").trim();
  const deliverableKind = String(formData.get("deliverableKind") ?? scenario.deliverable.kind).trim();

  if (deliverable.length < 80) {
    redirect(
      `/scenario/${scenarioId}?attempt=${attemptId}&error=${encodeURIComponent(
        "The deliverable is too short to be assessed. The scenario asks for a recommendation with a decision matrix.",
      )}`,
    );
  }

  // This is the first point at which the key is used.
  const closed = scenario.questions
    .filter(isClosed)
    .map((q) => scoreClosed(q, attempt.answers[q.id] ?? [], true));

  const reqTexts = requirementTexts(scenarioId);
  const open = scenario.questions
    .filter((x) => !isClosed(x))
    .map((x) => analyseOpen(x, attempt.openAnswers[x.id] ?? "", reqTexts));

  const deliverableChallenges = challengeRationale(deliverable, reqTexts);

  const score = scoreScenario(scenario, closed, open);

  updateAttempt(attemptId, {
    deliverable,
    deliverableKind,
    closedResults: closed,
    openResults: open,
    challenges: [...attempt.challenges, ...deliverableChallenges],
  });
  submitAttempt(attemptId, score);

  // A submitted scenario becomes a submission in the existing review queue, so
  // a human can judge the design. Until then it is practice, not evidence, and
  // the objective score alone cannot make it so.
  const lesson = getLesson(scenario.evidenceLessonId);
  if (lesson) {
    addSubmission({
      lessonId: lesson.id,
      pillar: lesson.pillar,
      kind: "artifact",
      content: deliverable,
      artifactRef: `scenario:${attemptId}`,
      dataLabel: "SIMULATED",
    });
  }

  revalidatePath(`/scenario/${scenarioId}`);
  revalidatePath("/scenario");
  redirect(`/scenario/${scenarioId}?attempt=${attemptId}&submitted=1`);
}
