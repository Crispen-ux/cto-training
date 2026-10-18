import { RULES, type Rules } from "./rules";
import { counts } from "./xp";
import type { Evidence, Pillar } from "./types";

export interface Criterion {
  level: 1 | 2 | 3 | 4 | 5;
  label: string;
  met: boolean;
}

function passed(ev: Evidence[], type: Evidence["type"]) {
  return ev.filter((e) => e.type === type && e.passed);
}

/**
 * Academy competency level (0-5) for one pillar, from evidence only.
 * Levels are cumulative: a level is awarded only if all lower levels are met.
 */
export function computeCompetency(pillar: Pillar, all: Evidence[], rules: Rules = RULES) {
  const ev = all.filter((e) => e.pillar === pillar && counts(e, rules));

  const kc = passed(ev, "knowledge_check");
  const labsOrArtifacts = [...passed(ev, "lab"), ...passed(ev, "artifact")];
  const artifacts = passed(ev, "artifact").filter((e) => !!e.artifactRef);
  const defences = passed(ev, "defence");

  // Lessons where an artifact (with a reference) AND a passed defence both exist.
  const lessonsDone = new Set(
    artifacts.map((a) => a.lessonId).filter((id) => defences.some((d) => d.lessonId === id)),
  );
  const strong = defences.filter((d) => d.score >= rules.strongDefenceScore);
  const outcomes = passed(ev, "outcome").filter((e) => !!e.artifactRef);
  const humanStrong = strong.some((d) => d.assessedBy === "human");

  const criteria: Criterion[] = [
    { level: 1, label: "Pass a knowledge check", met: kc.length >= 1 },
    {
      level: 2,
      label: "Pass a practical lab or submit a reviewed artifact",
      met: labsOrArtifacts.length >= 1,
    },
    {
      level: 3,
      label: "Reviewed artifact with a reference AND a passed defence on the same lesson",
      met: lessonsDone.size >= 1,
    },
    {
      level: 4,
      label: "Artifact plus defence on two different lessons, and one completed milestone",
      met: lessonsDone.size >= 2 && passed(ev, "milestone").length >= 1,
    },
    {
      level: 5,
      label: rules.l5RequiresHuman
        ? "Measured business outcome with a reference, and two defences scoring 85%+ (one human-assessed)"
        : "Measured business outcome with a reference, and two defences scoring 85%+",
      met:
        outcomes.length >= 1 &&
        strong.length >= 2 &&
        (!rules.l5RequiresHuman || humanStrong),
    },
  ];

  let level = 0;
  for (const c of criteria) {
    if (c.met) level = c.level;
    else break;
  }
  const next = level < 5 ? criteria[level] : null;
  return { pillar, level, criteria, next };
}
