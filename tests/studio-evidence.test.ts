import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { readState, addSubmission, addEvidence, reviewSubmission, isStudioRef } from "@/lib/store";
import { computeGaps } from "@/lib/capability";
import { getProject, saveProject } from "@/lib/architecture/store";
import { sampleProject } from "@/lib/architecture/sample";
import { migrateProject } from "@/lib/architecture/validation";

const TMP = path.join(os.tmpdir(), "cto-academy-studio-evidence-test");
const PREV = process.env.ACADEMY_DATA_DIR;

describe("Architecture Studio work becomes evidence only through review", () => {
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

  it("creates a project that declares which lessons its work can evidence", () => {
    const p = saveProject(sampleProject());
    expect(p.evidenceLessonIds).toContain("adr-c4");
    expect(getProject(p.id)?.evidenceLessonIds).toContain("architecture-tradeoffs");
  });

  it("migrates an older project that has no evidenceLessonIds", () => {
    const legacy = { ...sampleProject(), evidenceLessonIds: undefined };
    delete (legacy as Record<string, unknown>).evidenceLessonIds;
    const m = migrateProject(JSON.parse(JSON.stringify(legacy)));
    expect(m.evidenceLessonIds).toEqual([]);
  });

  it("recognises a studio reference", () => {
    expect(isStudioRef("studio:arch_123")).toBe(true);
    expect(isStudioRef("repo:dora")).toBe(false);
    expect(isStudioRef(undefined)).toBe(false);
  });

  it("an unreviewed studio artefact changes nothing", () => {
    saveProject(sampleProject());
    const sub = addSubmission({
      lessonId: "adr-c4",
      pillar: "Tech",
      kind: "artifact",
      content: "Produced an ADR set and a C4 model in the Studio.",
      artifactRef: "studio:demo-project",
    });
    expect(sub.status).toBe("pending");

    const g = computeGaps([], "Solutions Architect", readState().evidence).find((x) => x.competencyId === "sa-adr")!;
    expect(g.unassessed, "pending work is not evidence").toBe(true);
  });

  it("once reviewed, the same work does raise sa-adr and sa-c4", () => {
    const p = saveProject(sampleProject());
    const sub = addSubmission({
      lessonId: "adr-c4",
      pillar: "Tech",
      kind: "artifact",
      content: `ADR set and C4 model for ${p.name}.`,
      artifactRef: `studio:${p.id}`,
    });
    // a knowledge check and a defence are still needed for a demonstrated level
    const k = addEvidence({ lessonId: "adr-c4", pillar: "Tech", type: "knowledge_check", score: 0.9, passed: true, assessedBy: "auto", needsHumanReview: false });
    expect(k.passed).toBe(true);
    const d = addSubmission({ lessonId: "adr-c4", pillar: "Tech", kind: "defence", content: "Defended the architecture." });
    reviewSubmission({ submissionId: sub.id, score: 0.85, needsHumanReview: false, notes: "Reviewed: coherent ADR set and consistent C4.", assessedBy: "human" });
    reviewSubmission({ submissionId: d.id, score: 0.85, needsHumanReview: false, notes: "Defended trade-offs.", assessedBy: "human" });

    const state = readState();
    const adr = computeGaps([], "Solutions Architect", state.evidence).find((x) => x.competencyId === "sa-adr")!;
    expect(adr.source).toBe("evidence");
    expect(adr.demonstrated).toBeGreaterThan(0);
    expect(adr.evidenceIds.length).toBe(3); // knowledge check + studio artefact + defence
  });

  it("an AI-only studio review cannot certify judgement at the top level", () => {
    const p = saveProject(sampleProject());
    addEvidence({ lessonId: "adr-c4", pillar: "Tech", type: "knowledge_check", score: 0.9, passed: true, assessedBy: "auto", needsHumanReview: false });
    const sub = addSubmission({ lessonId: "adr-c4", pillar: "Tech", kind: "artifact", content: "x", artifactRef: `studio:${p.id}` });
    const def = addSubmission({ lessonId: "adr-c4", pillar: "Tech", kind: "defence", content: "y" });
    reviewSubmission({ submissionId: sub.id, score: 1, needsHumanReview: false, notes: "great", assessedBy: "ai" });
    reviewSubmission({ submissionId: def.id, score: 1, needsHumanReview: false, notes: "great", assessedBy: "ai" });

    const g = computeGaps([], "Solutions Architect", readState().evidence).find((x) => x.competencyId === "sa-adr")!;
    expect(g.demonstrated).toBeLessThanOrEqual(3);
  });
});
