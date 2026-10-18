import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub only the Next.js runtime pieces; everything else (actions, engine, store) is real.
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { reviewSubmission, readState } from "@/lib/store";
import { getLesson, orderedLessons } from "@/lib/content";
import { buildDashboard } from "@/lib/dashboard";
import { computeCompetency, computeXp } from "@/lib/engine";
import { saveScheduleAction, submitCheck, submitReview, submitWork } from "@/app/actions";

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-journey-"));
  process.env.ACADEMY_DATA_DIR = dir;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.ACADEMY_DATA_DIR;
});

const perfect = (id: string) =>
  Object.fromEntries(getLesson(id)!.knowledgeCheck.map((q) => [q.id, q.answer]));
const wrong = (id: string) =>
  Object.fromEntries(getLesson(id)!.knowledgeCheck.map((q) => [q.id, (q.answer + 1) % q.options.length]));

async function redirected(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("REDIRECT:")) return decodeURIComponent(m.slice(9));
    throw e;
  }
  return null;
}

function form(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
}

describe("learner journey", () => {
  it("blocks a locked lesson until the prerequisite check is passed", async () => {
    await expect(submitCheck("sla-slo-sli", perfect("sla-slo-sli"))).rejects.toThrow(/locked/i);
    expect(readState().evidence).toHaveLength(0);

    await submitCheck("dora-metrics", perfect("dora-metrics"));
    const r = await submitCheck("sla-slo-sli", perfect("sla-slo-sli"));
    expect(r.passed).toBe(true);
  });

  it("records a failed attempt as evidence without awarding XP, then rewards the retry", async () => {
    const fail = await submitCheck("dora-metrics", wrong("dora-metrics"));
    expect(fail.passed).toBe(false);
    expect(computeXp(readState().evidence).total).toBe(0);
    expect(readState().evidence).toHaveLength(1);

    await submitCheck("dora-metrics", perfect("dora-metrics"));
    // 20 base + 50 improvement (first attempt 0%, now 100%)
    expect(computeXp(readState().evidence).total).toBe(70);
  });

  it("rejects build and defence submissions that skip steps or lack required fields", async () => {
    const lessonId = "dora-metrics";
    const goodText = "I built the calculator and tested it against a simulated deployment log.";

    // Not passed the knowledge check yet
    let url = await redirected(
      submitWork(form({ lessonId, mode: "build", content: goodText, artifactRef: "r", dataLabel: "REAL" })),
    );
    expect(url).toContain("error=Pass the knowledge check first");

    await submitCheck(lessonId, perfect(lessonId));

    url = await redirected(submitWork(form({ lessonId, mode: "build", content: "short", artifactRef: "r", dataLabel: "REAL" })));
    expect(url).toContain("at least 30 characters");

    url = await redirected(submitWork(form({ lessonId, mode: "build", content: goodText, artifactRef: "", dataLabel: "REAL" })));
    expect(url).toContain("artifact reference");

    url = await redirected(submitWork(form({ lessonId, mode: "build", content: goodText, artifactRef: "r", dataLabel: "" })));
    expect(url).toContain("REAL or SIMULATED");

    url = await redirected(submitWork(form({ lessonId, mode: "defend", content: goodText })));
    expect(url).toContain("build deliverable before the defence");

    expect(readState().submissions).toHaveLength(0);
  });

  it("walks a lesson from check to build to defence to mastery, gated by review", async () => {
    const lessonId = "dora-metrics";
    const text = "Calculator in the repo; all four metrics computed and classed. Known gap: no live data.";

    await submitCheck(lessonId, perfect(lessonId));
    expect(computeCompetency("Delivery", readState().evidence).level).toBe(1);

    const ok = await redirected(
      submitWork(form({ lessonId, mode: "build", content: text, artifactRef: "https://example.test/repo", dataLabel: "SIMULATED" })),
    );
    expect(ok).toContain("ok=Submitted for review");

    // Submitted but unreviewed: no XP, no mastery movement, mission waits.
    let s = readState();
    expect(computeXp(s.evidence).total).toBe(20);
    let d = buildDashboard(orderedLessons(), s, "2026-10-11");
    expect(d.pendingReviews).toBe(1);
    expect(d.mission?.awaitingReview).toBe(true);

    // Reviewer scores the build.
    const buildSub = s.submissions.find((x) => x.kind === "artifact")!;
    const url = await redirected(
      submitReview(form({ submissionId: buildSub.id, score: "80", notes: "Meets criteria; edge cases covered" })),
    );
    expect(url).toContain("ok=Review saved");
    s = readState();
    expect(computeXp(s.evidence).total).toBe(20 + 60);
    expect(computeCompetency("Delivery", s.evidence).level).toBe(2);

    // Defence, now allowed.
    await redirected(submitWork(form({ lessonId, mode: "defend", content: text + " Defence answers follow for each question." })));
    const defSub = readState().submissions.find((x) => x.kind === "defence")!;
    await redirected(submitReview(form({ submissionId: defSub.id, score: "90", notes: "Strong on trade-offs" })));

    s = readState();
    expect(computeXp(s.evidence).total).toBe(20 + 60 + 80);
    expect(computeCompetency("Delivery", s.evidence).level).toBe(3);
    d = buildDashboard(orderedLessons(), s, "2026-10-11");
    expect(d.statuses.find((x) => x.lesson.id === lessonId)?.nextStep).toBe("done");
    expect(d.mission?.lessonId).toBe("sla-slo-sli");
  });

  it("does not credit a flagged or failing review", async () => {
    const lessonId = "dora-metrics";
    await submitCheck(lessonId, perfect(lessonId));
    await redirected(
      submitWork(form({ lessonId, mode: "build", content: "x".repeat(40), artifactRef: "ref", dataLabel: "REAL" })),
    );
    const sub = readState().submissions[0];
    await redirected(submitReview(form({ submissionId: sub.id, score: "95", notes: "Not sure", flag: "on" })));
    expect(computeXp(readState().evidence).total).toBe(20); // check only
  });

  it("rejects bad review input and double review", async () => {
    await submitCheck("dora-metrics", perfect("dora-metrics"));
    await redirected(
      submitWork(form({ lessonId: "dora-metrics", mode: "build", content: "y".repeat(40), artifactRef: "ref", dataLabel: "REAL" })),
    );
    const sub = readState().submissions[0];
    expect(await redirected(submitReview(form({ submissionId: sub.id, score: "140", notes: "n" })))).toContain("0-100");
    expect(await redirected(submitReview(form({ submissionId: sub.id, score: "70", notes: "" })))).toContain("notes are required");
    await redirected(submitReview(form({ submissionId: sub.id, score: "70", notes: "ok" })));
    expect(await redirected(submitReview(form({ submissionId: sub.id, score: "70", notes: "again" })))).toContain("already reviewed");
    // Direct store call agrees.
    expect(() => reviewSubmission({ submissionId: sub.id, score: 0.7, needsHumanReview: false, notes: "x", assessedBy: "human" })).toThrow();
  });

  it("saves the daily schedule and the next mission uses it", async () => {
    const url = await redirected(
      saveScheduleAction(form({ framework: "10", fundamentals: "20", project: "90", assessment: "10" })),
    );
    expect(url).toContain("ok=Saved");
    const s = readState();
    const d = buildDashboard(orderedLessons(), s, "2026-10-11");
    expect(d.mission?.minutes).toBe(30);
  });
});
