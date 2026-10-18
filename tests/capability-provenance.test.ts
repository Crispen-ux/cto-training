import { describe, expect, it } from "vitest";
import { COMPETENCY_PROVENANCE, provenanceFor, provenanceStatus, type SourceKind } from "@/lib/capability-provenance";
import { loadCompetencies, computeGaps } from "@/lib/capability";

describe("competency provenance is real", () => {
  it("only references competencies that exist", () => {
    const ids = new Set(loadCompetencies().map((c) => c.id));
    const unknown = COMPETENCY_PROVENANCE.map((p) => p.competencyId).filter((c) => !ids.has(c));
    expect(unknown, `fabricated competency ids: ${unknown.join(", ")}`).toEqual([]);
  });

  it("declares at least one source per entry", () => {
    for (const p of COMPETENCY_PROVENANCE) {
      expect(p.sources.length, p.competencyId).toBeGreaterThan(0);
    }
  });

  it("uses only the four source kinds the mission distinguishes", () => {
    const allowed: SourceKind[] = ["formal-requirement", "industry-practice", "informed-recommendation", "academy-exercise"];
    for (const p of COMPETENCY_PROVENANCE) {
      for (const s of p.sources) expect(allowed, `${p.competencyId}: ${s.kind}`).toContain(s.kind);
    }
  });

  it("records an ISO review date on every source", () => {
    for (const p of COMPETENCY_PROVENANCE) {
      for (const s of p.sources) {
        expect(s.reviewed, `${p.competencyId} / ${s.title}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it("uses https URLs, never http", () => {
    for (const p of COMPETENCY_PROVENANCE) {
      for (const s of p.sources) expect(s.url, `${p.competencyId} / ${s.title}`).toMatch(/^https:\/\//);
    }
  });

  it("does not point at the paywalled ISO page as if it were read", () => {
    // ISO/IEC 25010 is behind a paywall; the note must say so rather than
    // implying the Academy read the standard.
    const iso = COMPETENCY_PROVENANCE.flatMap((p) => p.sources).find((s) => s.url.includes("iso.org"));
    if (iso) expect(iso.note ?? "").toMatch(/paywalled|licensed/i);
  });

  it("flags COBIT as licensed rather than read", () => {
    const cobit = COMPETENCY_PROVENANCE.flatMap((p) => p.sources).find((s) => /cobit/i.test(s.url));
    if (cobit) expect(cobit.note ?? "").toMatch(/licensed|framework level/i);
  });

  it("mixes formal requirements with industry practice where both exist", () => {
    const kinds = new Set(COMPETENCY_PROVENANCE.flatMap((p) => p.sources.map((s) => s.kind)));
    expect(kinds.has("formal-requirement")).toBe(true);
    expect(kinds.has("industry-practice")).toBe(true);
  });
});

describe("provenance is reported honestly, never invented", () => {
  it("marks a competency with declared provenance", () => {
    expect(provenanceStatus({ id: "reliability" } as never)).toBe("declared");
    expect(provenanceFor("reliability")?.sources.length).toBeGreaterThan(2);
  });

  it("says 'none' rather than guessing when nothing is declared", () => {
    const c = loadCompetencies().find((x) => !provenanceFor(x.id))!;
    expect(provenanceFor(c.id)).toBeUndefined();
  });

  it("surfaces provenance and source kinds on the gap record", () => {
    const gaps = computeGaps([], "CTO / Technology Strategist");
    const reliability = gaps.find((g) => g.competencyId === "reliability")!;
    expect(reliability.provenance).toBe("declared");
    expect(reliability.sourceKinds.length).toBeGreaterThan(0);

    const declaredWithRubric = gaps.find((g) => g.competencyId === "cto-delivery")!;
    expect(declaredWithRubric.specificRubric).toBe(true);

    const noProvenance = gaps.find((g) => g.provenance !== "declared")!;
    expect(noProvenance.sourceKinds).toEqual([]);
  });
});

describe("rubrics are competency specific where they matter most", () => {
  it("declares competency-specific levels for the evidence-producing competencies", () => {
    for (const id of ["reliability", "cto-delivery", "arch-docs", "arch-tradeoffs", "cto-exec"]) {
      const p = provenanceFor(id)!;
      expect(p.rubric, id).toBeDefined();
      expect(p.rubric!.length, id).toBe(5);
      expect(new Set(p.rubric!).size, `${id} rubric levels must differ`).toBe(5);
    }
  });

  it("does not claim a rubric it does not have", () => {
    const undeclared = COMPETENCY_PROVENANCE.filter((p) => !p.rubric).map((p) => p.competencyId);
    for (const id of undeclared) expect(provenanceFor(id)!.rubric).toBeUndefined();
  });
});
