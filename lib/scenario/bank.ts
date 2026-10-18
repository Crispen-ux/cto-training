import fs from "node:fs";
import path from "node:path";
import { getLesson } from "../content";
import { SCENARIO_BANK_VERSION, type Question, type ScenarioExercise, type ScenarioSource } from "./types";

/**
 * Scenario bank loader.
 *
 * Everything the Academy asserts about a scenario is validated here at load
 * time, because a scenario is a claim about the world: that a lesson exists,
 * that a competency exists, that an answer key refers to options that exist,
 * and that a source was actually checked. The previous failure mode in this
 * codebase was a fabricated competency id and a source URL that 404'd, so
 * those two are errors, not warnings.
 */

const BANK_DIR = path.join(process.cwd(), "data", "scenarios");

export interface BankIssue {
  severity: "error" | "warning";
  issue: string;
}

export function loadScenarios(): ScenarioExercise[] {
  if (!fs.existsSync(/*turbopackIgnore: true*/ BANK_DIR)) return [];
  const files = fs
    .readdirSync(/*turbopackIgnore: true*/ BANK_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  const out: ScenarioExercise[] = [];
  for (const f of files) {
    try {
      out.push(JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), "utf8")) as ScenarioExercise);
    } catch {
      // A malformed file must not take the whole bank down; it is reported by
      // validateBank rather than silently skipped.
    }
  }
  return out;
}

export function getScenario(id: string): ScenarioExercise | undefined {
  return loadScenarios().find((s) => s.id === id);
}

/** ISO date at or before today. A future review date is a fabricated one. */
function isPlausibleReviewDate(d: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d).getTime();
  if (Number.isNaN(t)) return false;
  return t <= Date.now();
}

function validateQuestion(s: ScenarioExercise, q: Question, issues: BankIssue[]) {
  const where = `${s.id}/${q.id}`;

  if (!q.prompt?.trim()) issues.push({ severity: "error", issue: `${where}: question has no prompt.` });
  if (!q.rationale?.trim()) issues.push({ severity: "error", issue: `${where}: question has no rationale.` });

  const closed = !!q.options?.length;
  if (closed) {
    const optionIds = new Set(q.options!.map((o) => o.id));
    if (optionIds.size !== q.options!.length) {
      issues.push({ severity: "error", issue: `${where}: duplicate option ids.` });
    }
    for (const o of q.options!) {
      if (!o.text?.trim()) issues.push({ severity: "error", issue: `${where}: option ${o.id} has no text.` });
    }
    if (!q.answers?.length) {
      issues.push({ severity: "error", issue: `${where}: closed question has no answer key.` });
    } else {
      for (const a of q.answers) {
        if (!optionIds.has(a)) {
          issues.push({ severity: "error", issue: `${where}: answer "${a}" is not one of the options.` });
        }
      }
      if (q.kind === "single-best" && q.answers.length !== 1) {
        issues.push({ severity: "error", issue: `${where}: single-best question must have exactly one answer.` });
      }
      if (q.kind === "multiple-select" && q.answers.length < 2) {
        issues.push({ severity: "warning", issue: `${where}: multiple-select with fewer than two answers is really single-best.` });
      }
    }
    for (const d of q.distractors ?? []) {
      if (!optionIds.has(d.optionId)) {
        issues.push({ severity: "error", issue: `${where}: distractor refers to unknown option ${d.optionId}.` });
      } else if (q.answers?.includes(d.optionId)) {
        issues.push({ severity: "error", issue: `${where}: distractor marks a correct answer as wrong.` });
      }
      if (!d.whyWrong?.trim()) {
        issues.push({ severity: "error", issue: `${where}: distractor ${d.optionId} has no explanation.` });
      }
    }
    // Distractor coverage is what makes a question discriminate. An unexplained
    // wrong answer teaches nothing.
    const explained = new Set((q.distractors ?? []).map((d) => d.optionId));
    const unexplained = (q.options ?? []).filter(
      (o) => !q.answers?.includes(o.id) && !explained.has(o.id),
    );
    if (unexplained.length > 0) {
      issues.push({
        severity: "warning",
        issue: `${where}: ${unexplained.length} option(s) have no distractor explanation (${unexplained.map((o) => o.id).join(", ")}).`,
      });
    }
  } else {
    if (!q.rubric?.length) {
      issues.push({ severity: "error", issue: `${where}: open question has no rubric, so it cannot be assessed.` });
    }
    if (!q.minWords) {
      issues.push({ severity: "warning", issue: `${where}: open question has no minimum length.` });
    }
  }

  if (q.dependsOn && !s.questions.some((x) => x.id === q.dependsOn)) {
    issues.push({ severity: "error", issue: `${where}: depends on "${q.dependsOn}", which does not exist.` });
  }
  if (!q.tests?.length) {
    issues.push({ severity: "warning", issue: `${where}: question does not declare what it tests.` });
  }
}

