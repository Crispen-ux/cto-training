import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { deriveFromEvidence, loadLessonMap, lessonsForCompetency, unevidencedCompetencies, RUBRIC_VERSION } from "@/lib/capability-evidence";
import { capabilityDashboard, computeGaps } from "@/lib/capability";
import { loadCompetencies, loadTargets } from "@/lib/capability";
import type { Evidence } from "@/lib/engine";

function ev(over: Partial<Evidence> = {}): Evidence {
  return {
    id: "e1",
    lessonId: "dora-metrics",
    pillar: "Delivery",
    type: "artifact",
    score: 0.8,
    passed: true,
    assessedBy: "human",
    needsHumanReview: false,
    createdAt: new Date().toISOString(),
    ...over,
  };
}

describe("the lesson to competency map is honest", () => {
  const map = loadLessonMap();

  it("only references lessons that exist", () => {
    const files = new Set(
      fs.readdirSync(path.join(process.cwd(), "content", "lessons"))
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(/\.json$/, "")),
    );
    const unknown = Object.keys(map.lessonToCompetencies).filter((id) => !files.has(id));
    expect(unknown, `fabricated lesson ids: ${unknown.join(", ")}`).toEqual([]);
  });

  it("only references competencies that exist", () => {
    const ids = new Set(loadCompetencies().map((c) => c.id));
    const unknown = [...new Set(Object.values(map.lessonToCompetencies).flat())].filter((c) => !ids.has(c));
    expect(unknown, `fabricated competency ids: ${unknown.join(", ")}`).toEqual([]);
  });

  it("maps a meaningful share of the curriculum", () => {
    expect(Object.keys(map.lessonToCompetencies).length).toBeGreaterThan(40);
  });

  it("records studio sources separately rather than inventing lesson ids", () => {
    // sa-azure / sa-aws / sa-oci have no lesson file, so they must not appear
    // as lessons in the map; their provenance is declared instead.
    expect(map.lessonToCompetencies["sa-azure"]).toBeUndefined();
    expect(map.studioSources?.["sa-azure"]).toBeTruthy();
  });

  it("can reverse a competency back to its lessons", () => {
    expect(lessonsForCompetency("reliability").length).toBeGreaterThan(2);
  });
});

describe("demonstrated proficiency comes only from reviewed evidence", () => {
  it("ignores failed evidence", () => {
    const d = deriveFromEvidence([ev({ passed: false })]);
    expect(d.size).toBe(0);
  });

  it("ignores self-assessed evidence", () => {
    expect(deriveFromEvidence([ev({ assessedBy: "self" })]).size).toBe(0);
  });

  it("ignores evidence flagged for human review", () => {
    expect(deriveFromEvidence([ev({ needsHumanReview: true })]).size).toBe(0);
  });

  it("ignores evidence for an unmapped lesson", () => {
    expect(deriveFromEvidence([ev({ lessonId: "no-such-lesson" })]).size).toBe(0);
  });

  it("raises the competencies a lesson is mapped to", () => {
    const d = deriveFromEvidence([ev()]);
    expect(d.has("cto-delivery")).toBe(true);
    expect(d.has("reliability")).toBe(true);
  });

  it("never lets a knowledge check alone produce a demonstrated level", () => {
    const d = deriveFromEvidence([ev({ type: "knowledge_check", score: 1 })]);
    const rec = d.get("cto-delivery")!;
    expect(rec.dimensions.knowledge).toBe(5);
    expect(rec.dimensions.execution).toBe(0);
    expect(rec.demonstrated, "overall is the weakest evidenced dimension").toBe(0);
  });

  it("needs a defence before communication counts at all", () => {
    const d = deriveFromEvidence([ev({ type: "knowledge_check" }), ev({ type: "artifact", id: "e2" })]);
    expect(d.get("cto-delivery")!.dimensions.communication).toBe(0);
    expect(d.get("cto-delivery")!.demonstrated).toBe(0);
  });

  it("caps an AI judgement score below human-reviewed judgement", () => {
    const ai = deriveFromEvidence([
      ev({ type: "defence", assessedBy: "ai", score: 1, id: "a" }),
    ]).get("cto-delivery")!;
    expect(ai.dimensions.judgement).toBeLessThanOrEqual(3);
    expect(ai.humanReviewed).toBe(false);
  });

  it("caps AI-only communication below human-reviewed communication", () => {
    const ai = deriveFromEvidence([ev({ type: "defence", assessedBy: "ai", score: 1 })]).get("cto-delivery")!;
    expect(ai.dimensions.communication).toBeLessThanOrEqual(3);
  });

  it("credits a human-reviewed defence as demonstrated ability", () => {
    const rec = deriveFromEvidence([
      ev({ type: "knowledge_check", score: 0.9, id: "k" }),
      ev({ type: "artifact", score: 0.9, id: "a" }),
      ev({ type: "defence", score: 0.9, id: "d" }),
    ]).get("cto-delivery")!;
    expect(rec.demonstrated).toBeGreaterThanOrEqual(4);
    expect(rec.humanReviewed).toBe(true);
  });

  it("records the evidence ids so a rating can be audited", () => {
    const rec = deriveFromEvidence([ev({ id: "x1" }), ev({ id: "x2", lessonId: "sla-slo-sli" })]).get("reliability")!;
    expect(rec.sourceEvidenceIds.length).toBeGreaterThan(1);
    expect(rec.rubricVersion).toBe(RUBRIC_VERSION);
  });

  it("reports mapped competencies that have no evidence yet", () => {
    const missing = unevidencedCompetencies(["reliability"]);
    expect(missing).not.toContain("reliability");
    expect(missing.length).toBeGreaterThan(10);
  });
});

