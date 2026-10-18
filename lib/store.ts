import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { RULES, type Evidence, type EvidenceType, type Pillar } from "./engine";
import type { CapabilityAssessment } from "./capability";
import type { DecisionAttempt } from "./decision-loop";
import type { ArticulationLevel } from "./articulation";

export interface ArticulationAttempt {
  id: string;
  level: ArticulationLevel;
  text: string;
  wordCount: number;
  findings: { kind: string; finding: string; challenge: string; excerpt: string }[];
  /** Set when a reviewer has scored it. Never self-assigned. */
  review?: { score: number; notes: string; assessedBy: "human" | "ai"; at: string };
  createdAt: string;
}

/**
 * A submission may point at work produced outside the lesson folder, such as an
 * Architecture Studio project. Those references are recognisable and are
 * allowed, so real architecture work can be reviewed into evidence without
 * inventing a new submission type.
 */
export const STUDIO_REF_PREFIX = "studio:";

export function isStudioRef(ref: string | undefined): boolean {
  return !!ref && ref.startsWith(STUDIO_REF_PREFIX);
}

export interface Submission {
  id: string;
  lessonId: string;
  pillar: Pillar;
  kind: "lab" | "artifact" | "defence" | "milestone" | "outcome";
  content: string;
  artifactRef?: string;
  dataLabel?: "REAL" | "SIMULATED";
  createdAt: string;
  status: "pending" | "reviewed";
  /** Set when the AI assessor scored this but sent it to a human. It is NOT evidence and does not count. */
  aiPreliminary?: { assessmentId: string; score: number; summary: string; flags: string[] };
}

export interface DefenceSession {
  id: string;
  lessonId: string;
  pillar: Pillar;
  status: "open" | "scored" | "abandoned";
  turns: { role: "learner" | "assessor"; text: string; at: string }[];
  createdAt: string;
  submissionId?: string;
  assessmentId?: string;
}

/** Audit record of one AI assessment: what was asked, what came back, what the system did with it. */
export interface AiAssessmentRecord {
  id: string;
  sessionId: string;
  submissionId: string;
  lessonId: string;
  provider: string;
  model: string;
  promptVersion: string;
  createdAt: string;
  score: number;
  confidence: number;
  flags: string[];
  issues: string[];
  samplesUsed: number;
  criteria: { criterion: string; weight: number; level: number; quotes: string[]; reasons: string[] }[];
  summary: string;
  outcome: "evidence_created" | "sent_to_human";
  evidenceId?: string;
  rawResponses: string[];
}

export interface DiagnosticAttempt {
  id: string;
  takenAt: string;
  seed: number;
  /** Self-ratings 1-5 by pillar, if given. Self-report: never evidence. */
  selfRatings: Partial<Record<Pillar, number>>;
  answers: Record<string, number>;
  results: { pillar: Pillar; correct: number; total: number; missedLessonIds: string[] }[];
}

export interface Settings {
  /** minutes per block: framework study, fundamentals, project, assessment */
  schedule: { framework: number; fundamentals: number; project: number; assessment: number };
}

export interface MentorSession {
  id: string;
  personaId: string;
  mode: string;
  objective: string;
  track: string;
  messages: { role: "user" | "assistant"; text: string; at: string }[];
  actionItems: string[];
  createdAt: string;
  updatedAt: string;
}
export interface Project {
  id: string;
  title: string;
  objective: string;
  status: "active" | "paused" | "done";
  owner: string;
  createdAt: string;
}

export interface Task {
  id: string;
  projectId?: string;
  title: string;
  status: "todo" | "doing" | "done";
  priority: "low" | "medium" | "high";
  dueDate?: string;
  createdAt: string;
}

export interface Decision {
  id: string;
  projectId?: string;
  title: string;
  status: "proposed" | "accepted" | "rejected";
  context: string;
  decision: string;
  consequences: string;
  createdAt: string;
}
export interface Client {
  id: string;
  name: string;
  sector: string;
  createdAt: string;
}

export interface Workstream {
  id: string;
  projectId: string;
  name: string;
  phase: string;
  status: "not_started" | "in_progress" | "done";
  createdAt: string;
}

export interface Artifact {
  id: string;
  projectId: string;
  workstreamId?: string;
  type: string;
  title: string;
  status: "draft" | "review" | "approved" | "superseded";
  version: number;
  content: string;
  createdAt: string;
  updatedAt: string;
}
export interface State {
  evidence: Evidence[];
  submissions: Submission[];
  settings: Settings;
  defenceSessions: DefenceSession[];
  aiAssessments: AiAssessmentRecord[];
  aiUsage: Record<string, number>;
  diagnostics: DiagnosticAttempt[];
  capabilityAssessments: CapabilityAssessment[];
  mentorSessions: MentorSession[];
  projects: Project[];
  tasks: Task[];
  decisions: Decision[];
  clients: Client[];
  workstreams: Workstream[];
  artifacts: Artifact[];
  decisionAttempts: DecisionAttempt[];
  articulationAttempts: ArticulationAttempt[];
}

