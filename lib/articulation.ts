/**
 * Articulation curriculum (§7).
 *
 * Communication is trained as a capability, at five levels of increasing
 * demand, each scored on observable dimensions. The point is precision under
 * pressure, not vocabulary: a fluent answer with no evidence still fails.
 */

export const ARTICULATION_LEVELS = [
  "recommendation",
  "business-case",
  "architecture",
  "technical-defence",
  "challenge-response",
] as const;

export type ArticulationLevel = (typeof ARTICULATION_LEVELS)[number];

export interface LevelSpec {
  id: ArticulationLevel;
  label: string;
  prompt: string;
  /** Target shape of the answer, in words. A range, not a quota. */
  targetWords: [number, number];
  audience: string;
  rubric: { criterion: string; weight: number }[];
}

export const ARTICULATION: LevelSpec[] = [
  {
    id: "recommendation",
    label: "1. Concise executive recommendation",
    prompt: "State your recommendation and the single most important reason, in three sentences.",
    targetWords: [30, 80],
    audience: "An executive with five minutes and one question.",
    rubric: [
      { criterion: "Leads with the conclusion, not the background", weight: 0.35 },
      { criterion: "One reason, stated concretely", weight: 0.3 },
      { criterion: "No unsupported adjectives", weight: 0.2 },
      { criterion: "Fits the time given", weight: 0.15 },
    ],
  },
  {
    id: "business-case",
    label: "2. Business justification",
    prompt: "Justify the recommendation against measurable outcomes: cost, revenue, risk or customer impact.",
    targetWords: [80, 180],
    audience: "A CFO or budget holder who will ask what happens if you do nothing.",
    rubric: [
      { criterion: "Outcomes are measurable, not adjectives", weight: 0.3 },
      { criterion: "Cost of doing nothing is stated", weight: 0.25 },
      { criterion: "Assumptions labelled as assumptions", weight: 0.2 },
      { criterion: "Investment and payback are clear", weight: 0.25 },
    ],
  },
  {
    id: "architecture",
    label: "3. Architecture explanation",
    prompt: "Explain the chosen design to a senior engineer: boundaries, data flow, technology and the rejected alternative.",
    targetWords: [150, 400],
    audience: "A principal engineer who will look for the thing you have not considered.",
    rubric: [
      { criterion: "Boundaries and data flow are explicit", weight: 0.3 },
      { criterion: "Technology choices are justified, not asserted", weight: 0.25 },
      { criterion: "The rejected alternative is named", weight: 0.2 },
      { criterion: "Failure modes acknowledged", weight: 0.25 },
    ],
  },
  {
    id: "technical-defence",
    label: "4. Detailed technical defence",
    prompt: "Defend the design in depth, including what you would change and under what conditions.",
    targetWords: [250, 600],
    audience: "A design review board that will attack the weakest part.",
    rubric: [
      { criterion: "Survives scrutiny of the weakest component", weight: 0.3 },
      { criterion: "Limits and residual risks stated unprompted", weight: 0.25 },
      { criterion: "Evidence cited, not asserted", weight: 0.25 },
      { criterion: "Responsive to the question actually asked", weight: 0.2 },
    ],
  },
  {
    id: "challenge-response",
    label: "5. Response to challenge",
    prompt: "Answer a direct challenge to your position. You may hold, qualify or change your mind, but you must say which and why.",
    targetWords: [80, 250],
    audience: "A hostile reviewer who believes you are wrong.",
    rubric: [
      { criterion: "Answers the challenge directly, no deflection", weight: 0.3 },
      { criterion: "Holds, qualifies or changes mind explicitly", weight: 0.25 },
      { criterion: "No bluffing when the evidence is absent", weight: 0.25 },
      { criterion: "Stays composed and precise under pressure", weight: 0.2 },
    ],
  },
];

export const ARTICULATION_RUBRIC_VERSION = "articulation-v1";

export interface ArticulationScore {
  level: ArticulationLevel;
  /** 0..1 from the rubric. Not a claim of expertise. */
  score: number;
  perCriterion: { criterion: string; weight: number; met: boolean; note: string }[];
  findings: string[];
  rubricVersion: string;
  wordCount: number;
}

/**
 * Language that sounds authoritative but carries no information. §7 asks for
 * these to be identified explicitly.
 */
export const VAGUE_PATTERNS: { pattern: RegExp; finding: string; challenge: string }[] = [
  { pattern: /\b(very|highly|extremely|best[- ]in[- ]class|cutting[- ]edge|world[- ]class)\b/i, finding: "Superlative with no evidence.", challenge: "Compared to what, measured how?" },
  { pattern: /\b(seamless|robust|enterprise[- ]grade|scalable|efficient|optimal|holistic)\b/i, finding: "Unqualified claim.", challenge: "What is the measured value, and against which requirement?" },
  { pattern: /\bthe system is (secure|compliant|reliable|production[- ]ready)\b/i, finding: "Unsupported absolute.", challenge: "Which threats does this address, what controls enforce it, what evidence validates it, and what residual risk remains?" },
  { pattern: /\b(obviously|clearly|of course|simply|just)\b/i, finding: "Filler that signals certainty you have not earned.", challenge: "What would you need to see to be sure?" },
  { pattern: /\b(leverage|synerg|going forward|align(ment)?|holistic solution|value add)\b/i, finding: "Corporate jargon with no concrete referent.", challenge: "Say it as a specific action, cost or date." },
  { pattern: /\b(always|never|no one|everyone)\b/i, finding: "Absolute claim that is usually wrong.", challenge: "Under what condition would that not hold?" },
  { pattern: /\bwe (will|should) (improve|enhance|optimise|streamline)\b/i, finding: "Improvement claimed with no target.", challenge: "Improve from what measured baseline to what measured target, by when?" },
];

export interface DiagnosticFinding {
  kind: "vague" | "filler" | "too-short" | "too-long";
  finding: string;
  challenge: string;
  excerpt: string;
}

export function analyseLanguage(text: string, level: ArticulationLevel): DiagnosticFinding[] {
  const spec = ARTICULATION.find((l) => l.id === level)!;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  const out: DiagnosticFinding[] = [];

  for (const v of VAGUE_PATTERNS) {
    const m = v.pattern.exec(text);
    if (m) {
      const at = Math.max(0, m.index - 40);
      out.push({
        kind: v.finding.includes("jargon") || v.finding.includes("Filler") ? "filler" : "vague",
        finding: v.finding,
        challenge: v.challenge,
        excerpt: text.slice(at, m.index + 60).trim(),
      });
    }
  }

  const [min, max] = spec.targetWords;
  if (words < min) {
    out.push({ kind: "too-short", finding: `Only ${words} words against a ${min}-${max} target for this level.`, challenge: "What is the single most important thing the audience needs to know?", excerpt: "" });
  } else if (words > max * 2) {
    out.push({ kind: "too-long", finding: `${words} words is well over the ${min}-${max} target for this level.`, challenge: "What would you cut if you had 30 seconds?", excerpt: "" });
  }
  return out;
}

/** Filler openers that consume the first, most valuable sentence. */
export function leadsWithConclusion(text: string): boolean {
  const first = text.trim().split(/[.!?]/).filter(Boolean)[0] ?? "";
  return /^(i|we)\s+(recommend|propose|should|advise|will)/i.test(first)
    || /\b(recommendation|proposal)\b/i.test(first)
    || /^(do not|don't|stop|start|adopt|reject)\b/i.test(first);
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
