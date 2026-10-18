import fs from "node:fs";
import path from "node:path";
import { newId } from "../store";
import type { ClosedResult, OpenResult, ScenarioScore } from "./scoring";
import type { ScenarioChallenge } from "./challenge";
import type { ScenarioStage } from "./types";

/**
 * Scenario attempt persistence.
 *
 * Kept in its own file (like Architecture Studio projects) so importing or
 * clearing architecture data cannot disturb learning progress, and vice versa.
 * Attempts are append-mostly: a submitted attempt is kept intact and a new one
 * started, so repeated practice is visible rather than overwritten.
 */

export interface ScenarioReview {
  score: number;
  notes: string;
  assessedBy: "human" | "ai";
  at: string;
}

export interface ScenarioAttempt {
  id: string;
  scenarioId: string;
  stage: ScenarioStage;
  /** Stage 2: the requirements the learner named as decisive, in their words. */
  decisiveRequirements: string[];
  /** Stage 3: closed answers, question id -> option ids. */
  answers: Record<string, string[]>;
  /** Stage 3/6: open text, question id -> prose. */
  openAnswers: Record<string, string>;
  /** Stage 3: the justification for the chosen option. */
  rationale: string;
  /** Stage 4: alternatives considered and why each lost here. */
  alternatives: string;
  /** Stage 5: what the learner changed after the requirement moved. */
  twistAnswer: string;
  /** Whether the learner revised or explicitly defended standing by the choice. */
  twistApplied: boolean;
  /** Stage 6: the deliverable text and the kind of artefact it is. */
  deliverable: string;
  deliverableKind: string;
  /** Deterministic challenges raised against the rationale and deliverable. */
  challenges: ScenarioChallenge[];
  closedResults: ClosedResult[];
  openResults: OpenResult[];
  score?: ScenarioScore;
  review?: ScenarioReview;
  evidenceIds: string[];
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

const FILE = () => {
  const dir = process.env.ACADEMY_DATA_DIR ?? path.join(process.cwd(), ".data");
  return path.join(dir, "scenario-attempts.json");
};

function readAll(): ScenarioAttempt[] {
  const file = FILE();
  if (!fs.existsSync(/*turbopackIgnore: true*/ file)) return [];
  try {
    // A leading byte-order mark is common on files touched by Windows editors
    // and would make JSON.parse throw, which would look like data loss.
    const text = fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8").replace(/^﻿/, "");
    const parsed = JSON.parse(text) as ScenarioAttempt[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(attempts: ScenarioAttempt[]) {
  const file = FILE();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(attempts, null, 2));
  fs.renameSync(tmp, file); // atomic replace
}

export function listAttempts(scenarioId?: string): ScenarioAttempt[] {
  const all = readAll();
  return scenarioId ? all.filter((a) => a.scenarioId === scenarioId) : all;
}

export function getAttempt(id: string): ScenarioAttempt | undefined {
  return readAll().find((a) => a.id === id);
}

/** Most recent attempt for a scenario, if any. */
export function latestAttempt(scenarioId: string): ScenarioAttempt | undefined {
  return listAttempts(scenarioId).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  )[0];
}

export function createAttempt(scenarioId: string): ScenarioAttempt {
  const now = new Date().toISOString();
  const attempt: ScenarioAttempt = {
    id: newId(),
    scenarioId,
    stage: "read",
    decisiveRequirements: [],
    answers: {},
    openAnswers: {},
    rationale: "",
    alternatives: "",
    twistAnswer: "",
    twistApplied: false,
    deliverable: "",
    deliverableKind: "",
    challenges: [],
    closedResults: [],
    openResults: [],
    evidenceIds: [],
    createdAt: now,
    updatedAt: now,
  };
  writeAll([...readAll(), attempt]);
  return attempt;
}

/** Returns the stored attempt, or throws if it does not exist. */
export function requireAttempt(id: string): ScenarioAttempt {
  const a = getAttempt(id);
  if (!a) throw new Error("Scenario attempt not found");
  return a;
}

export function updateAttempt(id: string, patch: Partial<ScenarioAttempt>): ScenarioAttempt {
  const all = readAll();
  const i = all.findIndex((a) => a.id === id);
  if (i < 0) throw new Error("Scenario attempt not found");
  const updated: ScenarioAttempt = {
    ...all[i],
    ...patch,
    id: all[i].id,
    updatedAt: new Date().toISOString(),
  };
  all[i] = updated;
  writeAll(all);
  return updated;
}

/**
 * Marks an attempt submitted. The score is computed by the caller and stored
 * here; this function only enforces that a submitted attempt is not silently
 * reopened and rewritten.
 */
export function submitAttempt(id: string, score: ScenarioScore): ScenarioAttempt {
  const all = readAll();
  const i = all.findIndex((a) => a.id === id);
  if (i < 0) throw new Error("Scenario attempt not found");
  if (all[i].submittedAt) throw new Error("Attempt already submitted");
  const updated: ScenarioAttempt = {
    ...all[i],
    stage: "model-answer",
    score,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  all[i] = updated;
  writeAll(all);
  return updated;
}

/**
 * Records a reviewer's judgement of the deliverable.
 *
 * A reviewer other than the learner is required, matching the evidence engine's
 * rule that self-assessment never counts.
 */
export function recordScenarioReview(
  attemptId: string,
  review: Omit<ScenarioReview, "at">,
): ScenarioAttempt {
  if (!(review.score >= 0 && review.score <= 1)) throw new Error("Score must be between 0 and 1");
  if (!review.notes.trim()) throw new Error("Review notes are required");
  const all = readAll();
  const i = all.findIndex((a) => a.id === attemptId);
  if (i < 0) throw new Error("Scenario attempt not found");
  const updated: ScenarioAttempt = {
    ...all[i],
    review: { ...review, at: new Date().toISOString() },
    updatedAt: new Date().toISOString(),
  };
  all[i] = updated;
  writeAll(all);
  return updated;
}

/** Attempts awaiting a human decision on their deliverable. */
export function pendingReview(): ScenarioAttempt[] {
  return readAll()
    .filter((a) => a.submittedAt && !a.review)
    .sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime());
}

export function clearAttempts() {
  writeAll([]);
}