export const DEFAULT_SETTINGS: Settings = {
  schedule: { framework: 15, fundamentals: 25, project: 60, assessment: 20 },
};

function dataFile() {
  const dir = process.env.ACADEMY_DATA_DIR ?? path.join(process.cwd(), ".data");
  return { dir, file: path.join(dir, "state.json") };
}

export function readState(): State {
  const { file } = dataFile();
  if (!fs.existsSync(/*turbopackIgnore: true*/ file))
    return { evidence: [], submissions: [], settings: DEFAULT_SETTINGS, defenceSessions: [], aiAssessments: [], aiUsage: {}, diagnostics: [], capabilityAssessments: [], mentorSessions: [], projects: [], tasks: [], decisions: [], clients: [], workstreams: [], artifacts: [], decisionAttempts: [], articulationAttempts: [] };
  const parsed = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Partial<State>;
  return {
    evidence: parsed.evidence ?? [],
    submissions: parsed.submissions ?? [],
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
    defenceSessions: parsed.defenceSessions ?? [],
    aiAssessments: parsed.aiAssessments ?? [],
    aiUsage: parsed.aiUsage ?? {},
    diagnostics: parsed.diagnostics ?? [],
    capabilityAssessments: parsed.capabilityAssessments ?? [],
    mentorSessions: parsed.mentorSessions ?? [],
    projects: parsed.projects ?? [],
    tasks: parsed.tasks ?? [],
    decisions: parsed.decisions ?? [],
    clients: parsed.clients ?? [],
    workstreams: parsed.workstreams ?? [],
    artifacts: parsed.artifacts ?? [],
    decisionAttempts: parsed.decisionAttempts ?? [],
    articulationAttempts: parsed.articulationAttempts ?? [],
  };
}

function writeState(state: State) {
  const { dir, file } = dataFile();
  fs.mkdirSync(dir, { recursive: true });
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
  fs.renameSync(tmp, file); // atomic replace
}

export function newId() {
  return crypto.randomUUID();
}

export function addEvidence(e: Omit<Evidence, "id" | "createdAt"> & { createdAt?: string }): Evidence {
  const state = readState();
  const full: Evidence = { ...e, id: newId(), createdAt: e.createdAt ?? new Date().toISOString() };
  state.evidence.push(full);
  writeState(state);
  return full;
}

export function addSubmission(s: Omit<Submission, "id" | "createdAt" | "status">): Submission {
  const state = readState();
  const full: Submission = { ...s, id: newId(), createdAt: new Date().toISOString(), status: "pending" };
  state.submissions.push(full);
  writeState(state);
  return full;
}

export interface ReviewInput {
  submissionId: string;
  score: number; // 0..1
  needsHumanReview: boolean;
  notes: string;
  assessedBy: "human" | "ai";
}

/**
 * Turns a pending submission into evidence. Only a reviewer other than "self" can do this,
 * so the learner's own claim never counts toward mastery.
 */
export function reviewSubmission(r: ReviewInput): Evidence {
  const state = readState();
  const sub = state.submissions.find((s) => s.id === r.submissionId);
  if (!sub) throw new Error("Submission not found");
  if (sub.status === "reviewed") throw new Error("Submission already reviewed");
  if (!(r.score >= 0 && r.score <= 1)) throw new Error("Score must be between 0 and 1");
  if (!r.notes.trim()) throw new Error("Review notes are required");

  const evidence: Evidence = {
    id: newId(),
    lessonId: sub.lessonId,
    pillar: sub.pillar,
    type: sub.kind as EvidenceType,
    score: r.score,
    passed: r.score >= RULES.passMark,
    assessedBy: r.assessedBy,
    needsHumanReview: r.needsHumanReview,
    artifactRef: sub.artifactRef,
    submissionId: sub.id,
    notes: r.notes,
    createdAt: new Date().toISOString(),
  };
  sub.status = "reviewed";
  state.evidence.push(evidence);
  writeState(state);
  return evidence;
}

export function saveSettings(settings: Settings) {
  const state = readState();
  state.settings = settings;
  writeState(state);
}

// ---- AI support: sessions, audit log, usage cap -------------------------------------------------

