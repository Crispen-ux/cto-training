import { getLesson, type Lesson } from "@/lib/content";
import { RULES, checkUnlock, counts } from "@/lib/engine";
import {
  addSubmission,
  bumpAiUsage,
  getSession,
  newId,
  readState,
  reviewSubmission,
  saveAiAssessment,
  saveSession,
  setAiPreliminary,
  today,
  type DefenceSession,
} from "@/lib/store";
import { assessDefence, followUp, type Assessment, type Turn } from "./assessor";
import { AI_RULES } from "./config";
import { sanitiseUserText } from "./context";
import { AiError, getProvider, type AiProvider, type ChatMessage } from "./provider";
import { buildFeedback, tutorReply, type TutorMode } from "./tutor";

/** Wrap a provider so every call counts against the daily cap. */
export function metered(provider: AiProvider, cap: number = AI_RULES.dailyCallCap): AiProvider {
  return {
    id: provider.id,
    model: provider.model,
    countsAsEvidence: provider.countsAsEvidence,
    async complete(req) {
      try {
        bumpAiUsage(cap);
      } catch (e) {
        if ((e as Error).message === "CAP") {
          throw new AiError("budget_exhausted", `The daily limit of ${cap} AI calls has been reached. It resets at midnight UTC.`);
        }
        throw e;
      }
      return provider.complete(req);
    },
  };
}

function need(provider: AiProvider | null | undefined): AiProvider {
  if (!provider) {
    throw new AiError("not_configured", "No AI provider is configured. Set ANTHROPIC_API_KEY on the server and restart.");
  }
  return metered(provider);
}

function unlockedLesson(lessonId: string): Lesson {
  const lesson = getLesson(lessonId);
  if (!lesson) throw new AiError("bad_response", "Unknown lesson.");
  const unlock = checkUnlock(lesson.unlock, readState().evidence);
  if (!unlock.unlocked) throw new AiError("bad_response", "This lesson is locked.");
  return lesson;
}

function defenceGate(lessonId: string, requireNewSession: boolean): Lesson {
  const lesson = unlockedLesson(lessonId);
  const state = readState();
  const checkPassed = state.evidence.some((e) => e.lessonId === lessonId && e.type === "knowledge_check" && e.passed && counts(e));
  if (!checkPassed) throw new AiError("bad_response", "Pass the knowledge check first.");
  if (!state.submissions.some((s) => s.lessonId === lessonId && s.kind === "artifact")) {
    throw new AiError("bad_response", "Submit your build deliverable before the defence.");
  }
  if (requireNewSession) {
    const day = today();
    const n = state.defenceSessions.filter((s) => s.lessonId === lessonId && s.createdAt.slice(0, 10) === day).length;
    if (n >= AI_RULES.maxDefenceSessionsPerLessonPerDay) {
      throw new AiError("bad_response", `At most ${AI_RULES.maxDefenceSessionsPerLessonPerDay} AI defence sessions per lesson per day. Review your answers and come back tomorrow.`);
    }
  }
  return lesson;
}

export interface SessionView {
  id: string;
  turns: { role: "learner" | "assessor"; text: string }[];
  followUpsLeft: number;
  status: DefenceSession["status"];
}

function view(s: DefenceSession): SessionView {
  const asked = s.turns.filter((t) => t.role === "assessor").length;
  return {
    id: s.id,
    turns: s.turns.map(({ role, text }) => ({ role, text })),
    followUpsLeft: Math.max(0, AI_RULES.maxFollowUpRounds - asked),
    status: s.status,
  };
}

function clean(text: string): string {
  const t = (text ?? "").trim();
  if (t.length < 30) throw new AiError("bad_response", "Write at least 30 characters.");
  if (t.length > AI_RULES.maxMessageChars) throw new AiError("bad_response", `Keep each message under ${AI_RULES.maxMessageChars} characters.`);
  return t;
}

export async function startDefence(lessonId: string, answer: string, provider: AiProvider | null = getProvider()): Promise<SessionView> {
  const p = need(provider);
  const lesson = defenceGate(lessonId, true);
  const text = clean(answer);
  const turns: Turn[] = [{ role: "learner", text }];
  const q = await followUp(p, lesson, turns);
  const now = new Date().toISOString();
  const session: DefenceSession = {
    id: newId(),
    lessonId,
    pillar: lesson.pillar,
    status: "open",
    createdAt: now,
    turns: [
      { role: "learner", text, at: now },
      { role: "assessor", text: q, at: now },
    ],
  };
  saveSession(session);
  return view(session);
}

