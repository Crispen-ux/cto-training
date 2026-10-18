import fs from "node:fs";
import path from "node:path";
import { deriveFromEvidence, type DerivedCompetency } from "./capability-evidence";
import { provenanceFor, provenanceStatus, type ProvenanceStatus, type SourceKind } from "./capability-provenance";
import type { Evidence } from "./engine";

export type CapabilityTrack = "Solutions Architect" | "AI Solutions Architect" | "CTO / Technology Strategist";

export interface Competency {
  id: string;
  title: string;
  tracks: string[];
  foundation: boolean;
  definition: string;
  objectives: string[];
  evidenceRequirements: string[];
  rubric: string[];
  prerequisites: string[];
  importance: number;
}

export interface CompetencyFile { competencies: Competency[]; }
export interface TargetFile { targets: Record<CapabilityTrack, Record<string, number>>; }

export interface CapabilityDimensions {
  knowledge: number; // 0..5, 0 = unassessed
  execution: number;
  judgement: number;
  communication: number;
}

export interface CapabilityAssessment {
  id: string;
  competencyId: string;
  track: CapabilityTrack;
  dimensions: CapabilityDimensions;
  evidenceRef?: string;
  evidenceType?: string;
  notes?: string;
  assessedBy: "self" | "reviewer" | "ai";
  assessedAt: string;
  status: "unassessed" | "baseline" | "in_progress" | "knowledge_demonstrated" | "evidence_submitted" | "defence_passed" | "mastered" | "reassessment_required";
}

export interface CapabilityState { assessments: CapabilityAssessment[]; }

const DATA = path.join(process.cwd(), "data");

export function loadCompetencies(): Competency[] {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA, "capability-competencies.json"), "utf8")) as CompetencyFile;
  return raw.competencies;
}

export function loadTargets(): Record<CapabilityTrack, Record<string, number>> {
  const raw = JSON.parse(fs.readFileSync(path.join(DATA, "capability-targets.json"), "utf8")) as TargetFile;
  return raw.targets;
}

export function getCompetency(id: string): Competency | undefined {
  return loadCompetencies().find((c) => c.id === id);
}

/** Overall proficiency is the weakest dimension; a strong knowledge score cannot hide weak execution. */
export function overallProficiency(d: CapabilityDimensions): number {
  const vals = [d.knowledge, d.execution, d.judgement, d.communication];
  if (vals.some((v) => v <= 0)) return 0;
  return Math.min(...vals);
}

export function isUnassessed(d: CapabilityDimensions): boolean {
  return [d.knowledge, d.execution, d.judgement, d.communication].some((v) => v <= 0);
}

export function evidenceConfidence(a: CapabilityAssessment): "high" | "medium" | "low" {
  if (!a.evidenceRef) return "low";
  if (a.assessedBy === "reviewer" || a.assessedBy === "ai") return "high";
  return "medium";
}

export function isStale(a: CapabilityAssessment, now = new Date()): boolean {
  const ageDays = (now.getTime() - new Date(a.assessedAt).getTime()) / (1000 * 60 * 60 * 24);
  return ageDays > 180;
}

export interface CapabilityGap {
  competencyId: string;
  title: string;
  track: CapabilityTrack;
  foundation: boolean;
  target: number;
  demonstrated: number;
  gap: number;
  evidenceConfidence: "high" | "medium" | "low" | "none";
  assessedAt?: string;
  stale: boolean;
  unassessed: boolean;
  /** Where the rating came from: reviewed evidence, self-report, or nothing. */
  source: "evidence" | "self-report" | "none";
  /** Human-reviewed evidence ids behind the rating, for audit. */
  evidenceIds: string[];
  /** The weakest evidenced dimension, so a gap shows what is actually missing. */
  weakestDimension: "knowledge" | "execution" | "judgement" | "communication" | null;
  /** Whether declared provenance exists for this competency. */
  provenance: ProvenanceStatus;
  /** Source kinds backing this competency, empty when none are declared. */
  sourceKinds: SourceKind[];
  /** True when the levels used are the competency-specific rubric, not the generic scale. */
  specificRubric: boolean;
  importance: number;
  blockedBy: string[];
  estimatedEffort: string;
  recommendedActivity: string;
  requiredEvidence: string[];
  reassessmentCondition: string;
}

