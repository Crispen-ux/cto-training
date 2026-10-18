import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { askTutor, finishAiDefence, startAiDefence, aiStatusAction, getBuildFeedback } from "@/app/ai-actions";
import { getLesson } from "@/lib/content";
import { addEvidence, addSubmission, readState } from "@/lib/store";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-aiact-"));
  process.env.ACADEMY_DATA_DIR = dir;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.ACADEMY_DATA_DIR;
  delete process.env.ACADEMY_AI_PROVIDER;
  delete process.env.ANTHROPIC_API_KEY;
});

const ID = "adr-c4";
const lesson = getLesson(ID)!;
const ANSWER = "I wrote the decision record with context, options, the decision and consequences, and I labelled every figure I invented as an assumption so nobody could mistake it for data. ".repeat(3);

describe("AI server actions", () => {
  it("report an unconfigured provider as a result, not an exception", async () => {
    const r = await askTutor(ID, "explain", [], "What is an ADR?");
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/No AI provider is configured/) });
    expect(await aiStatusAction()).toEqual({ configured: false, provider: null, model: null, mock: false });
  });

  it("answer the tutor through the mock provider and label it as a mock", async () => {
    process.env.ACADEMY_AI_PROVIDER = "mock";
    const r = await askTutor(ID, "explain", [], "What is an ADR?");
    expect(r.ok && r.data).toMatch(/^\[MOCK\]/);
    expect(await aiStatusAction()).toMatchObject({ configured: true, mock: true });
  });

  it("return validation problems as messages", async () => {
    process.env.ACADEMY_AI_PROVIDER = "mock";
    const r = await getBuildFeedback(ID, "too short");
    expect(r).toMatchObject({ ok: false, error: expect.stringMatching(/100 characters/) });
    const d = await startAiDefence(ID, ANSWER);
    expect(d).toMatchObject({ ok: false, error: expect.stringMatching(/knowledge check/) });
  });

  it("run a whole mock defence and never create evidence from it", async () => {
    process.env.ACADEMY_AI_PROVIDER = "mock";
    addEvidence({ lessonId: ID, pillar: lesson.pillar, type: "knowledge_check", score: 1, passed: true, assessedBy: "auto", needsHumanReview: false });
    addSubmission({ lessonId: ID, pillar: lesson.pillar, kind: "artifact", content: "built", artifactRef: "x", dataLabel: "SIMULATED" });
    const s = await startAiDefence(ID, ANSWER);
    expect(s.ok).toBe(true);
    if (!s.ok) return;
    const f = await finishAiDefence(s.data.id);
    expect(f.ok && f.data.outcome).toBe("sent_to_human");
    expect(f.ok && f.data.flags).toContain("mock_provider");
    const st = readState();
    expect(st.evidence.filter((e) => e.type === "defence")).toHaveLength(0);
    expect(st.submissions.find((x) => x.kind === "defence")?.status).toBe("pending");
  });
});
