/**
 * Decision loop: trains judgement, not recall.
 *
 * §6 of the mission asks for structured exercises that train how the learner
 * thinks: frame the problem, decide fast with stated uncertainty, weigh
 * alternatives, look for second-order effects, articulate for an executive,
 * survive adversarial challenge, then compare the first decision with the final
 * defended one.
 *
 * Rules that make this honest rather than motivational:
 * - Speed is never rewarded above correctness; the time limit records how fast
 *   you decided, it does not score you higher for being fast.
 * - The mentor may challenge, but never records a competency level.
 * - Every attempt is kept. Calibration compares attempt 1 with the final one.
 */

export const DECISION_STAGES = [
  "frame",
  "decide",
  "tradeoffs",
  "second-order",
  "articulate",
  "challenge",
  "calibrate",
] as const;

export type DecisionStage = (typeof DECISION_STAGES)[number];

export const STAGE_LABELS: Record<DecisionStage, string> = {
  frame: "Problem framing",
  decide: "Rapid decision",
  tradeoffs: "Trade-off analysis",
  "second-order": "Second-order thinking",
  articulate: "Executive articulation",
  challenge: "Adversarial challenge",
  calibrate: "Reflection and calibration",
};

/** Configurable so difficulty can rise as competence does. */
export interface DecisionRules {
  /** Minutes allowed for the initial recommendation. */
  initialDecisionMinutes: number;
  /** Max adversarial follow-up questions the mentor may ask. */
  maxChallengeRounds: number;
  /** Proficiency above which scenarios get harder. */
  advancedAtLevel: number;
  /** Time box for the initial call, in minutes. */
  timeBoxMinutes: number;
}

export const DECISION_RULES: DecisionRules = {
  initialDecisionMinutes: 15,
  maxChallengeRounds: 4,
  advancedAtLevel: 3,
  timeBoxMinutes: 10,
};

export interface DecisionFraming {
  /** The actual decision, in one sentence. Not the topic. */
  decision: string;
  desiredOutcome: string;
  constraints: string[];
  stakeholders: string[];
  unknowns: string[];
  assumptions: { assumption: string; howToValidate: string }[];
}

export interface RapidDecision {
  recommendation: string;
  rationale: string;
  risks: string[];
  /** What new evidence would change the call. */
  wouldChangeMyMind: string;
  /** Minutes actually taken, recorded but never scored as a bonus. */
  minutesTaken: number;
}

export interface TradeOffOption {
  id: string;
  title: string;
  criteria: Record<string, number>;
  notes?: string;
}

export interface TradeOffAnalysis {
  criteria: { id: string; weight: number }[];
  options: TradeOffOption[];
  preferred: string;
  /** The compromise being accepted by choosing the preferred option. */
  compromiseAccepted: string;
}

export interface SecondOrderAnalysis {
  downstream: string[];
  failureModes: string[];
  organisationalImpact: string[];
  operationalCost: string[];
  futureConstraints: string[];
}

export interface ExecutiveArticulation {
  summary: string;
  businessJustification: string;
  technicalRationale: string;
}

export interface ChallengeRound {
  question: string;
  answer: string;
  /** What the answer exposed: a changed mind, a held position, or a gap. */
  outcome: "changed" | "held" | "gap";
}

export interface DecisionAttempt {
  id: string;
  createdAt: string;
  scenarioId: string;
  scenarioTitle: string;
  /** Proficiency when attempted, so difficulty can be compared over time. */
  levelAtAttempt: number;
  framing: DecisionFraming;
  initialDecision: RapidDecision;
  tradeOff?: TradeOffAnalysis;
  secondOrder?: SecondOrderAnalysis;
  articulation?: ExecutiveArticulation;
  challenges: ChallengeRound[];
  /** Final position after challenge, if it moved. */
  finalDecision?: string;
  calibration?: Calibration;
}

export interface Calibration {
  /** What genuinely improved between the first call and the final one. */
  improved: string;
  /** What the first call missed entirely. */
  missed: string;
  /** Which mental model to strengthen next. */
  modelToStrengthen: string;
  /** First-attempt versus final comparison, kept separate from any score. */
  firstVsFinal: string;
}

