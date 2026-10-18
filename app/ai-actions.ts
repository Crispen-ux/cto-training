"use server";

import { revalidatePath } from "next/cache";
import { AiError, aiStatus, type AiStatus, type ChatMessage } from "@/lib/ai";
import {
  abandonDefence,
  buildFeedbackFor,
  finishDefence,
  replyDefence,
  startDefence,
  tutorAsk,
  type FinishResult,
  type SessionView,
} from "@/lib/ai/flow";
import type { TutorMode } from "@/lib/ai/tutor";

/**
 * Server actions return plain results instead of throwing: in production Next.js replaces thrown messages
 * with a generic one, and the learner needs to see why a call was refused.
 */
export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function run<T>(fn: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    if (e instanceof AiError) return { ok: false, error: e.message };
    console.error("AI action failed:", (e as Error).name); // never log message bodies or keys
    return { ok: false, error: "Something went wrong. Nothing was recorded." };
  }
}

export async function aiStatusAction(): Promise<AiStatus> {
  return aiStatus();
}

export async function askTutor(lessonId: string, mode: TutorMode, history: ChatMessage[], message: string) {
  return run(() => tutorAsk(String(lessonId), mode, Array.isArray(history) ? history : [], String(message ?? "")));
}

export async function getBuildFeedback(lessonId: string, writeup: string) {
  return run(() => buildFeedbackFor(String(lessonId), String(writeup ?? "")));
}

export async function startAiDefence(lessonId: string, answer: string): Promise<Result<SessionView>> {
  const r = await run(() => startDefence(String(lessonId), String(answer ?? "")));
  return r;
}

export async function replyAiDefence(sessionId: string, answer: string): Promise<Result<SessionView>> {
  return run(() => replyDefence(String(sessionId), String(answer ?? "")));
}

export async function finishAiDefence(sessionId: string): Promise<Result<FinishResult>> {
  const r = await run(() => finishDefence(String(sessionId)));
  revalidatePath("/", "layout");
  return r;
}

export async function abandonAiDefence(sessionId: string) {
  abandonDefence(String(sessionId));
  revalidatePath("/", "layout");
}
