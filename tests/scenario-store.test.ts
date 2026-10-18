import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createAttempt,
  getAttempt,
  latestAttempt,
  listAttempts,
  updateAttempt,
  submitAttempt,
  requireAttempt,
  recordScenarioReview,
  pendingReview,
  clearAttempts,
} from "@/lib/scenario/store";
import type { ScenarioScore } from "@/lib/scenario/scoring";

/**
 * Persistence tests. These swap the data directory so nothing written here
 * touches real learner progress.
 */

let dir: string;
let previous: string | undefined;

beforeEach(() => {
  previous = process.env.ACADEMY_DATA_DIR;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-scenario-"));
  process.env.ACADEMY_DATA_DIR = dir;
  clearAttempts();
});

afterEach(() => {
  if (previous === undefined) delete process.env.ACADEMY_DATA_DIR;
  else process.env.ACADEMY_DATA_DIR = previous;
  fs.rmSync(dir, { recursive: true, force: true });
});

const score = (over: Partial<ScenarioScore> = {}): ScenarioScore => ({
  scenarioId: "s1",
  rubricVersion: "scenario-rubric-v1",
  objectiveScore: 1,
  objectiveCorrect: 4,
  objectiveTotal: 4,
  stages: [],
  reviewable: true,
  needsHumanReview: true,
  blockers: [],
  ...over,
});

describe("scenario attempt persistence", () => {
  it("creates an attempt at the first stage with nothing committed", () => {
    const a = createAttempt("s1");
    expect(a.stage).toBe("read");
    expect(a.answers).toEqual({});
    expect(a.submittedAt).toBeUndefined();
    expect(a.evidenceIds).toEqual([]);
  });

  it("round-trips an attempt through the store", () => {
    const a = createAttempt("s1");
    expect(getAttempt(a.id)?.id).toBe(a.id);
  });

  it("returns nothing for an unknown attempt", () => {
    expect(getAttempt("nope")).toBeUndefined();
  });

  it("throws rather than silently no-op on a missing attempt", () => {
    expect(() => requireAttempt("nope")).toThrow(/not found/i);
    expect(() => updateAttempt("nope", { stage: "decide" })).toThrow(/not found/i);
    expect(() => submitAttempt("nope", score())).toThrow(/not found/i);
  });

  it("advances through the stages and records answers", () => {
    const a = createAttempt("s1");
    updateAttempt(a.id, { stage: "decide", decisiveRequirements: ["NFR3"] });
    updateAttempt(a.id, { stage: "alternatives", answers: { q1: ["B"] } });

    const stored = requireAttempt(a.id);
    expect(stored.stage).toBe("alternatives");
    expect(stored.decisiveRequirements).toEqual(["NFR3"]);
    expect(stored.answers).toEqual({ q1: ["B"] });
  });

  it("does not lose earlier answers when a later stage writes its own field", () => {
    const a = createAttempt("s1");
    updateAttempt(a.id, { answers: { q1: ["B"] } });
    updateAttempt(a.id, { twistAnswer: "revised" });
    const stored = requireAttempt(a.id);
    expect(stored.answers).toEqual({ q1: ["B"] });
    expect(stored.twistAnswer).toBe("revised");
  });

  it("cannot overwrite the attempt id through a patch", () => {
    const a = createAttempt("s1");
    updateAttempt(a.id, { id: "attacker-supplied" } as never);
    expect(requireAttempt(a.id).id).toBe(a.id);
  });

  it("marks an attempt submitted and moves it to the model-answer stage", () => {
    const a = createAttempt("s1");
    const submitted = submitAttempt(a.id, score());
    expect(submitted.submittedAt).toBeDefined();
    expect(submitted.stage).toBe("model-answer");
    expect(submitted.score?.objectiveScore).toBe(1);
  });

  it("refuses to let a submitted attempt be submitted or reopened", () => {
    const a = createAttempt("s1");
    submitAttempt(a.id, score());
    expect(() => submitAttempt(a.id, score())).toThrow(/already submitted/i);
  });

  it("returns the most recent attempt for a scenario", () => {
    const first = createAttempt("s1");
    // Force a distinct timestamp so ordering is unambiguous regardless of clock
    // resolution.
    updateAttempt(first.id, { createdAt: "2020-01-01T00:00:00.000Z" });
    const second = createAttempt("s1");
    updateAttempt(second.id, { createdAt: "2021-01-01T00:00:00.000Z" });

    expect(latestAttempt("s1")?.id).toBe(second.id);
    expect(listAttempts("s1")).toHaveLength(2);
    expect(listAttempts("s2")).toHaveLength(0);
  });

  it("lists attempts across all scenarios when no filter is given", () => {
    createAttempt("s1");
    createAttempt("s2");
    expect(listAttempts()).toHaveLength(2);
  });

  it("survives a corrupt store file rather than throwing on read", () => {
    createAttempt("s1");
    fs.writeFileSync(path.join(dir, "scenario-attempts.json"), "{not json");
    expect(listAttempts()).toEqual([]);
    // And writing again replaces the corrupt file rather than appending to it.
    const a = createAttempt("s1");
    expect(listAttempts()).toHaveLength(1);
    expect(a.id).toBeDefined();
  });

  it("reads a file that carries a UTF-8 byte-order mark", () => {
    // Windows editors write a BOM. Without stripping it, JSON.parse throws and
    // the store silently returns empty, which reads as data loss.
    createAttempt("s1");
    const file = path.join(dir, "scenario-attempts.json");
    const withBom = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(fs.readFileSync(file))]);
    fs.writeFileSync(file, withBom);

    const attempts = listAttempts();
    expect(attempts).toHaveLength(1);
    expect(attempts[0].scenarioId).toBe("s1");
  });

  it("does not treat a file whose top level is not an array as data", () => {
    fs.writeFileSync(path.join(dir, "scenario-attempts.json"), '{"not":"an array"}');
    expect(listAttempts()).toEqual([]);
  });
});

