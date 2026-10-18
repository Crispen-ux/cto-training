import { analyseLanguage, wordCount } from "../articulation";
import type { DiagnosticFinding } from "../articulation";
import { citesRequirement } from "./scoring";

/**
 * Deterministic challenges for vague architecture claims.
 *
 * The Academy requires that claims such as "it is more secure", "it scales
 * better" or "it is cheaper" are challenged with the mechanism, the requirement
 * and the evidence. Language checks are reused from the articulation engine so
 * the same vocabulary is challenged in one place; the checks added here are the
 * ones specific to architecture reasoning.
 */

export interface ScenarioChallenge {
  /** The claim or phrase that triggered the challenge. */
  excerpt: string;
  finding: string;
  /** The question the learner has to answer to keep the claim. */
  challenge: string;
  /** Which decision step this challenges, so practice can be targeted. */
  step: string;
}

function excerptAround(text: string, index: number, length = 60): string {
  const at = Math.max(0, index - 40);
  return text.slice(at, index + length).trim();
}

function firstMatch(text: string, pattern: RegExp): { match: RegExpExecArray; excerpt: string } | null {
  const m = pattern.exec(text);
  if (!m) return null;
  return { match: m, excerpt: excerptAround(text, m.index) };
}

/**
 * Architecture-specific unsupported claims. Each one is a real failure mode in
 * design reviews, not a style complaint.
 *
 * These match on the predicate phrase rather than on a fixed subject, because
 * a real claim arrives as "this design is more secure", "the database is
 * cheaper", "it will be more resilient". Requiring a specific subject makes the
 * check silently miss most of what people actually write.
 */
const ARCHITECTURE_CLAIMS: { pattern: RegExp; finding: string; challenge: string; step: string }[] = [
  {
    pattern: /\b(?:is|are|will be|stays|remains)\s+(?:highly\s+)?(?:available|high[- ]availability)\b/i,
    finding: "Availability asserted without a failure mode.",
    challenge: "Available across which boundary - a zone, a region, or the network path in? Which failure does it survive, and what is the measured RTO?",
    step: "scale-recover-monitor",
  },
  {
    pattern: /\b(?:is|are|will be|stays|remains)\s+(?:cheaper|cost[- ]effective|cost[- ]efficient|less expensive|more affordable|the cheaper)\b/i,
    finding: "Cost claim with no workload attached.",
    challenge: "Cheaper at what call volume, over what period, counting which cost components? Show the comparison at the expected load, not at a trivial one.",
    step: "trade-offs",
  },
  {
    pattern: /\b(?:scales?|will scale|scales better|scales well|handles? (?:any|any amount of|any volume))\b/i,
    finding: "Scaling claimed without a limit or a mechanism.",
    challenge: "Scales to what? Name the bottleneck you expect first, the scaling mechanism that relieves it, and the point at which it stops helping.",
    step: "trade-offs",
  },
  {
    pattern: /\b(?:is|are|will be|stays|remains)\s+(?:more\s+)?secure\b/i,
    finding: "Security asserted without a threat.",
    challenge: "Which threat does this address, which control enforces it, what evidence validates it, and what residual risk remains?",
    step: "security",
  },
  {
    pattern: /\b(managed|serverless|kubernetes|microservices|data lake|event[- ]driven)\b(?![^.]{0,80}\b(because|since|as)\b)/i,
    finding: "A pattern named without the reason it fits this workload.",
    challenge: "What property of this workload makes that pattern the right one? What would you need to see for the opposite choice to win?",
    step: "pattern",
  },
  {
    pattern: /\bwe (?:can|could) (?:always|later|eventually) (?:add|migrate|move|change|replace)\b/i,
    finding: "Future flexibility offered as a reason now.",
    challenge: "What does doing it the other way cost today, specifically? If the later change is cheap, that is an argument for the simpler option now.",
    step: "alternatives",
  },
  {
    pattern: /\b(none of the alternatives|there is no alternative|the only (?:real )?option)\b/i,
    finding: "Alternatives dismissed rather than compared.",
    challenge: "What did you consider, and under exactly what condition would each of those have been the right answer?",
    step: "alternatives",
  },
  {
    pattern: /\bbest[- ]practice\b|\bstandard approach\b|\bindustry[- ]standard\b/i,
    finding: "Authority substituted for reasoning.",
    challenge: "Which specific requirement does following that practice satisfy here, and what does it cost you?",
    step: "why-better",
  },
];

/**
 * Challenges a rationale or design answer.
 *
 * Reused articulation checks catch vague language; the checks above catch vague
 * architecture. Both are deterministic and never score the learner - they only
 * name what has to be answered.
 */
export function challengeRationale(text: string, requirementTexts: string[] = []): ScenarioChallenge[] {
  const out: ScenarioChallenge[] = [];
  const seen = new Set<string>();

  const push = (c: ScenarioChallenge) => {
    const key = c.finding + c.excerpt;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(c);
  };

  for (const rule of ARCHITECTURE_CLAIMS) {
    const hit = firstMatch(text, rule.pattern);
    if (hit) {
      push({
        excerpt: hit.excerpt,
        finding: rule.finding,
        challenge: rule.challenge,
        step: rule.step,
      });
    }
  }

  // Language checks are shared with the articulation engine. The "architecture"
  // level sets the expected shape and length for this kind of answer.
  const language: DiagnosticFinding[] = analyseLanguage(text, "architecture");
  for (const l of language) {
    push({
      excerpt: l.excerpt,
      finding: l.finding,
      challenge: l.challenge,
      step: "why-better",
    });
  }

  // Anchoring: an architecture answer that never mentions a requirement cannot
  // be justified against anything.
  if (requirementTexts.length > 0) {
    const cited = requirementTexts.some((r) => citesRequirement(text, r));
    if (!cited) {
      push({
        excerpt: "",
        finding: "The answer is not anchored to a stated requirement.",
        challenge: `Which requirement justifies this? Scenario requirements include: ${requirementTexts.slice(0, 3).join(" / ")}`,
        step: "decisive",
      });
    }
  }

  return out;
}

/**
 * A rationale that is too short to carry a trade-off is not a weak rationale,
 * it is an absent one. This is separate from the language checks because it is
 * about substance, not style.
 */
export function rationaleIsSubstantive(text: string): { ok: boolean; words: number; reason?: string } {
  const words = wordCount(text);
  if (words < 25) {
    return {
      ok: false,
      words,
      reason: `${words} words cannot state a mechanism, a requirement and a trade-off. Write the decision and why it wins here.`,
    };
  }
  return { ok: true, words };
}

/**
 * A twist answer is judged only on whether it engages with the change. A learner
 * who restates their original answer has not adapted.
 */
export function engagesWithChange(original: string, revised: string, changeWords: string[]): boolean {
  const lower = revised.toLowerCase();
  const originalLower = original.toLowerCase();
  const newContent = changeWords.filter((w) => w.length > 3 && lower.includes(w.toLowerCase()));
  const unchanged = revised.trim() === original.trim();
  return !unchanged && newContent.length > 0;
}