export function today(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

/** Count one provider call against the daily cap. Throws when the cap is reached. */
export function bumpAiUsage(cap: number, d = new Date()): number {
  const state = readState();
  const key = today(d);
  const used = state.aiUsage[key] ?? 0;
  if (used >= cap) throw new Error("CAP");
  state.aiUsage = { [key]: used + 1 }; // keep only today's counter
  writeState(state);
  return used + 1;
}

export function aiUsageToday(d = new Date()): number {
  return readState().aiUsage[today(d)] ?? 0;
}

export function saveSession(session: DefenceSession) {
  const state = readState();
  const i = state.defenceSessions.findIndex((x) => x.id === session.id);
  if (i >= 0) state.defenceSessions[i] = session;
  else state.defenceSessions.push(session);
  writeState(state);
}

export function getSession(id: string): DefenceSession | undefined {
  return readState().defenceSessions.find((s) => s.id === id);
}

export function saveAiAssessment(rec: AiAssessmentRecord) {
  const state = readState();
  state.aiAssessments.push(rec);
  writeState(state);
}

export function setAiPreliminary(submissionId: string, prelim: NonNullable<Submission["aiPreliminary"]>) {
  const state = readState();
  const sub = state.submissions.find((s) => s.id === submissionId);
  if (!sub) throw new Error("Submission not found");
  sub.aiPreliminary = prelim;
  writeState(state);
}

export function addArticulationAttempt(a: Omit<ArticulationAttempt, "id"> & { id?: string }): ArticulationAttempt {
  const state = readState();
  const full: ArticulationAttempt = { ...a, id: a.id || newId() };
  state.articulationAttempts.push(full);
  writeState(state);
  return full;
}

export function addDecisionAttempt(a: Omit<DecisionAttempt, "id"> & { id?: string }): DecisionAttempt {
  const state = readState();
  const full: DecisionAttempt = { ...a, id: a.id || newId() };
  state.decisionAttempts.push(full);
  writeState(state);
  return full;
}

export function saveMentorSession(session: MentorSession) {
  const state = readState();
  const i = state.mentorSessions.findIndex((x) => x.id === session.id);
  if (i >= 0) state.mentorSessions[i] = session;
  else state.mentorSessions.push(session);
  writeState(state);
}

export function getMentorSessions(): MentorSession[] {
  return readState().mentorSessions;
}

export function addClient(c: Omit<Client, "id" | "createdAt">): Client {
  const state = readState();
  const full: Client = { ...c, id: newId(), createdAt: new Date().toISOString() };
  state.clients.push(full);
  writeState(state);
  return full;
}

export function addWorkstream(w: Omit<Workstream, "id" | "createdAt">): Workstream {
  const state = readState();
  const full: Workstream = { ...w, id: newId(), createdAt: new Date().toISOString() };
  state.workstreams.push(full);
  writeState(state);
  return full;
}

export function addArtifact(a: Omit<Artifact, "id" | "createdAt" | "updatedAt" | "version">): Artifact {
  const state = readState();
  const full: Artifact = { ...a, id: newId(), version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  state.artifacts.push(full);
  writeState(state);
  return full;
}

export function addDiagnostic(a: Omit<DiagnosticAttempt, "id" | "takenAt">): DiagnosticAttempt {
  const state = readState();
  const full: DiagnosticAttempt = { ...a, id: newId(), takenAt: new Date().toISOString() };
  state.diagnostics.push(full);
  writeState(state);
  return full;
}

export function addProject(p: Omit<Project, "id" | "createdAt">): Project {
  const state = readState();
  const full: Project = { ...p, id: newId(), createdAt: new Date().toISOString() };
  state.projects.push(full);
  writeState(state);
  return full;
}

export function addTask(t: Omit<Task, "id" | "createdAt">): Task {
  const state = readState();
  const full: Task = { ...t, id: newId(), createdAt: new Date().toISOString() };
  state.tasks.push(full);
  writeState(state);
  return full;
}

export function addDecision(d: Omit<Decision, "id" | "createdAt">): Decision {
  const state = readState();
  const full: Decision = { ...d, id: newId(), createdAt: new Date().toISOString() };
  state.decisions.push(full);
  writeState(state);
  return full;
}

export function updateTaskStatus(id: string, status: Task["status"]) {
  const state = readState();
  const t = state.tasks.find((x) => x.id === id);
  if (!t) throw new Error("Task not found");
  t.status = status;
  writeState(state);
}

export function addCapabilityAssessment(a: Omit<CapabilityAssessment, "id" | "assessedAt"> & { assessedAt?: string }): CapabilityAssessment {
  const state = readState();
  const full: CapabilityAssessment = { ...a, id: newId(), assessedAt: a.assessedAt ?? new Date().toISOString() };
  state.capabilityAssessments.push(full);
  writeState(state);
  return full;
}
