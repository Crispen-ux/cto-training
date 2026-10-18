import { describe, expect, it } from "vitest";
import {
  DECISION_RULES,
  DECISION_STAGES,
  scoreTradeOff,
  explainTradeOff,
  validateFraming,
  validateRapidDecision,
  difficultyFor,
  type TradeOffAnalysis,
} from "@/lib/decision-loop";

const analysis = (): TradeOffAnalysis => ({
  criteria: [
    { id: "cost", weight: 3 },
    { id: "delivery-speed", weight: 2 },
    { id: "reversibility", weight: 1 },
  ],
  options: [
    { id: "buy", title: "Buy", criteria: { cost: 2, "delivery-speed": 5, reversibility: 1 } },
    { id: "build", title: "Build", criteria: { cost: 4, "delivery-speed": 2, reversibility: 5 } },
  ],
  preferred: "build",
  compromiseAccepted: "Slower delivery for reversibility.",
});

describe("trade-off analysis explains rather than decides", () => {
  it("normalises weights and produces a deterministic total", () => {
    const t = scoreTradeOff(analysis());
    // weights 3+2+1 = 6 -> buy = (3/6*2)+(2/6*5)+(1/6*1) = 1+1.667+0.167 = 2.833
    expect(t.buy).toBeCloseTo(2.833, 2);
    // build = (3/6*4)+(2/6*2)+(1/6*5) = 2+0.667+0.833 = 3.5
    expect(t.build).toBeCloseTo(3.5, 2);
  });

  it("sorts findings by score and flags the preferred option", () => {
    const { findings } = explainTradeOff(analysis());
    expect(findings[0].optionId).toBe("build");
    expect(findings.find((f) => f.optionId === "build")!.preferred).toBe(true);
  });

  it("records where the chosen option loses", () => {
    const { findings } = explainTradeOff(analysis());
    const build = findings.find((f) => f.optionId === "build")!;
    expect(build.lostOn).toContain("delivery-speed");
    expect(build.lostOn).not.toContain("reversibility");
  });

  it("warns when the chosen option is not the top scoring one", () => {
    const a = { ...analysis(), preferred: "buy" };
    const { caution } = explainTradeOff(a);
    expect(caution).toMatch(/not the highest scoring/);
  });

  it("does not call the matrix a decision", () => {
    const { caution } = explainTradeOff(analysis());
    expect(caution).toMatch(/not a decision|factor/i);
  });

  it("tolerates a zero total weight without dividing by zero", () => {
    const a = { ...analysis(), criteria: [{ id: "cost", weight: 0 }] };
    const t = scoreTradeOff(a);
    expect(Number.isFinite(t.buy)).toBe(true);
  });

  it("ignores a criterion an option was not scored against", () => {
    const a = { ...analysis(), options: [{ id: "x", title: "X", criteria: {} }] };
    expect(scoreTradeOff(a).x).toBe(0);
  });
});

describe("framing must name the decision, not the topic", () => {
  const base = {
    decision: "Whether to move the ledger to a managed database",
    desiredOutcome: "Cut month-end close from 5 days to 1",
    constraints: ["No downtime during migration", "Team of three"],
    stakeholders: ["Finance director", "On-call engineer"],
    unknowns: ["Whether the vendor supports our backup window"],
    assumptions: [{ assumption: "Vendor backup window is 1 hour", howToValidate: "Check the contract with the vendor" }],
  };

  it("accepts a complete framing", () => {
    expect(validateFraming(base)).toEqual([]);
  });

  it("rejects a framing with no actual decision", () => {
    expect(validateFraming({ ...base, decision: "  " }).join(" ")).toMatch(/actual decision/);
  });

  it("rejects assumptions with no way to validate them", () => {
    const bad = { ...base, assumptions: [{ assumption: "It will be fine", howToValidate: "" }] };
    expect(validateFraming(bad).join(" ")).toMatch(/no way to validate/);
  });

  it("requires constraints and stakeholders", () => {
    expect(validateFraming({ ...base, constraints: [] }).join(" ")).toMatch(/constraint/);
    expect(validateFraming({ ...base, stakeholders: [] }).join(" ")).toMatch(/stakeholder/);
  });
});

describe("rapid decision rewards discipline, not speed", () => {
  const good = {
    recommendation: "Stay on the current database this quarter",
    rationale: "Migration risk outweighs the 4-day saving before we know the backup window.",
    risks: ["Vendor may not meet the backup window"],
    wouldChangeMyMind: "A written confirmation of a 1-hour backup window",
    minutesTaken: 12,
  };

  it("accepts a well-formed rapid decision", () => {
    expect(validateRapidDecision(good)).toEqual([]);
  });

  it("requires what evidence would change the call", () => {
    expect(validateRapidDecision({ ...good, wouldChangeMyMind: "" }).join(" ")).toMatch(/would change/);
  });

  it("records going over the limit without penalising it", () => {
    const over = { ...good, minutesTaken: DECISION_RULES.initialDecisionMinutes + 10 };
    const problems = validateRapidDecision(over);
    expect(problems.join(" ")).toMatch(/recorded for calibration, not penalised/);
    // and nothing in the type treats minutes as a score
    expect(Object.keys(good)).not.toContain("speedBonus");
  });

  it("requires the minutes actually taken", () => {
    expect(validateRapidDecision({ ...good, minutesTaken: 0 }).join(" ")).toMatch(/how long/);
  });
});

describe("difficulty rises with demonstrated competence only", () => {
  it("is standard below the advanced threshold", () => {
    expect(difficultyFor(0)).toBe("standard");
    expect(difficultyFor(2)).toBe("standard");
  });

  it("is advanced at or above it", () => {
    expect(difficultyFor(DECISION_RULES.advancedAtLevel)).toBe("advanced");
    expect(difficultyFor(5)).toBe("advanced");
  });
});

describe("the loop covers every stage the mission names", () => {
  it("has all seven stages", () => {
    expect(DECISION_STAGES).toEqual([
      "frame", "decide", "tradeoffs", "second-order", "articulate", "challenge", "calibrate",
    ]);
  });
});