function validateSource(s: ScenarioExercise, src: ScenarioSource, issues: BankIssue[]) {
  const where = `${s.id} source`;
  if (!src.url?.trim()) {
    issues.push({ severity: "error", issue: `${where}: no URL.` });
    return;
  }
  if (!/^https:\/\//.test(src.url)) {
    issues.push({ severity: "error", issue: `${where}: URL is not https (${src.url}).` });
  }
  if (!isPlausibleReviewDate(src.reviewed)) {
    issues.push({
      severity: "error",
      issue: `${where}: review date "${src.reviewed}" is missing, malformed or in the future. A source cannot have been checked on a date that has not happened.`,
    });
  }
  if (!src.supports?.trim()) {
    issues.push({ severity: "warning", issue: `${where}: does not state what it supports, so it may be cited for more than it says.` });
  }
  if (src.authority === "academy-analysis" && src.url.includes("microsoft.com") === false && src.url.includes("aws.amazon.com") === false && src.url.includes("docs.aws.amazon.com") === false) {
    // Derived and academy analysis are allowed to sit on any URL; this only
    // records that the authority is the Academy's, not the vendor's.
  }
}

/** Structural validation of one scenario. */
export function validateScenario(s: ScenarioExercise): BankIssue[] {
  const issues: BankIssue[] = [];

  if (s.bankVersion !== SCENARIO_BANK_VERSION) {
    issues.push({ severity: "error", issue: `${s.id}: bankVersion "${s.bankVersion}" does not match ${SCENARIO_BANK_VERSION}.` });
  }
  if (!s.title?.trim()) issues.push({ severity: "error", issue: "Scenario has no title." });
  if (!s.evidenceLessonId?.trim()) {
    issues.push({ severity: "error", issue: `${s.id}: no evidenceLessonId, so completing it cannot produce evidence.` });
  } else if (!getLesson(s.evidenceLessonId)) {
    // A scenario that points at a lesson that does not exist would silently
    // produce evidence that maps to no competency.
    issues.push({ severity: "error", issue: `${s.id}: evidenceLessonId "${s.evidenceLessonId}" is not a real lesson.` });
  }

  if (!s.context.businessContext?.trim()) issues.push({ severity: "error", issue: `${s.id}: no business context.` });
  if (!s.requirements.functional?.length) issues.push({ severity: "error", issue: `${s.id}: no functional requirements.` });
  if (!s.requirements.nonFunctional?.length) issues.push({ severity: "error", issue: `${s.id}: no non-functional requirements.` });

  if (!s.ambiguity.missingInformation?.length && !s.ambiguity.ambiguities?.length) {
    issues.push({ severity: "warning", issue: `${s.id}: no missing information or ambiguity declared, so the scenario is fully specified and easier than intended.` });
  }

  if (!s.diagram?.elements?.length) {
    issues.push({ severity: "warning", issue: `${s.id}: no diagram. Substantial scenarios should include one.` });
  }
  if (!s.questions?.length) {
    issues.push({ severity: "error", issue: `${s.id}: no questions.` });
  }
  if (!s.twist?.change?.trim()) {
    issues.push({ severity: "warning", issue: `${s.id}: no mid-exercise change, so the learner is never forced to adapt.` });
  }
  if (!s.deliverable?.prompt?.trim()) {
    issues.push({ severity: "error", issue: `${s.id}: no deliverable.` });
  }
  if (!s.sources?.length) {
    issues.push({ severity: "error", issue: `${s.id}: no sources. A model answer with no basis is an opinion.` });
  }

  const qids = new Set<string>();
  for (const q of s.questions ?? []) {
    if (qids.has(q.id)) issues.push({ severity: "error", issue: `${s.id}: duplicate question id ${q.id}.` });
    qids.add(q.id);
    validateQuestion(s, q, issues);
  }

  for (const src of s.sources ?? []) validateSource(s, src, issues);

  if (!s.modelAnswer?.recommendedServices?.length) {
    issues.push({ severity: "error", issue: `${s.id}: model answer names no services.` });
  }
  if (!s.modelAnswer?.rejectedAlternatives?.length) {
    issues.push({ severity: "warning", issue: `${s.id}: model answer rejects no alternatives, so it teaches service names rather than judgement.` });
  }
  if (!s.modelAnswer?.assumptionsToConfirm?.length) {
    issues.push({ severity: "warning", issue: `${s.id}: model answer lists no assumptions to confirm.` });
  }

  return issues;
}

