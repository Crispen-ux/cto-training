import { describe, expect, it } from "vitest";
import { orderedLessons } from "@/lib/content";
import { buildDashboard } from "@/lib/dashboard";
import { DEFAULT_SETTINGS, type Submission } from "@/lib/store";
import type { Evidence } from "@/lib/engine";

const lessons = orderedLessons();
let n = 0;
const ev = (p: Partial<Evidence>): Evidence => ({
  id: `d${++n}`,
  lessonId: "dora-metrics",
  pillar: "Delivery",
  type: "knowledge_check",
  score: 1,
  passed: true,
  assessedBy: "auto",
  needsHumanReview: false,
  createdAt: "2026-10-11T08:00:00.000Z",
  ...p,
});
const state = (evidence: Evidence[], submissions: Submission[] = []) => ({
  evidence,
  submissions,
  settings: DEFAULT_SETTINGS,
});

describe("dashboard", () => {
  it("starts with the first lesson as a Learn mission and later lessons locked", () => {
    const d = buildDashboard(lessons, state([]), "2026-10-11");
    expect(d.mission?.lessonId).toBe("dora-metrics");
    expect(d.mission?.step).toBe("learn");
    expect(d.mission?.minutes).toBe(40); // 15 + 25 default schedule
    expect(d.statuses.find((s) => s.lesson.id === "sla-slo-sli")?.unlocked).toBe(false);
    expect(d.xp.total).toBe(0);
  });

  it("unlocks the next lesson from a passed knowledge check, and moves to Build", () => {
    const d = buildDashboard(lessons, state([ev({})]), "2026-10-11");
    expect(d.mission?.step).toBe("build");
    expect(d.mission?.minutes).toBe(60);
    expect(d.statuses.find((s) => s.lesson.id === "sla-slo-sli")?.unlocked).toBe(true);
    expect(d.xp.total).toBe(20);
  });

  it("flags a mission as waiting on review when a submission is pending", () => {
    const sub: Submission = {
      id: "s1",
      lessonId: "dora-metrics",
      pillar: "Delivery",
      kind: "artifact",
      content: "x",
      createdAt: "2026-10-11T09:00:00.000Z",
      status: "pending",
    };
    const d = buildDashboard(lessons, state([ev({})], [sub]), "2026-10-11");
    expect(d.mission?.awaitingReview).toBe(true);
    expect(d.pendingReviews).toBe(1);
  });

  it("does not move on when the only evidence is self-assessed", () => {
    const d = buildDashboard(lessons, state([ev({ assessedBy: "self" })]), "2026-10-11");
    expect(d.mission?.step).toBe("learn");
    expect(d.xp.total).toBe(0);
  });

  it("reports pillar competency independently", () => {
    const d = buildDashboard(lessons, state([ev({})]), "2026-10-11");
    expect(d.competencies.find((c) => c.pillar === "Delivery")?.level).toBe(1);
    expect(d.competencies.find((c) => c.pillar === "Tech")?.level).toBe(0);
  });
});
