import fs from "node:fs";
import path from "node:path";

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

export function computeGaps(assessments: CapabilityAssessment[], track: CapabilityTrack): CapabilityGap[] {
  const targets = loadTargets()[track];
  const comps = loadCompetencies().filter((c) => c.tracks.includes(track.replace("Solutions Architect", "SA").replace("AI Solutions Architect", "AISA").replace("CTO / Technology Strategist", "CTO")));
  // map track names to codes
  const code = track === "Solutions Architect" ? "SA" : track === "AI Solutions Architect" ? "AISA" : "CTO";
  const relevant = loadCompetencies().filter((c) => c.tracks.includes(code));
  const all = loadCompetencies();
  const byId = new Map(all.map((c) => [c.id, c]));

  const gaps: CapabilityGap[] = [];
  for (const [cid, target] of Object.entries(targets)) {
    const c = byId.get(cid);
    if (!c) continue;
    const a = latestAssessment(assessments, cid, track);
    const unassessed = !a || isUnassessed(a.dimensions);
    const evidenced = !!a?.evidenceRef;
    const demonstrated = a && !unassessed && evidenced ? overallProficiency(a.dimensions) : 0;
    const blockedBy = c.prerequisites.filter((p) => {
      const pa = latestAssessment(assessments, p, track);
      return !pa || isUnassessed(pa.dimensions) || overallProficiency(pa.dimensions) < 2;
    });
    const gap = Math.max(0, target - demonstrated);
    const conf = a ? evidenceConfidence(a) : "none";
    const stale = a ? isStale(a) : false;
    gaps.push({
      competencyId: cid,
      title: c.title,
      track,
      foundation: c.foundation,
      target,
      demonstrated,
      gap,
      evidenceConfidence: conf,
      assessedAt: a?.assessedAt,
      stale,
      unassessed,
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
      if (g.unassessed) { score += 8; reasons.push("Competency is unassessed."); }
      if (g.stale) { score += 5; reasons.push("Evidence is stale."); }
      if (g.evidenceConfidence === "low") { score += 4; reasons.push("Evidence confidence is low."); }
      if (g.blockedBy.length > 0) { score -= 6; reasons.push("Blocked by prerequisite gaps."); }
      if (g.foundation) { score += 2; reasons.push("Shared foundation competency."); }
      if (g.importance >= 5) reasons.push("High importance to the target role.");
      if (g.gap >= 2) reasons.push("Large proficiency gap.");
      return { competencyId: g.competencyId, title: g.title, track: g.track, score, reasons, gap: g };
    })
    .sort((a, b) => b.score - a.score);
  // keep manageable: top 8
  return actions.slice(0, 8);
}

export function capabilityDashboard(assessments: CapabilityAssessment[], track: CapabilityTrack) {
  const gaps = computeGaps(assessments, track);
  const unassessed = gaps.filter((g) => g.unassessed).length;
  const critical = gaps.filter((g) => g.gap >= 2 && g.importance >= 5).length;
  const stale = gaps.filter((g) => g.stale).length;
  const mastered = gaps.filter((g) => g.gap <= 0 && !g.unassessed).length;
  const coverage = gaps.length ? Math.round(((gaps.length - unassessed) / gaps.length) * 100) : 0;
  return { track, total: gaps.length, unassessed, critical, stale, mastered, coverage, gaps, priorities: prioritiseGaps(gaps) };
}