export function latestAssessment(assessments: CapabilityAssessment[], competencyId: string, track: CapabilityTrack): CapabilityAssessment | undefined {
  return assessments
    .filter((a) => a.competencyId === competencyId && a.track === track)
    .sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())[0];
}

function evidenceAgeDays(evidence: Evidence[], ids: string[]): number {
  const dates = evidence.filter((e) => ids.includes(e.id)).map((e) => new Date(e.createdAt).getTime());
  if (dates.length === 0) return 0;
  return (Date.now() - Math.max(...dates)) / (1000 * 60 * 60 * 24);
}

function evidenceDate(evidence: Evidence[], ids: string[]): string | undefined {
  const dates = evidence.filter((e) => ids.includes(e.id)).map((e) => e.createdAt).sort();
  return dates.at(-1);
}

export function computeGaps(
  assessments: CapabilityAssessment[],
  track: CapabilityTrack,
  evidence: Evidence[] = [],
): CapabilityGap[] {
  const targets = loadTargets()[track];
  const code = track === "Solutions Architect" ? "SA" : track === "AI Solutions Architect" ? "AISA" : "CTO";
  const all = loadCompetencies();
  const byId = new Map(all.map((c) => [c.id, c]));
  /** Demonstrated proficiency that comes from real, reviewed evidence. */
  const derived = deriveFromEvidence(evidence);

  const gaps: CapabilityGap[] = [];
  for (const [cid, target] of Object.entries(targets)) {
    const c = byId.get(cid);
    if (!c) continue;

    const self = latestAssessment(assessments, cid, track);
    const selfUsable = !!self && !isUnassessed(self.dimensions) && !!self.evidenceRef;
    const fromEvidence: DerivedCompetency | undefined = derived.get(cid);

    // Evidence always wins, including when the evidence rate is zero. Falling
    // back to self-report in that case would let a claim hide a real weakness.
    const useEvidence = !!fromEvidence;
    const unassessed = !useEvidence && !selfUsable;
    const demonstrated = useEvidence
      ? fromEvidence.demonstrated
      : selfUsable
        ? overallProficiency(self.dimensions)
        : 0;

    const weakest = useEvidence
      ? (Object.entries(fromEvidence.dimensions).sort((a, b) => a[1] - b[1])[0][0] as CapabilityGap["weakestDimension"])
      : selfUsable
        ? (Object.entries(self.dimensions).sort((a, b) => a[1] - b[1])[0][0] as CapabilityGap["weakestDimension"])
        : null;

    const blockedBy = c.prerequisites.filter((p) => {
      const pd = derived.get(p);
      if (pd && pd.demonstrated > 0) return false;
      const pa = latestAssessment(assessments, p, track);
      return !pa || isUnassessed(pa.dimensions) || overallProficiency(pa.dimensions) < 2;
    });

    const gap = Math.max(0, target - demonstrated);
    const conf: CapabilityGap["evidenceConfidence"] = useEvidence
      ? fromEvidence.humanReviewed ? "high" : "medium"
      : self
        ? evidenceConfidence(self)
        : "none";
    const stale = useEvidence
      ? evidenceAgeDays(evidence, fromEvidence.sourceEvidenceIds) > 180
      : self
        ? isStale(self)
        : false;

    gaps.push({
      competencyId: cid,
      title: c.title,
      track,
      foundation: c.foundation,
      target,
      demonstrated,
      gap,
      evidenceConfidence: conf,
      assessedAt: useEvidence ? evidenceDate(evidence, fromEvidence.sourceEvidenceIds) : self?.assessedAt,
      stale,
      unassessed,
      source: useEvidence ? "evidence" : selfUsable ? "self-report" : "none",
      evidenceIds: useEvidence ? fromEvidence.sourceEvidenceIds : self?.evidenceRef ? [self.evidenceRef] : [],
      weakestDimension: weakest,
      provenance: provenanceStatus(c),
      sourceKinds: provenanceFor(cid)?.sources.map((s) => s.kind) ?? [],
      specificRubric: !!provenanceFor(cid)?.rubric,
      importance: c.importance,
      blockedBy,
      estimatedEffort: gap <= 0 ? "none" : gap === 1 ? "1-2 weeks" : gap === 2 ? "3-4 weeks" : "5+ weeks",
      recommendedActivity: unassessed
        ? "Complete a diagnostic assessment for this competency."
        : gap <= 0
          ? "Maintain evidence and reassess periodically."
          : demonstrated < 2
            ? "Study fundamentals and complete guided exercises."
            : demonstrated < 3
              ? "Complete a practical exercise and submit evidence."
              : "Defend a decision and address trade-offs.",
      requiredEvidence: c.evidenceRequirements,
      reassessmentCondition: "Reassess after new evidence, material technology change, or 180 days.",
    });
  }
  return gaps;
}

