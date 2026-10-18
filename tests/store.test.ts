import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addEvidence, addSubmission, readState, reviewSubmission, saveSettings } from "@/lib/store";
import { computeCompetency, computeXp } from "@/lib/engine";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-test-"));
  process.env.ACADEMY_DATA_DIR = dir;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.ACADEMY_DATA_DIR;
});

const base = { lessonId: "dora-metrics", pillar: "Delivery" as const };

describe("persistence", () => {
  it("returns an empty default state when nothing is saved", () => {
    const s = readState();
    expect(s.evidence).toEqual([]);
    expect(s.settings.schedule.project).toBe(60);
  });

  it("round-trips evidence across reads", () => {
    const e = addEvidence({
      ...base,
      type: "knowledge_check",
      score: 1,
      passed: true,
      assessedBy: "auto",
      needsHumanReview: false,
    });
    const again = readState();
    expect(again.evidence).toHaveLength(1);
    expect(again.evidence[0].id).toBe(e.id);
  });

  it("persists settings", () => {
    saveSettings({ schedule: { framework: 20, fundamentals: 20, project: 60, assessment: 20 } });
    expect(readState().settings.schedule.framework).toBe(20);
  });

  it("does not leave temp files behind", () => {
    addSubmission({ ...base, kind: "artifact", content: "x" });
    expect(fs.readdirSync(dir)).toEqual(["state.json"]);
  });
});

describe("review flow", () => {
  it("a submission earns nothing until a reviewer scores it", () => {
    addSubmission({ ...base, kind: "artifact", content: "built it", artifactRef: "repo" });
    const s = readState();
    expect(s.submissions[0].status).toBe("pending");
    expect(computeXp(s.evidence).total).toBe(0);
  });

  it("a human review turns a submission into counted evidence", () => {
    const sub = addSubmission({ ...base, kind: "artifact", content: "built it", artifactRef: "repo" });
    const ev = reviewSubmission({
      submissionId: sub.id,
      score: 0.8,
      needsHumanReview: false,
      notes: "Meets acceptance criteria",
      assessedBy: "human",
    });
    expect(ev.passed).toBe(true);
    expect(ev.artifactRef).toBe("repo");
    const s = readState();
    expect(s.submissions[0].status).toBe("reviewed");
    expect(computeXp(s.evidence).total).toBe(60);
  });

  it("a score below the pass mark does not pass", () => {
    const sub = addSubmission({ ...base, kind: "defence", content: "answers" });
    const ev = reviewSubmission({ submissionId: sub.id, score: 0.5, needsHumanReview: false, notes: "Gaps", assessedBy: "human" });
    expect(ev.passed).toBe(false);
  });

  it("an uncertain review flagged for human check does not count", () => {
    const sub = addSubmission({ ...base, kind: "artifact", content: "x", artifactRef: "r" });
    reviewSubmission({ submissionId: sub.id, score: 0.9, needsHumanReview: true, notes: "Unsure", assessedBy: "ai" });
    const s = readState();
    expect(computeXp(s.evidence).total).toBe(0);
    expect(computeCompetency("Delivery", s.evidence).level).toBe(0);
  });

  it("rejects double review, bad scores and empty notes", () => {
    const sub = addSubmission({ ...base, kind: "lab", content: "x" });
    expect(() => reviewSubmission({ submissionId: sub.id, score: 2, needsHumanReview: false, notes: "n", assessedBy: "human" })).toThrow();
    expect(() => reviewSubmission({ submissionId: sub.id, score: 0.8, needsHumanReview: false, notes: " ", assessedBy: "human" })).toThrow();
    reviewSubmission({ submissionId: sub.id, score: 0.8, needsHumanReview: false, notes: "ok", assessedBy: "human" });
    expect(() => reviewSubmission({ submissionId: sub.id, score: 0.8, needsHumanReview: false, notes: "ok", assessedBy: "human" })).toThrow();
    expect(() => reviewSubmission({ submissionId: "nope", score: 0.8, needsHumanReview: false, notes: "ok", assessedBy: "human" })).toThrow();
  });
});
