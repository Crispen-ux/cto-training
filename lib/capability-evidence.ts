import fs from "node:fs";
import path from "node:path";
import type { Evidence, EvidenceType } from "./engine";

/**
 * Derives demonstrated competency from reviewed evidence.
 *
 * This is the piece that was missing: the competency model and the evidence
 * engine were two disconnected systems. Real, reviewed evidence is the only
 * thing that may raise demonstrated proficiency here. Self-report is never
 * consulted, an AI-only review is never treated as human verification, and
 * nothing is inferred for a competency with no evidence.
 */

export const RUBRIC_VERSION = "evidence-rubric-v1";

const DATA = path.join(process.cwd(), "data");

export interface LessonMapFile {
  lessonToCompetencies: Record<string, string[]>;
  studioSources?: Record<string, string>;
}

export function loadLessonMap(): LessonMapFile {
  return JSON.parse(fs.readFileSync(path.join(DATA, "lesson-competency-map.json"), "utf8")) as LessonMapFile;
}

export function competenciesForLesson(lessonId: string): string[] {
  return loadLessonMap().lessonToCompetencies[lessonId] ?? [];
}

export function lessonsForCompetency(competencyId: string): string[] {
  const m = loadLessonMap().lessonToCompetencies;
  return Object.entries(m)
    .filter(([, ids]) => ids.includes(competencyId))
    .map(([lesson]) => lesson);
}

/** Evidence kinds that show a competency can actually be applied. */
export const EXECUTION_TYPES: EvidenceType[] = ["lab", "artifact", "milestone", "outcome"];
export const JUDGEMENT_TYPES: EvidenceType[] = ["artifact", "defence", "milestone", "outcome"];
export const COMMUNICATION_TYPES: EvidenceType[] = ["defence"];

export interface DerivedCompetency {
  competencyId: string;
  /** Highest level any single piece of real evidence supports. */
  demonstrated: number;
  /** Four dimensions, each derived only from real evidence. 0 means no evidence. */
  dimensions: { knowledge: number; execution: number; judgement: number; communication: number };
  /** Level required before a human-reviewed defence is needed for the next level. */
  evidenceCount: number;
  lessons: string[];
  /** Evidence ids that produced this rating, for audit. */
  sourceEvidenceIds: string[];
  rubricVersion: string;
  /** False when any contributing evidence was AI-only and no human has reviewed. */
  humanReviewed: boolean;
}

const LEVEL_FOR = (score: number): number => {
  if (score >= 0.9) return 5;
  if (score >= 0.75) return 4;
  if (score >= 0.6) return 3;
  if (score >= 0.4) return 2;
  if (score > 0) return 1;
  return 0;
};

function counted(e: Evidence): boolean {
  return e.passed && !e.needsHumanReview && e.assessedBy !== "self";
}

/**
 * A defence is the only evidence that speaks to communication and judgement,
 * and only a human-assessed defence can support the top levels, because the
 * Academy never lets an AI score certify professional judgement.
 */
function levelFor(e: Evidence, kind: "knowledge" | "execution" | "judgement" | "communication"): number {
  const base = LEVEL_FOR(e.score);
  if (kind === "knowledge") return base;
  if (base < 3) return base;
  if (kind === "communication") return e.assessedBy === "human" ? Math.min(base, 4) : Math.min(base, 3);
  if (e.assessedBy === "ai" && kind === "judgement") return Math.min(base, 3);
  return base;
}

export function deriveFromEvidence(evidence: Evidence[]): Map<string, DerivedCompetency> {
  const map = loadLessonMap().lessonToCompetencies;
  const out = new Map<string, DerivedCompetency>();

  for (const e of evidence) {
    if (!counted(e)) continue;
    const targets = map[e.lessonId];
    if (!targets) continue;

    for (const competencyId of targets) {
      const prior = out.get(competencyId);
      const rec: DerivedCompetency = prior ?? {
        competencyId,
        demonstrated: 0,
        dimensions: { knowledge: 0, execution: 0, judgement: 0, communication: 0 },
        evidenceCount: 0,
        lessons: [],
        sourceEvidenceIds: [],
        rubricVersion: RUBRIC_VERSION,
        humanReviewed: false,
      };

      if (!rec.lessons.includes(e.lessonId)) rec.lessons.push(e.lessonId);
      rec.sourceEvidenceIds.push(e.id);
      rec.evidenceCount += 1;
      if (e.assessedBy === "human") rec.humanReviewed = true;

      if (e.type === "knowledge_check") {
        rec.dimensions.knowledge = Math.max(rec.dimensions.knowledge, levelFor(e, "knowledge"));
      }
      if (EXECUTION_TYPES.includes(e.type)) {
        rec.dimensions.execution = Math.max(rec.dimensions.execution, levelFor(e, "execution"));
      }
      if (JUDGEMENT_TYPES.includes(e.type)) {
        rec.dimensions.judgement = Math.max(rec.dimensions.judgement, levelFor(e, "judgement"));
      }
      if (COMMUNICATION_TYPES.includes(e.type)) {
        rec.dimensions.communication = Math.max(rec.dimensions.communication, levelFor(e, "communication"));
      }

      // Overall is the weakest evidenced dimension: strong knowledge must not
      // paper over an inability to execute or defend.
      rec.demonstrated = Math.min(
        rec.dimensions.knowledge,
        rec.dimensions.execution,
        rec.dimensions.judgement,
        rec.dimensions.communication,
      );
      out.set(competencyId, rec);
    }
  }
  return out;
}

/** Competencies with a mapped lesson but no qualifying evidence yet. */
export function unevidencedCompetencies(existing: Iterable<string>): string[] {
  const mapped = new Set(Object.values(loadLessonMap().lessonToCompetencies).flat());
  const have = new Set(existing);
  return [...mapped].filter((c) => !have.has(c)).sort();
}
