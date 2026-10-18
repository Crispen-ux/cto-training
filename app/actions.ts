"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLesson, loadLessons } from "@/lib/content";
import { DIAGNOSTIC_RULES, buildDiagnostic, scoreDiagnostic } from "@/lib/diagnostic";
import { PILLARS, RULES, checkUnlock, counts } from "@/lib/engine";
import { scoreKnowledgeCheck } from "@/lib/scoring";
import {
  addDiagnostic,
  today,
  addEvidence,
  addSubmission,
  getSubmission,
  readState,
  reviewSubmission,
  saveSettings,
  scenarioRefToAttemptId,
} from "@/lib/store";
import { recordScenarioReview } from "@/lib/scenario/store";

function refresh() {
  revalidatePath("/", "layout");
}

export async function submitCheck(lessonId: string, answers: Record<string, number>) {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new Error("Unknown lesson");
  const clean: Record<string, number> = {};
  for (const [k, v] of Object.entries(answers ?? {})) if (Number.isInteger(v)) clean[k] = v;

  const state = readState();
  const unlock = checkUnlock(lesson.unlock, state.evidence);
  if (!unlock.unlocked) throw new Error("Lesson is locked: " + unlock.reasons.join("; "));

  const result = scoreKnowledgeCheck(lesson, clean);
  const passed = result.score >= RULES.passMark;
  addEvidence({
    lessonId,
    pillar: lesson.pillar,
    type: "knowledge_check",
    score: result.score,
    passed,
    assessedBy: "auto",
    needsHumanReview: false,
  });
  refresh();
  return { ...result, passed, passMark: RULES.passMark };
}

export async function submitWork(formData: FormData) {
  const lessonId = String(formData.get("lessonId") ?? "");
  const mode = String(formData.get("mode") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const artifactRef = String(formData.get("artifactRef") ?? "").trim();
  const dataLabel = String(formData.get("dataLabel") ?? "");
  const lesson = getLesson(lessonId);
  const back = (msg: string, ok = false) =>
    redirect(`/lessons/${lessonId}?mode=${mode}&${ok ? "ok" : "error"}=${encodeURIComponent(msg)}`);

  if (!lesson || (mode !== "build" && mode !== "defend")) redirect("/");
  const state = readState();
  const unlock = checkUnlock(lesson.unlock, state.evidence);
  if (!unlock.unlocked) back("This lesson is locked.");

  const checkPassed = state.evidence.some(
    (e) => e.lessonId === lessonId && e.type === "knowledge_check" && e.passed && counts(e),
  );
  if (!checkPassed) back("Pass the knowledge check first.");
  if (content.length < 30) back("Describe your work in at least 30 characters.");

  if (mode === "build") {
    if (!artifactRef) back("An artifact reference (repo URL, path or document link) is required.");
    if (dataLabel !== "REAL" && dataLabel !== "SIMULATED") back("Label the data REAL or SIMULATED.");
    addSubmission({
      lessonId,
      pillar: lesson.pillar,
      kind: "artifact",
      content,
      artifactRef,
      dataLabel: dataLabel as "REAL" | "SIMULATED",
    });
    refresh();
    back("Submitted for review. XP is awarded after a reviewer scores it.", true);
  } else {
    const hasBuild = state.submissions.some((s) => s.lessonId === lessonId && s.kind === "artifact");
    if (!hasBuild) back("Submit your build deliverable before the defence.");
    addSubmission({ lessonId, pillar: lesson.pillar, kind: "defence", content });
    refresh();
    back("Defence submitted for assessment.", true);
  }
}

export async function submitReview(formData: FormData) {
  const submissionId = String(formData.get("submissionId") ?? "");
  const pct = Number(formData.get("score"));
  const notes = String(formData.get("notes") ?? "");
  const flagged = formData.get("flag") === "on";
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) redirect("/review?error=Score%20must%20be%200-100");
  try {
    reviewSubmission({
      submissionId,
      score: pct / 100,
      needsHumanReview: flagged,
      notes,
      assessedBy: "human",
    });

    // A scenario deliverable is reviewed twice over: once as evidence against
    // the lesson, and once on the attempt itself, so the reasoning behind the
    // deliverable carries the reviewer's judgement rather than only its text.
    const sub = getSubmission(submissionId);
    const attemptId = scenarioRefToAttemptId(sub?.artifactRef);
    if (attemptId) {
      try {
        recordScenarioReview(attemptId, {
          score: pct / 100,
          notes,
          assessedBy: "human",
        });
      } catch {
        // The evidence review above already succeeded. A missing attempt must
        // not roll that back, so the scenario record is best-effort here.
      }
    }
  } catch (e) {
    redirect(`/review?error=${encodeURIComponent((e as Error).message)}`);
  }
  refresh();
  redirect("/review?ok=Review%20saved");
}

export async function saveScheduleAction(formData: FormData) {
  const num = (k: string) => Math.max(0, Math.min(480, Math.round(Number(formData.get(k)) || 0)));
  saveSettings({
    schedule: {
      framework: num("framework"),
      fundamentals: num("fundamentals"),
      project: num("project"),
      assessment: num("assessment"),
    },
  });
  refresh();
  redirect("/settings?ok=Saved");
}

/**
 * Records an entry-diagnostic attempt. This is a baseline only: it writes no evidence, so it can never award XP,
 * unlock a lesson or raise a competency level.
 */
export async function submitDiagnostic(formData: FormData) {
  const fail = (msg: string) => redirect(`/diagnostic?retake=1&error=${encodeURIComponent(msg)}`);
  const seed = Number(formData.get("seed"));
  if (!Number.isInteger(seed) || seed < 0 || seed > 2 ** 31) fail("The form was invalid. Reload and try again.");

  const state = readState();
  const day = today();
  if (state.diagnostics.filter((d) => d.takenAt.slice(0, 10) === day).length >= DIAGNOSTIC_RULES.maxPerDay) {
    redirect("/diagnostic?error=" + encodeURIComponent("You have already taken the diagnostic today. Try again tomorrow."));
  }

  const items = buildDiagnostic(loadLessons(), seed);
  const answers: Record<string, number> = {};
  for (const it of items) {
    const raw = formData.get("a:" + it.id);
    const n = raw === null || raw === "" ? NaN : Number(raw);
    if (!Number.isInteger(n) || n < 0 || n >= it.options.length) {
      fail("Answer every question. If you do not know, pick your best guess; there is no penalty beyond the score.");
    }
    answers[it.id] = n;
  }
  const selfRatings: Record<string, number> = {};
  for (const p of PILLARS) {
    const n = Number(formData.get("self:" + p));
    if (Number.isInteger(n) && n >= 1 && n <= 5) selfRatings[p] = n;
  }
  addDiagnostic({ seed, selfRatings, answers, results: scoreDiagnostic(items, answers) });
  refresh();
  redirect("/diagnostic?ok=" + encodeURIComponent("Baseline recorded. It is not evidence and awards no XP."));
}
