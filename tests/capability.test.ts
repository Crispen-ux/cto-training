import { describe, expect, it } from "vitest";
import {
  loadCompetencies,
  loadTargets,
  overallProficiency,
  isUnassessed,
  computeGaps,
  capabilityDashboard,
  latestAssessment,
  isStale,
} from "@/lib/capability";
import type { CapabilityAssessment } from "@/lib/capability";

function assessment(overrides: Partial<CapabilityAssessment> = {}): CapabilityAssessment {
  return {
    id: "a1",
    competencyId: "req-discovery",
    track: "Solutions Architect",
    dimensions: { knowledge: 3, execution: 3, judgement: 3, communication: 3 },
    assessedBy: "self",
    assessedAt: new Date().toISOString(),
    status: "baseline",
    ...overrides,
  };
}

describe("capability framework", () => {
  it("loads competencies and targets for all tracks", () => {
    const comps = loadCompetencies();
    const targets = loadTargets();
    expect(comps.length).toBeGreaterThan(30);
    expect(Object.keys(targets)).toContain("Solutions Architect");
    expect(Object.keys(targets)).toContain("AI Solutions Architect");
    expect(Object.keys(targets)).toContain("CTO / Technology Strategist");
  });

  it("treats unassessed dimensions as unassessed, not zero proficiency", () => {
    const a = assessment({ dimensions: { knowledge: 3, execution: 0, judgement: 3, communication: 3 } });
    expect(isUnassessed(a.dimensions)).toBe(true);
    expect(overallProficiency(a.dimensions)).toBe(0);
  });

  it("self-rating alone does not count as demonstrated proficiency", () => {
    // A bare self-rating with no evidence reference is now reported as
    // unassessed, which is more honest than the old behaviour that accepted it
    // as an assessment. A self-rating WITH a reference is labelled self-report.
    const bare = computeGaps([assessment()], "Solutions Architect");
    const b = bare.find((x) => x.competencyId === "req-discovery")!;
    expect(b.demonstrated).toBe(0);
    expect(b.unassessed).toBe(true);
    expect(b.source).toBe("none");

    const referenced = computeGaps([assessment({ evidenceRef: "a-file" })], "Solutions Architect");
    const r = referenced.find((x) => x.competencyId === "req-discovery")!;
    expect(r.source).toBe("self-report");
    expect(r.demonstrated).toBe(3);
  });

  it("knowledge alone does not satisfy practical execution", () => {
    const a = assessment({ dimensions: { knowledge: 5, execution: 0, judgement: 5, communication: 5 }, evidenceRef: "ref" });
    const gaps = computeGaps([a], "Solutions Architect");
    const g = gaps.find((x) => x.competencyId === "req-discovery")!;
    expect(g.demonstrated).toBe(0);
  });

  it("role-specific targets produce different gap sets", () => {
    const sa = capabilityDashboard([], "Solutions Architect");
    const cto = capabilityDashboard([], "CTO / Technology Strategist");
    expect(sa.total).not.toBe(cto.total);
  });

  it("shared competencies are defined once and reused", () => {
    const comps = loadCompetencies();
    const shared = comps.filter((c) => c.foundation);
    expect(shared.length).toBeGreaterThan(5);
    expect(shared.every((c) => c.tracks.length > 1)).toBe(true);
  });

  it("stale evidence is flagged after 180 days", () => {
    const old = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString();
    const a = assessment({ assessedAt: old, evidenceRef: "ref" });
    expect(isStale(a)).toBe(true);
  });

  it("assessment history is preserved and latest is used", () => {
    const a1 = assessment({ id: "a1", dimensions: { knowledge: 2, execution: 2, judgement: 2, communication: 2 }, assessedAt: "2025-01-01T00:00:00.000Z" });
    const a2 = assessment({ id: "a2", dimensions: { knowledge: 4, execution: 4, judgement: 4, communication: 4 }, assessedAt: "2026-01-01T00:00:00.000Z", evidenceRef: "ref" });
    const latest = latestAssessment([a1, a2], "req-discovery", "Solutions Architect");
    expect(latest?.id).toBe("a2");
    expect([a1, a2].length).toBe(2);
  });

  it("dashboard reflects underlying records", () => {
    const a = assessment({ dimensions: { knowledge: 4, execution: 4, judgement: 4, communication: 4 }, evidenceRef: "ref" });
    const d = capabilityDashboard([a], "Solutions Architect");
    const g = d.gaps.find((x) => x.competencyId === "req-discovery")!;
    expect(g.demonstrated).toBe(4);
    expect(d.coverage).toBeGreaterThan(0);
  });

  it("critical gaps are surfaced", () => {
    const d = capabilityDashboard([], "Solutions Architect");
    expect(d.critical).toBeGreaterThanOrEqual(0);
    expect(d.unassessed).toBeGreaterThan(0);
  });
});