describe("the dashboard prefers evidence over self-report", () => {
  it("shows a demonstrated level once evidence exists", () => {
    const gaps = computeGaps([], "CTO / Technology Strategist", [
      ev({ type: "knowledge_check", score: 0.9, id: "k" }),
      ev({ type: "artifact", score: 0.9, id: "a" }),
      ev({ type: "defence", score: 0.9, id: "d" }),
    ]);
    const g = gaps.find((x) => x.competencyId === "cto-delivery")!;
    expect(g.source).toBe("evidence");
    expect(g.demonstrated).toBeGreaterThan(0);
    expect(g.evidenceIds.length).toBe(3);
    expect(g.weakestDimension).toBeTruthy();
  });

  it("labels self-report as self-report and never calls it evidence", () => {
    const gaps = computeGaps(
      [
        {
          id: "c1",
          competencyId: "cto-delivery",
          track: "CTO / Technology Strategist",
          dimensions: { knowledge: 4, execution: 4, judgement: 4, communication: 4 },
          evidenceRef: "a-file",
          assessedBy: "self",
          assessedAt: new Date().toISOString(),
          status: "baseline",
        },
      ],
      "CTO / Technology Strategist",
      [],
    );
    const g = gaps.find((x) => x.competencyId === "cto-delivery")!;
    expect(g.source).toBe("self-report");
  });

  it("keeps a no-evidence competency unassessed rather than zero", () => {
    const gaps = computeGaps([], "Solutions Architect", []);
    const g = gaps.find((x) => x.competencyId === "req-discovery")!;
    expect(g.unassessed).toBe(true);
    expect(g.source).toBe("none");
  });

  it("lets real evidence override an inflated self-rating", () => {
    const self = [
      {
        id: "c1",
        competencyId: "cto-delivery",
        track: "CTO / Technology Strategist" as const,
        dimensions: { knowledge: 5, execution: 5, judgement: 5, communication: 5 },
        evidenceRef: "claimed",
        assessedBy: "self" as const,
        assessedAt: new Date().toISOString(),
        status: "baseline" as const,
      },
    ];
    const weak = [ev({ type: "knowledge_check", score: 0.5, id: "k" })];
    const gaps = computeGaps(self, "CTO / Technology Strategist", weak);
    const g = gaps.find((x) => x.competencyId === "cto-delivery")!;
    expect(g.source).toBe("evidence");
    expect(g.demonstrated).toBe(0);
  });

  it("counts evidence-backed competencies on the dashboard", () => {
    const d = capabilityDashboard([], "Solutions Architect", [
      ev({ type: "knowledge_check", score: 0.9, id: "k" }),
      ev({ type: "artifact", score: 0.9, id: "a" }),
      ev({ type: "defence", score: 0.9, id: "d" }),
    ]);
    expect(d.fromEvidence).toBeGreaterThan(0);
  });

  it("gives an evidence-backed priority an explanation", () => {
    const d = capabilityDashboard([], "Solutions Architect", [
      ev({ type: "knowledge_check", score: 0.85, id: "k" }),
      ev({ type: "artifact", score: 0.85, id: "a" }),
    ]);
    const p = d.priorities.find((x) => x.competencyId === "cto-delivery");
    if (p) {
      expect(p.reasons.join(" ")).toMatch(/reviewed piece/);
      expect(p.reasons.join(" ")).toMatch(/Weakest dimension/);
    }
  });

  it("still works with no evidence at all", () => {
    const d = capabilityDashboard([], "AI Solutions Architect", []);
    expect(d.total).toBeGreaterThan(0);
    expect(d.fromEvidence).toBe(0);
    expect(d.priorities.length).toBeGreaterThan(0);
  });
});

describe("targets are unchanged by this work", () => {
  it("still holds one target set per track", () => {
    const t = loadTargets();
    expect(Object.keys(t)).toContain("Solutions Architect");
    expect(Object.keys(t)).toContain("AI Solutions Architect");
    expect(Object.keys(t)).toContain("CTO / Technology Strategist");
  });
});