export interface PrioritisedAction {
  competencyId: string;
  title: string;
  track: CapabilityTrack;
  score: number;
  reasons: string[];
  gap: CapabilityGap;
}

export function prioritiseGaps(gaps: CapabilityGap[], availableMinutesPerWeek = 300): PrioritisedAction[] {
  const actions = gaps
    .filter((g) => g.gap > 0 || g.unassessed)
    .map((g) => {
      const reasons: string[] = [];
      let score = g.gap * 10 + g.importance * 3;
      if (g.source === "evidence") {
        reasons.push(`Demonstrated level ${g.demonstrated} from ${g.evidenceIds.length} reviewed piece(s) of evidence against a target of ${g.target}.`);
      } else if (g.source === "self-report") {
        reasons.push("Based on your own self-rating with a reference, not yet on reviewed evidence.");
      } else {
        reasons.push("No evidence yet, so this is unassessed rather than assumed weak.");
        score += 8;
      }
      if (g.weakestDimension) {
        reasons.push(`Weakest dimension: ${g.weakestDimension}.`);
      }
      if (g.importance >= 5) { score += 4; reasons.push("High importance for this track."); }
      if (g.stale) { score += 5; reasons.push("Evidence is older than 180 days and needs refreshing."); }
      if (g.evidenceConfidence === "low") { score += 4; reasons.push("Evidence confidence is low."); }
      if (g.evidenceConfidence === "medium") { score += 2; reasons.push("Evidence exists but has not been human-reviewed."); }
      if (g.blockedBy.length > 0) {
        score -= 6;
        reasons.push(`Blocked by ${g.blockedBy.length} prerequisite competency gap(s).`);
      }
      if (g.foundation) { score += 2; reasons.push("Shared foundation that other work depends on."); }
      if (g.gap >= 3) reasons.push("Large distance from the target level.");
      return { competencyId: g.competencyId, title: g.title, track: g.track, score, reasons, gap: g };
    })
    .sort((a, b) => b.score - a.score);
  return actions.slice(0, 8);
}

export function capabilityDashboard(
  assessments: CapabilityAssessment[],
  track: CapabilityTrack,
  evidence: Evidence[] = [],
) {
  const gaps = computeGaps(assessments, track, evidence);
  const unassessed = gaps.filter((g) => g.unassessed).length;
  const critical = gaps.filter((g) => g.gap >= 2 && g.importance >= 5).length;
  const stale = gaps.filter((g) => g.stale).length;
  const mastered = gaps.filter((g) => g.gap <= 0 && !g.unassessed).length;
  const fromEvidence = gaps.filter((g) => g.source === "evidence").length;
  const fromSelf = gaps.filter((g) => g.source === "self-report").length;
  const coverage = gaps.length ? Math.round(((gaps.length - unassessed) / gaps.length) * 100) : 0;
  return {
    track,
    total: gaps.length,
    unassessed,
    critical,
    stale,
    mastered,
    coverage,
    fromEvidence,
    fromSelf,
    gaps,
    priorities: prioritiseGaps(gaps),
  };
}
