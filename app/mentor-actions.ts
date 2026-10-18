"use server";

import crypto from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getProvider, createMockProvider, type AiProvider } from "@/lib/ai/provider";
import { mentorSystem } from "@/lib/mentor";
import { getPersona } from "@/lib/mentor";
import { capabilityDashboard } from "@/lib/capability";
import { readState, saveMentorSession } from "@/lib/store";
import type { MentorSession } from "@/lib/store";

export async function sendMentorMessage(formData: FormData) {
  const personaId = String(formData.get("personaId") ?? "").trim();
  const mode = String(formData.get("mode") ?? "learn").trim();
  const objective = String(formData.get("objective") ?? "").trim();
  const track = String(formData.get("track") ?? "Solutions Architect").trim();
  const sessionId = String(formData.get("sessionId") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();

  const persona = getPersona(personaId);
  if (!persona) redirect("/mentor?error=Unknown+persona");
  if (!message) redirect(`/mentor?personaId=${personaId}&mode=${mode}&objective=${encodeURIComponent(objective)}&track=${encodeURIComponent(track)}&sessionId=${sessionId}&error=Write+a+message`);

  const state = readState();
  const dashboard = capabilityDashboard(state.capabilityAssessments, track as any);
  const gapContext = dashboard.priorities.slice(0, 5).map((p) => `${p.title}: gap ${p.gap.gap}, ${p.gap.recommendedActivity}`).join("\n");

  let session: MentorSession;
  if (sessionId) {
    const existing = state.mentorSessions.find((s) => s.id === sessionId);
    session = existing ?? {
      id: crypto.randomUUID(),
      personaId,
      mode,
      objective,
      track,
      messages: [],
      actionItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  } else {
    session = {
      id: crypto.randomUUID(),
      personaId,
      mode,
      objective,
      track,
      messages: [],
      actionItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  session.personaId = personaId;
  session.mode = mode;
  session.objective = objective;
  session.track = track;
  session.messages.push({ role: "user", text: message, at: new Date().toISOString() });
  session.updatedAt = new Date().toISOString();

  const provider: AiProvider = getProvider() ?? createMockProvider();
  const system = mentorSystem(persona, mode, objective, track, gapContext);
  const history = session.messages.slice(0, -1).map((m) => ({ role: m.role, content: m.text }));
  let reply = "";
  try {
    const out = await provider.complete({ system, messages: [...history, { role: "user", content: message }], maxTokens: 900 });
    reply = out.text.trim();
  } catch (e) {
    reply = "Mentor is unavailable right now. Please try again later.";
  }
  session.messages.push({ role: "assistant", text: reply, at: new Date().toISOString() });
  saveMentorSession(session);
  revalidatePath("/mentor");
  redirect(`/mentor?personaId=${personaId}&mode=${mode}&objective=${encodeURIComponent(objective)}&track=${encodeURIComponent(track)}&sessionId=${session.id}`);
}
