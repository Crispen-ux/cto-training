import fs from "node:fs";
import path from "node:path";
import type { Pillar, UnlockRule } from "./engine";

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
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Lesson);
}

export function getLesson(id: string): Lesson | undefined {
  const file = path.join(root, "lessons", `${id}.json`);
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as Lesson;
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