/** Deterministic weighted total. Useful for explanation, never a verdict. */
export function scoreTradeOff(a: TradeOffAnalysis): Record<string, number> {
  const totals: Record<string, number> = {};
  const weightSum = a.criteria.reduce((s, c) => s + c.weight, 0);
  for (const opt of a.options) {
    let total = 0;
    for (const c of a.criteria) {
      const score = opt.criteria[c.id];
      if (typeof score !== "number") continue;
      total += (weightSum === 0 ? c.weight : c.weight / weightSum) * score;
    }
    totals[opt.id] = Math.round(total * 1000) / 1000;
  }
  return totals;
}

export interface TradeOffFinding {
  optionId: string;
  total: number;
  preferred: boolean;
  /** Criteria where this option is beaten by another. */
  lostOn: string[];
}

/**
 * Explains the result instead of deciding it. A higher total is not the answer:
 * a defensible decision can reject the top-scoring option on grounds the
 * matrix cannot express, and the finding says so.
 */
export function explainTradeOff(a: TradeOffAnalysis): { findings: TradeOffFinding[]; caution: string } {
  const totals = scoreTradeOff(a);
  const ids = Object.keys(totals);
  const findings: TradeOffFinding[] = ids.map((id) => {
    const opt = a.options.find((o) => o.id === id)!;
    const lostOn: string[] = [];
    for (const c of a.criteria) {
      const mine = opt.criteria[c.id];
      if (typeof mine !== "number") continue;
      const beaten = ids.some((other) => {
        if (other === id) return false;
        const o = a.options.find((x) => x.id === other);
        const theirs = o?.criteria[c.id];
        return typeof theirs === "number" && theirs > mine;
      });
      if (beaten) lostOn.push(c.id);
    }
    return { optionId: id, total: totals[id], preferred: id === a.preferred, lostOn };
  });
  findings.sort((x, y) => y.total - x.total);
  const caution = findings.length && findings[0].optionId !== a.preferred
    ? "Your chosen option is not the highest scoring. That can be correct if the matrix omits a decisive factor. State what it omits, or change the choice."
    : "A higher score is not a decision. Confirm the weights reflect what actually matters here.";
  return { findings, caution };
}

export function validateFraming(f: DecisionFraming): string[] {
  const problems: string[] = [];
  if (!f.decision.trim()) problems.push("State the actual decision in one sentence.");
  if (!f.desiredOutcome.trim()) problems.push("State the outcome you are trying to achieve.");
  if (f.constraints.length === 0) problems.push("List at least one real constraint.");
  if (f.stakeholders.length === 0) problems.push("Name at least one affected stakeholder.");
  if (f.assumptions.length === 0) problems.push("List the assumptions you are relying on.");
  for (const a of f.assumptions) {
    if (!a.assumption.trim()) problems.push("An assumption is blank.");
    else if (!a.howToValidate.trim()) problems.push(`"${a.assumption}" has no way to validate it.`);
  }
  return problems;
}

export function validateRapidDecision(d: RapidDecision): string[] {
  const problems: string[] = [];
  if (!d.recommendation.trim()) problems.push("Give an initial recommendation.");
  if (!d.rationale.trim()) problems.push("Give a short rationale.");
  if (!d.wouldChangeMyMind.trim()) problems.push("State what evidence would change your recommendation.");
  if (!(d.minutesTaken > 0)) problems.push("Record how long the initial call took.");
  if (d.minutesTaken > DECISION_RULES.initialDecisionMinutes) {
    problems.push(`The initial call took ${d.minutesTaken} minutes, over the ${DECISION_RULES.initialDecisionMinutes} minute limit. That is recorded for calibration, not penalised.`);
  }
  return problems;
}

/** Scenario difficulty is chosen from demonstrated level, never from a self-rating. */
export function difficultyFor(level: number, base = "standard"): "standard" | "advanced" {
  return level >= DECISION_RULES.advancedAtLevel ? "advanced" : "standard";
}
