import fs from "node:fs";
import path from "node:path";
import type { Pillar, UnlockRule } from "./engine";
import { loadMarkdownLessons } from "./content-markdown";

export type SourceCategory =
  | "Official CTO Framework"
  | "Supplementary free learning resource"
  | "Original Academy lesson or simulation"
  | "Practical project or assessment";

export interface Source {
  category: SourceCategory;
  title: string;
  url: string;
  reviewed: string;
  reviewDepth: string;
}

export interface Lesson {
  id: string;
  moduleId: string;
  pillar: Pillar;
  /**
   * "framework" = authored against the CTO Framework with a scored quiz.
   * "reference"  = imported Markdown study material; no quiz is fabricated,
   *                so it is evidenced by written work instead.
   */
  kind?: "framework" | "reference";
  title: string;
  estimatedMinutes: { learn: number; build: number; defend: number };
  objectives: string[];
  prerequisites: string[];
  unlock: UnlockRule;
  sources: Source[];
  verificationNotes: string[];
  learn: {
    sections: { heading: string; sourceCategory: SourceCategory; body: string }[];
    workedExample: { sourceCategory: SourceCategory; title: string; body: string };
    misconceptions: string[];
    explainTask: string;
  };
  knowledgeCheck: {
    id: string;
    question: string;
    options: string[];
    answer: number;
    why: string;
  }[];
  build: {
    business: string;
    problem: string;
    requirements: string[];
    constraints: string[];
    design: string;
    tasks: string[];
    acceptance: string[];
    deliverable: string;
  };
  defend: {
    assessor: string;
    scenario: string;
    prompts: string[];
    rubric: { criterion: string; weight: number }[];
  };
}

export interface Phase {
  id: string;
  title: string;
  monthEstimate: string;
  status: string;
}

export interface Module {
  id: string;
  pillar: Pillar;
  title: string;
  phase: string;
  status: "available" | "planned";
  lessons: string[];
  registerPaths: string[];
}

const root = path.join(process.cwd(), "content");

export function loadLessons(): Lesson[] {
  const dir = path.join(root, "lessons");
  const json = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Lesson);
  // Authored Markdown lessons live outside content/ and are imported, never
  // hand-written into JSON. They are merged so the roadmap can reference them.
  // content-markdown imports only types from this module, so there is no cycle.
  let markdown: Lesson[] = [];
  try {
    markdown = loadMarkdownLessons();
  } catch {
    // a malformed authored lesson must not break the whole curriculum
    markdown = [];
  }
  const byId = new Map<string, Lesson>();
  for (const l of [...json, ...markdown]) byId.set(l.id, l);
  return [...byId.values()];
}

export function getLesson(id: string): Lesson | undefined {
  const file = path.join(root, "lessons", `${id}.json`);
  if (fs.existsSync(/*turbopackIgnore: true*/ file)) {
    try {
      return JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as Lesson;
    } catch {
      return undefined;
    }
  }
  // Imported Markdown lessons are addressed by the same id, so a deep link to
  // one resolves here too rather than 404-ing.
  try {
    return loadMarkdownLessons().find((l) => l.id === id);
  } catch {
    return undefined;
  }
}

export function loadRoadmap(): { note: string; phases: Phase[]; modules: Module[] } {
  return JSON.parse(fs.readFileSync(path.join(root, "roadmap.json"), "utf8"));
}

/** Lessons in module order, so "next lesson" is well defined. */
export function orderedLessons(): Lesson[] {
  const all = loadLessons();
  const byId = new Map(all.map((l) => [l.id, l]));
  const ordered: Lesson[] = [];
  for (const m of loadRoadmap().modules) {
    for (const id of m.lessons) {
      const l = byId.get(id);
      if (l) ordered.push(l);
    }
  }
  return ordered;
}