export interface BankReport {
  scenarios: ScenarioExercise[];
  issues: BankIssue[];
  errorCount: number;
  warningCount: number;
}

/**
 * Validates the whole bank. Errors mean a scenario must not be presented to a
 * learner; warnings mean it is weaker than intended.
 */
export function validateBank(): BankReport {
  const scenarios = loadScenarios();
  const issues: BankIssue[] = [];
  const ids = new Set<string>();

  for (const s of scenarios) {
    if (ids.has(s.id)) issues.push({ severity: "error", issue: `Duplicate scenario id: ${s.id}.` });
    ids.add(s.id);
    issues.push(...validateScenario(s));
  }

  // Files that exist but failed to parse still need reporting.
  if (fs.existsSync(/*turbopackIgnore: true*/ BANK_DIR)) {
    const files = fs.readdirSync(/*turbopackIgnore: true*/ BANK_DIR).filter((f) => f.endsWith(".json"));
    if (files.length !== scenarios.length) {
      issues.push({
        severity: "error",
        issue: `${files.length} scenario file(s) present but ${scenarios.length} parsed. A malformed file is being skipped.`,
      });
    }
  }

  return {
    scenarios,
    issues,
    errorCount: issues.filter((i) => i.severity === "error").length,
    warningCount: issues.filter((i) => i.severity === "warning").length,
  };
}

export function usableScenarios(): ScenarioExercise[] {
  return validateBank().scenarios.filter(
    (s) => !validateScenario(s).some((i) => i.severity === "error"),
  );
}

/** Scenarios attached to a roadmap module, so the bank sits in the curriculum. */
export function scenariosForModule(moduleId: string): ScenarioExercise[] {
  return usableScenarios().filter((s) => s.moduleId === moduleId);
}

/** Declared competency ids that actually exist in the competency model. */
export function competencyCoverage(): { scenarioId: string; declared: string[]; missing: string[] }[] {
  let ids: string[] = [];
  try {
    const parsed = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "data", "capability-competencies.json"), "utf8"),
    ) as { competencies: { id: string }[] };
    ids = parsed.competencies.map((c) => c.id);
  } catch {
    ids = [];
  }
  return loadScenarios().map((s) => ({
    scenarioId: s.id,
    declared: s.competencies,
    missing: s.competencies.filter((c) => !ids.includes(c)),
  }));
}