describe("scenario review", () => {
  it("records a reviewer judgement", () => {
    const a = createAttempt("s1");
    submitAttempt(a.id, score());
    const reviewed = recordScenarioReview(a.id, { score: 0.8, notes: "Solid isolation design.", assessedBy: "human" });
    expect(reviewed.review?.score).toBe(0.8);
    expect(reviewed.review?.assessedBy).toBe("human");
    expect(reviewed.review?.at).toBeDefined();
  });

  it("rejects a score outside 0..1", () => {
    const a = createAttempt("s1");
    submitAttempt(a.id, score());
    expect(() => recordScenarioReview(a.id, { score: 80, notes: "x", assessedBy: "human" })).toThrow(/0 and 1/);
    expect(() => recordScenarioReview(a.id, { score: -1, notes: "x", assessedBy: "human" })).toThrow(/0 and 1/);
  });

  it("requires review notes, so a score cannot be recorded unexplained", () => {
    const a = createAttempt("s1");
    submitAttempt(a.id, score());
    expect(() => recordScenarioReview(a.id, { score: 0.9, notes: "   ", assessedBy: "human" })).toThrow(/notes/i);
  });

  it("refuses to review an attempt that does not exist", () => {
    expect(() => recordScenarioReview("nope", { score: 0.5, notes: "x", assessedBy: "human" })).toThrow(/not found/i);
  });

  it("lists only submitted, unreviewed attempts as waiting", () => {
    const a = createAttempt("s1");
    const b = createAttempt("s1");
    submitAttempt(a.id, score());
    submitAttempt(b.id, score());
    expect(pendingReview()).toHaveLength(2);

    recordScenarioReview(a.id, { score: 0.7, notes: "reviewed", assessedBy: "human" });
    const waiting = pendingReview();
    expect(waiting).toHaveLength(1);
    expect(waiting[0].id).toBe(b.id);
  });

  it("does not list an unsubmitted attempt as waiting for review", () => {
    createAttempt("s1");
    expect(pendingReview()).toEqual([]);
  });
});
