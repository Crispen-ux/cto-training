import { describe, expect, it } from "vitest";
import {
  ARTICULATION,
  ARTICULATION_LEVELS,
  ARTICULATION_RUBRIC_VERSION,
  VAGUE_PATTERNS,
  analyseLanguage,
  leadsWithConclusion,
  wordCount,
} from "@/lib/articulation";

describe("the articulation curriculum has five levels of real demand", () => {
  it("covers recommendation through challenge response", () => {
    expect(ARTICULATION_LEVELS).toEqual([
      "recommendation", "business-case", "architecture", "technical-defence", "challenge-response",
    ]);
  });

  it("gives every level an audience, a target and a rubric", () => {
    for (const l of ARTICULATION) {
      expect(l.audience.length, l.id).toBeGreaterThan(10);
      expect(l.prompt.length, l.id).toBeGreaterThan(20);
      expect(l.rubric.length, l.id).toBeGreaterThanOrEqual(4);
      const sum = l.rubric.reduce((s, r) => s + r.weight, 0);
      expect(Math.abs(sum - 1), `${l.id} rubric must sum to 1`).toBeLessThan(1e-9);
    }
  });

  it("length rises to the defence, then level 5 is deliberately terse", () => {
    // A challenge response should be shorter and sharper than a full defence.
    // Length is not monotonic, and pretending otherwise would reward padding.
    for (let i = 1; i < 4; i++) {
      expect(ARTICULATION[i].targetWords[1]).toBeGreaterThan(ARTICULATION[i - 1].targetWords[1]);
    }
    expect(ARTICULATION[4].targetWords[1]).toBeLessThan(ARTICULATION[3].targetWords[1]);
  });
});

describe("vague and unsupported language is identified", () => {
  it("challenges 'the system is secure' with the four questions §7 asks for", () => {
    const f = analyseLanguage("The system is secure.", "technical-defence");
    const abs = f.find((x) => x.challenge.includes("residual risk"));
    expect(abs).toBeTruthy();
    expect(abs!.challenge).toMatch(/threats/);
    expect(abs!.challenge).toMatch(/controls/);
    expect(abs!.challenge).toMatch(/evidence/);
  });

  it("flags superlatives with no measurement", () => {
    const f = analyseLanguage("This is a best-in-class, highly scalable solution.", "architecture");
    expect(f.some((x) => x.finding.includes("Superlative"))).toBe(true);
  });

  it("flags corporate jargon", () => {
    const f = analyseLanguage("We will leverage synergies to drive alignment going forward.", "business-case");
    expect(f.some((x) => x.kind === "filler")).toBe(true);
  });

  it("flags absolute claims", () => {
    expect(analyseLanguage("This will never fail.", "challenge-response").some((x) => x.finding.includes("Absolute"))).toBe(true);
  });

  it("flags improvement with no baseline", () => {
    const f = analyseLanguage("We will optimise performance.", "business-case");
    expect(f.some((x) => x.challenge.includes("baseline"))).toBe(true);
  });

  it("does not invent findings for a precise answer", () => {
    const precise = "I recommend migrating the ledger database this quarter. The close takes five days and blocks reporting. We measured it over three months.";
    expect(analyseLanguage(precise, "recommendation").filter((f) => f.kind === "vague" || f.kind === "filler")).toEqual([]);
  });

  it("every vague pattern carries a challenge question", () => {
    for (const v of VAGUE_PATTERNS) expect(v.challenge.length).toBeGreaterThan(10);
  });
});

describe("length is checked against the level, not a fixed quota", () => {
  it("flags an answer far too short for the level", () => {
    expect(analyseLanguage("Yes.", "technical-defence").some((f) => f.kind === "too-short")).toBe(true);
  });

  it("does not flag a correct length", () => {
    const mid = "I recommend we migrate the ledger database this quarter. Month-end close currently takes five days, measured across three months, and it blocks the finance team from reporting to customers. The cost is roughly forty thousand including migration effort and two weeks of engineer time. The main risk is the cutover window. We tested it twice in staging. If the vendor cannot confirm a one hour backup window in writing, we should not proceed and I would rather delay than accept an unverified recovery story.";
    const f = analyseLanguage(mid, "business-case");
    expect(f.some((x) => x.kind === "too-short")).toBe(false);
    expect(f.some((x) => x.kind === "too-long")).toBe(false);
  });

  it("flags an answer far too long", () => {
    expect(analyseLanguage("word ".repeat(900), "recommendation").some((f) => f.kind === "too-long")).toBe(true);
  });
});

describe("conclusion first is checkable", () => {
  it("accepts an answer that opens with the recommendation", () => {
    expect(leadsWithConclusion("I recommend migrating the database this quarter. The close takes five days.")).toBe(true);
    expect(leadsWithConclusion("We propose to adopt the managed service.")).toBe(true);
  });

  it("rejects an answer that opens with background", () => {
    expect(leadsWithConclusion("The system has been running for three years and we have had several incidents.")).toBe(false);
  });
});

describe("scoring stays interpretable", () => {
  it("versions the rubric", () => {
    expect(ARTICULATION_RUBRIC_VERSION).toBe("articulation-v1");
  });

  it("counts words simply", () => {
    expect(wordCount("  a  b\nc ")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
