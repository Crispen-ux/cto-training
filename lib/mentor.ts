import fs from "node:fs";
import path from "node:path";

export interface MentorPersona {
  id: string;
  name: string;
  focus: string;
  style: string;
  boundaries: string;
}

export interface MentorMode {
  id: string;
  label: string;
  description: string;
}

export const MENTOR_MODES: MentorMode[] = [
  { id: "learn", label: "Learn with me", description: "Explain concepts and test understanding." },
  { id: "socratic", label: "Socratic coaching", description: "Ask questions and guide discovery." },
  { id: "artefact-review", label: "Artefact review", description: "Review diagrams, ADRs, code, threat models and business cases." },
  { id: "architecture-board", label: "Architecture review board", description: "Challenge assumptions, alternatives, risks and consequences." },
  { id: "interview", label: "Interview simulation", description: "Ask realistic questions and score answers." },
  { id: "incident", label: "Incident simulation", description: "Present evolving operational scenarios." },
  { id: "exec-briefing", label: "Executive briefing practice", description: "Explain technical issues in business language." },
  { id: "gap-closure", label: "Gap-closure coaching", description: "Practise the highest-priority competency gap." },
  { id: "career", label: "Career development", description: "Plan evidence-backed progression toward target roles." },
];

export function loadPersonas(): MentorPersona[] {
  const raw = JSON.parse(fs.readFileSync(path.join(process.cwd(), "data", "mentor-personas.json"), "utf8"));
  return raw.personas as MentorPersona[];
}

export function getPersona(id: string): MentorPersona | undefined {
  return loadPersonas().find((p) => p.id === id);
}

export function mentorSystem(persona: MentorPersona, mode: string, objective: string, track: string, gapContext: string): string {
  return [
    `You are ${persona.name}, a rigorous professional mentor in the Personal CTO Academy.`,
    `Purpose and focus: ${persona.focus}`,
    `Coaching style: ${persona.style}`,
    `Boundaries: ${persona.boundaries}`,
    `Mode: ${mode}. Track: ${track}.`,
    `Session objective: ${objective || "Not specified."}`,
    "Follow a structured mentoring session: objective, diagnostic questions, Socratic challenge, targeted teaching, practical exercise, review, feedback, defence questions, summary and next steps. Adapt to time and proficiency.",
    "Do not give the complete answer immediately when guided discovery would teach more. Ask follow-up questions when answers are ambiguous.",
    "Feedback must identify what was correct, what was weak, unverified assumptions, risks, alternatives, business consequences, a stronger example, a practical exercise, and a rubric-based assessment with confidence.",
    "Keep mentor feedback separate from verified practical evidence. Do not claim a competency is mastered from conversation alone.",
    "Label AI feedback as simulated mentoring, not human accreditation.",
    "Distinguish verified facts, user statements and hypotheses. Ask for missing evidence instead of inventing details.",
    "Keep replies under about 300 words unless asked for more. Plain text.",
    "Relevant competency gaps:\n" + (gapContext || "None provided."),
  ].join("\n\n");
}
