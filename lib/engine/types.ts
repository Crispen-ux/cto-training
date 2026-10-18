export const PILLARS = ["People", "Product", "Tech", "Delivery", "Economics"] as const;
export type Pillar = (typeof PILLARS)[number];

export type EvidenceType =
  | "knowledge_check"
  | "lab"
  | "artifact"
  | "defence"
  | "milestone"
  | "outcome";

/** Who assessed the evidence. "self" never counts toward XP or mastery. */
export type Assessor = "auto" | "self" | "ai" | "human";

export interface Evidence {
  id: string;
  lessonId: string;
  pillar: Pillar;
  type: EvidenceType;
  /** 0..1 */
  score: number;
  passed: boolean;
  assessedBy: Assessor;
  /** Flagged by an assessor as uncertain: does not count until cleared. */
  needsHumanReview: boolean;
  artifactRef?: string;
  submissionId?: string;
  notes?: string;
  createdAt: string; // ISO
}

export interface Prerequisite {
  lessonId: string;
  type: EvidenceType;
}

export interface UnlockRule {
  prerequisites: Prerequisite[];
  minLevel?: { pillar: Pillar; level: number };
}
