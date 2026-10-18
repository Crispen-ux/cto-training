import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readState, addSubmission, addEvidence, reviewSubmission } from "@/lib/store";
import { capabilityDashboard, computeGaps } from "@/lib/capability";
import { lessonsForCompetency } from "@/lib/capability-evidence";

/**
 * The vertical slice, proved end to end through the existing review queue:
 *
 *   knowledge check -> addEvidence (auto-scored, as submitCheck does)
 *   artefact/defence -> addSubmission -> reviewSubmission (human or AI)
 *   real Evidence -> competency gap -> prioritised next action
 *
 * No new store, no new dashboard, no new review flow. It calls exactly the
 * functions the app already calls.
 */

const TRACK = "CTO / Technology Strategist" as const;

/** A lesson that genuinely maps to a CTO-track competency. */
const LESSON = "dora-metrics";
const COMPETENCY = "cto-delivery";

/** Mirrors what app/actions.ts submitCheck() writes. */
function passKnowledgeCheck(score = 0.9) {
  return addEvidence({
    lessonId: LESSON,
    pillar: "Delivery",
    type: "knowledge_check",
    score,
    passed: true,
    assessedBy: "auto",
    needsHumanReview: false,
  });
}

function review(kind: "lab" | "artifact" | "defence", score: number, assessedBy: "human" | "ai", needsHumanReview = false, artifactRef?: string) {
  const sub = addSubmission({
    lessonId: LESSON,
    pillar: "Delivery",
    kind,
    content: `${kind} for ${LESSON}`,
    artifactRef,
  });
  return reviewSubmission({ submissionId: sub.id, score, needsHumanReview, notes: "reviewed in the test", assessedBy });
}

// The store reads ACADEMY_DATA_DIR on every call, so pointing it at a temp
// folder isolates this suite completely from the learner's real .data, and
// from other test files that also write state.
const TMP = path.join(os.tmpdir(), "cto-academy-slice-test");
const PREV = process.env.ACADEMY_DATA_DIR;

describe("evidence to competency, through the existing review queue", () => {
  beforeAll(() => {
    fs.rmSync(TMP, { recursive: true, force: true });
    fs.mkdirSync(TMP, { recursive: true });
    process.env.ACADEMY_DATA_DIR = TMP;
  });

  afterAll(() => {
    if (PREV === undefined) delete process.env.ACADEMY_DATA_DIR;
    else process.env.ACADEMY_DATA_DIR = PREV;
    fs.rmSync(TMP, { recursive: true, force: true });
  });

  beforeEach(() => {
    const s = readState();
    s.evidence = [];
    s.submissions = [];
    fs.writeFileSync(path.join(TMP, "state.json"), JSON.stringify(s, null, 2));
  });

  it("the lesson really is mapped to the competency under test", () => {
    expect(lessonsForCompetency(COMPETENCY)).toContain(LESSON);
  });

  it("shows a competency as unassessed before any evidence exists", () => {
    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.unassessed).toBe(true);
  });

  it("a knowledge check alone does NOT demonstrate the competency", () => {
    // a perfect quiz proves knowledge only: execution, judgement and
    // communication are all still unevidenced, so the level must stay 0
    passKnowledgeCheck(1);

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.source).toBe("evidence");
    expect(g.demonstrated, "a quiz cannot prove execution or defence").toBe(0);
    expect(g.weakestDimension).not.toBe("knowledge");
  });

  it("a practical lab proves execution but not judgement or defence", () => {
    review("lab", 1, "human");

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.demonstrated).toBe(0);
    expect(g.weakestDimension).toBe("knowledge");
  });

  it("a quiz plus a reviewed artefact plus a defence DOES demonstrate it", () => {
    passKnowledgeCheck(0.9);
    review("artifact", 0.85, "human", false, "repo:dora");
    review("defence", 0.85, "human");

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.source).toBe("evidence");
    expect(g.demonstrated).toBeGreaterThanOrEqual(3);
    expect(g.evidenceConfidence).toBe("high");
    expect(g.evidenceIds.length).toBe(3);
  });

  it("an AI-only defence cannot certify judgement at expert level", () => {
    passKnowledgeCheck(0.9);
    review("artifact", 0.9, "human");
    // perfect score, but scored by an AI reviewer
    review("defence", 1, "ai");

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    // a human reviewed the artefact, so the record is human-touched; what must
    // not happen is an AI defence certifying level 4/5 judgement
    expect(g.demonstrated).toBeLessThanOrEqual(3);
  });

  it("a defence scored only by AI is capped at level 3 communication", () => {
    passKnowledgeCheck(0.9);
    review("artifact", 0.9, "ai");
    review("defence", 1, "ai");

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.demonstrated).toBeLessThanOrEqual(3);
    expect(g.evidenceConfidence).not.toBe("high");
  });

  it("a submission flagged for human review contributes nothing", () => {
    passKnowledgeCheck(0.9);
    review("artifact", 1, "ai", true);

    const g = computeGaps([], TRACK, readState().evidence).find((x) => x.competencyId === COMPETENCY)!;
    expect(g.demonstrated).toBe(0);
  });

  it("the dashboard surface counts the evidenced competency", () => {
    passKnowledgeCheck(0.9);
    review("artifact", 0.85, "human");
    review("defence", 0.85, "human");

    const dash = capabilityDashboard([], TRACK, readState().evidence);
    expect(dash.fromEvidence).toBeGreaterThan(0);
    const g = dash.gaps.find((x) => x.competencyId === COMPETENCY)!;
    expect(g.source).toBe("evidence");
    expect(g.gap).toBeLessThan(4);
  });

  it("an evidenced but weak competency still appears in the prioritised list with a reason", () => {
    passKnowledgeCheck(0.5);

    const dash = capabilityDashboard([], TRACK, readState().evidence);
    const g = dash.gaps.find((x) => x.competencyId === COMPETENCY)!;
    expect(g.source).toBe("evidence");
    expect(g.demonstrated).toBe(0);
    expect(g.gap).toBeGreaterThan(0);
  });
});
