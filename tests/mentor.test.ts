import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { loadPersonas, getPersona } from "@/lib/mentor";
import { saveMentorSession, getMentorSessions } from "@/lib/store";

describe("mentor", () => {
  it("loads six mentor personas", () => {
    const personas = loadPersonas();
    expect(personas.length).toBe(6);
    expect(getPersona("principal-sa")?.name).toContain("Principal");
  });

  it("persists mentor sessions", () => {
    const before = getMentorSessions().length;
    saveMentorSession({
      id: crypto.randomUUID(),
      personaId: "principal-sa",
      mode: "learn",
      objective: "test",
      track: "Solutions Architect",
      messages: [{ role: "user", text: "hello", at: new Date().toISOString() }],
      actionItems: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    expect(getMentorSessions().length).toBe(before + 1);
  });
});