export async function replyDefence(sessionId: string, answer: string, provider: AiProvider | null = getProvider()): Promise<SessionView> {
  const p = need(provider);
  const session = getSession(sessionId);
  if (!session || session.status !== "open") throw new AiError("bad_response", "That defence session is not open.");
  const lesson = defenceGate(session.lessonId, false);
  const text = clean(answer);
  const turns: Turn[] = [...session.turns.map(({ role, text }) => ({ role, text })), { role: "learner", text }];
  const asked = session.turns.filter((t) => t.role === "assessor").length;
  const now = new Date().toISOString();
  const add: DefenceSession["turns"] = [{ role: "learner", text, at: now }];
  if (asked < AI_RULES.maxFollowUpRounds) {
    const q = await followUp(p, lesson, turns);
    add.push({ role: "assessor", text: q, at: now });
  }
  session.turns.push(...add);
  saveSession(session);
  return view(session);
}

export function abandonDefence(sessionId: string) {
  const s = getSession(sessionId);
  if (s && s.status === "open") saveSession({ ...s, status: "abandoned" });
}

export interface FinishResult {
  outcome: "evidence_created" | "sent_to_human";
  score: number;
  passed: boolean;
  passMark: number;
  summary: string;
  criteria: Assessment["criteria"];
  flags: string[];
  issues: string[];
  gaps: string[];
  strengths: string[];
}

function auditNotes(a: Assessment, provider: AiProvider): string {
  const lines = a.criteria.map((c) => `- ${c.criterion}: level ${c.level.toFixed(2)}/4${c.quotes.length ? ` | quote: "${c.quotes[0]}"` : ""}`);
  return [`AI assessment (${provider.id} ${provider.model}, ${AI_RULES.promptVersion}, ${a.samplesUsed} passes, confidence ${a.confidence.toFixed(2)}).`, a.summary, ...lines].join("\n");
}

export async function finishDefence(sessionId: string, provider: AiProvider | null = getProvider()): Promise<FinishResult> {
  const p = need(provider);
  const session = getSession(sessionId);
  if (!session || session.status !== "open") throw new AiError("bad_response", "That defence session is not open.");
  const lesson = defenceGate(session.lessonId, false);
  const turns: Turn[] = session.turns.map(({ role, text }) => ({ role, text }));

  const a = await assessDefence(p, lesson, turns);

  const content = turns.map((t) => `[${t.role}] ${t.text}`).join("\n\n");
  const sub = addSubmission({ lessonId: lesson.id, pillar: lesson.pillar, kind: "defence", content: sanitiseUserText(content) });
  const assessmentId = newId();
  const counts_ = a.flags.length === 0 && p.countsAsEvidence;

  let evidenceId: string | undefined;
  if (counts_) {
    evidenceId = reviewSubmission({
      submissionId: sub.id,
      score: a.score,
      needsHumanReview: false,
      notes: auditNotes(a, p),
      assessedBy: "ai",
    }).id;
  } else {
    setAiPreliminary(sub.id, { assessmentId, score: a.score, summary: a.summary, flags: a.flags });
  }
  const outcome = counts_ ? "evidence_created" : "sent_to_human";
  saveAiAssessment({
    id: assessmentId,
    sessionId: session.id,
    submissionId: sub.id,
    lessonId: lesson.id,
    provider: p.id,
    model: p.model,
    promptVersion: AI_RULES.promptVersion,
    createdAt: new Date().toISOString(),
    score: a.score,
    confidence: a.confidence,
    flags: a.flags,
    issues: a.issues,
    samplesUsed: a.samplesUsed,
    criteria: a.criteria,
    summary: a.summary,
    outcome,
    evidenceId,
    rawResponses: a.rawResponses,
  });
  saveSession({ ...session, status: "scored", submissionId: sub.id, assessmentId });

  return {
    outcome,
    score: a.score,
    passed: a.passed,
    passMark: RULES.passMark,
    summary: a.summary,
    criteria: a.criteria,
    flags: a.flags,
    issues: a.issues,
    gaps: a.gaps,
    strengths: a.strengths,
  };
}

export async function tutorAsk(
  lessonId: string,
  mode: TutorMode,
  history: ChatMessage[],
  message: string,
  provider: AiProvider | null = getProvider(),
): Promise<string> {
  const p = need(provider);
  const lesson = unlockedLesson(lessonId);
  return tutorReply(p, lesson, mode, history, message);
}

export async function buildFeedbackFor(lessonId: string, writeup: string, provider: AiProvider | null = getProvider()): Promise<string> {
  const p = need(provider);
  const lesson = unlockedLesson(lessonId);
  return buildFeedback(p, lesson, writeup);
}
