import {
  PILLARS,
  checkUnlock,
  computeCompetency,
  computeStreak,
  computeXp,
  counts,
  levelFromXp,
  type Evidence,
} from "./engine";
import type { Lesson } from "./content";
import type { Settings, Submission } from "./store";

export type LessonStep = "learn" | "build" | "defend" | "done";

export interface LessonStatus {
  lesson: Lesson;
  unlocked: boolean;
  lockReasons: string[];
  checkPassed: boolean;
  buildPassed: boolean;
  defencePassed: boolean;
  pendingBuild: boolean;
  pendingDefence: boolean;
  nextStep: LessonStep;
}

export function lessonStatus(
  lesson: Lesson,
  evidence: Evidence[],
  submissions: Submission[],
): LessonStatus {
  const passed = (type: Evidence["type"]) =>
    evidence.some((e) => e.lessonId === lesson.id && e.type === type && e.passed && counts(e));
  const pending = (kind: Submission["kind"]) =>
    submissions.some((s) => s.lessonId === lesson.id && s.kind === kind && s.status === "pending");

  const u = checkUnlock(lesson.unlock, evidence);
  /**
   * A reference lesson (imported Markdown with no authored quiz) has no check
   * to pass. Without this it would sit on "Learn" forever, because the quiz is
   * the only thing that normally moves a lesson past that step.
   */
  const hasQuiz = lesson.knowledgeCheck.length > 0;
  const checkPassed = !hasQuiz || passed("knowledge_check");
  const buildPassed = passed("artifact") || passed("lab");
  const defencePassed = passed("defence");
  const nextStep: LessonStep = !checkPassed
    ? "learn"
    : !buildPassed
      ? "build"
      : !defencePassed
        ? "defend"
        : "done";

  return {
    lesson,
    unlocked: u.unlocked,
    lockReasons: u.reasons,
    checkPassed,
    buildPassed,
    defencePassed,
    pendingBuild: pending("artifact") || pending("lab"),
    pendingDefence: pending("defence"),
    nextStep,
  };
}

export interface Mission {
  lessonId: string;
  lessonTitle: string;
  step: LessonStep;
  minutes: number;
  headline: string;
  evidenceRequired: string[];
  awaitingReview: boolean;
}

export function buildDashboard(
  lessons: Lesson[],
  state: { evidence: Evidence[]; submissions: Submission[]; settings: Settings },
  today: string,
) {
  const { evidence, submissions, settings } = state;
  const xp = computeXp(evidence);
  const level = levelFromXp(xp.total);
  const competencies = PILLARS.map((p) => computeCompetency(p, evidence));
  const statuses = lessons.map((l) => lessonStatus(l, evidence, submissions));
  const streak = computeStreak(
    evidence.filter((e) => counts(e)).map((e) => e.createdAt),
    today,
  );
  const pendingReviews = submissions.filter((s) => s.status === "pending").length;

  // Today's mission: first unlocked, unfinished lesson whose next step is not already waiting on review.
  const current = statuses.find((s) => s.unlocked && s.nextStep !== "done");
  let mission: Mission | null = null;
  if (current) {
    const l = current.lesson;
    const s = settings.schedule;
    const awaiting =
      (current.nextStep === "build" && current.pendingBuild) ||
      (current.nextStep === "defend" && current.pendingDefence);
    if (current.nextStep === "learn") {
      mission = {
        lessonId: l.id,
        lessonTitle: l.title,
        step: "learn",
        minutes: s.framework + s.fundamentals,
        headline: l.knowledgeCheck.length > 0
        ? `Study the official guide, then pass the knowledge check (${l.knowledgeCheck.length} questions)`
        : "Study the material, then produce written work that applies it",
        evidenceRequired: ["Knowledge check scored 70% or more"],
        awaitingReview: false,
      };
    } else if (current.nextStep === "build") {
      mission = {
        lessonId: l.id,
        lessonTitle: l.title,
        step: "build",
        minutes: s.project,
        headline: "Work on the project deliverable and submit it with a reference",
        evidenceRequired: l.build.acceptance,
        awaitingReview: awaiting,
      };
    } else {
      mission = {
        lessonId: l.id,
        lessonTitle: l.title,
        step: "defend",
        minutes: s.assessment,
        headline: `Defend your work to the ${l.defend.assessor}`,
        evidenceRequired: l.defend.rubric.map((r) => r.criterion),
        awaitingReview: awaiting,
      };
    }
  }

  let recommended = "All available lessons are complete. Next modules are listed on the roadmap.";
  if (mission?.awaitingReview) {
    recommended = "Your submission is waiting for review. Ask a reviewer, or work on the next planned step.";
  } else if (mission) {
    recommended = `${mission.step === "learn" ? "Learn" : mission.step === "build" ? "Build" : "Defend"}: ${mission.lessonTitle}`;
  }

  const lessonsDone = statuses.filter((s) => s.nextStep === "done").length;

  return {
    xp,
    level,
    competencies,
    statuses,
    streak,
    pendingReviews,
    mission,
    recommended,
    lessonsDone,
    lessonsTotal: lessons.length,
  };
}
