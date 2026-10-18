import { describe, expect, it } from "vitest";
import { loadLessons, loadRoadmap } from "@/lib/content";
import { loadRegister, parseCsv, parseRegister } from "@/lib/register";
import { scoreKnowledgeCheck } from "@/lib/scoring";

const register = loadRegister();
const paths = new Set(register.map((r) => r.path));
const lessons = loadLessons();
const roadmap = loadRoadmap();

describe("source register", () => {
  it("parses quoted fields with commas and builds full URLs", () => {
    const rows = parseCsv('a,b\n"x, y","say ""hi"""\n');
    expect(rows[1]).toEqual(["x, y", 'say "hi"']);
    const parsed = parseRegister(
      'pillar,section,title,path,role_tag,source_category,date_reviewed,review_depth\nTech,S,"A, B",/tech/x,,Official CTO Framework,2026-10-11,index-only\n',
    );
    expect(parsed[0].title).toBe("A, B");
    expect(parsed[0].url).toBe("https://www.ctoframework.com/tech/x");
  });

  it("loads the full register with unique paths and the official category", () => {
    expect(register.length).toBe(281);
    expect(paths.size).toBe(register.length);
    expect(register.every((r) => r.sourceCategory === "Official CTO Framework")).toBe(true);
    expect(register.every((r) => r.path.startsWith("/"))).toBe(true);
  });
});

describe("roadmap integrity", () => {
  it("every module path exists in the register (no fabricated URLs)", () => {
    for (const m of roadmap.modules) {
      for (const p of m.registerPaths) {
        expect(paths.has(p), `${m.id}: ${p}`).toBe(true);
      }
    }
  });

  it("modules reference real phases and real lessons", () => {
    const phaseIds = new Set(roadmap.phases.map((p) => p.id));
    const lessonIds = new Set(lessons.map((l) => l.id));
    for (const m of roadmap.modules) {
      expect(phaseIds.has(m.phase), m.id).toBe(true);
      for (const l of m.lessons) expect(lessonIds.has(l), l).toBe(true);
      if (m.status === "available") expect(m.lessons.length).toBeGreaterThan(0);
    }
  });

  it("every lesson file is referenced by exactly one module (no orphans or duplicates)", () => {
    const counts = new Map<string, number>();
    for (const m of roadmap.modules) for (const l of m.lessons) counts.set(l, (counts.get(l) ?? 0) + 1);
    for (const l of lessons) {
      expect(counts.get(l.id) ?? 0, `${l.id} must be referenced by exactly one module`).toBe(1);
      // Imported reference lessons may omit moduleId; their roadmap membership
      // is what matters. Framework lessons must declare the right one.
      if (l.kind !== "reference") {
        expect(l.moduleId, l.id).toBe(roadmap.modules.find((m) => m.lessons.includes(l.id))?.id);
      }
    }
  });
});

describe("lesson integrity", () => {
  it("has the three modes and a source category on every lesson", () => {
    for (const l of lessons) {
      expect(l.learn.sections.length, l.id).toBeGreaterThan(0);
      // A reference lesson is imported study material with no authored quiz.
      // Nothing is fabricated for it, so it is exempt from the quiz minimum.
      if (l.kind !== "reference") {
        expect(l.knowledgeCheck.length, l.id).toBeGreaterThanOrEqual(5);
      }
      expect(l.build.acceptance.length, l.id).toBeGreaterThan(0);
      expect(l.defend.prompts.length, l.id).toBeGreaterThan(0);
      expect(l.sources.length, l.id).toBeGreaterThan(0);
      for (const s of l.learn.sections) expect(s.sourceCategory).toBeTruthy();
    }
  });

  it("official sources point to registered pages and record review details", () => {
    for (const l of lessons) {
      for (const s of l.sources.filter((x) => x.category === "Official CTO Framework")) {
        const path = s.url.replace("https://www.ctoframework.com", "");
        expect(paths.has(path), `${l.id}: ${s.url}`).toBe(true);
        expect(s.reviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(s.reviewDepth.length).toBeGreaterThan(0);
      }
      expect(l.verificationNotes.length, l.id).toBeGreaterThan(0);
    }
  });

  it("knowledge check answers are valid indices and questions are unique", () => {
    for (const l of lessons) {
      const ids = new Set<string>();
      for (const q of l.knowledgeCheck) {
        expect(ids.has(q.id)).toBe(false);
        ids.add(q.id);
        expect(Number.isInteger(q.answer)).toBe(true);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
    }
  });

  it("defence rubric weights sum to 1", () => {
    for (const l of lessons) {
      const sum = l.defend.rubric.reduce((s, r) => s + r.weight, 0);
      expect(Math.abs(sum - 1), l.id).toBeLessThan(1e-9);
    }
  });

  it("unlock prerequisites reference real lessons and there are no cycles", () => {
    const ids = new Set(lessons.map((l) => l.id));
    for (const l of lessons) {
      for (const p of l.unlock.prerequisites) {
        expect(ids.has(p.lessonId), `${l.id} -> ${p.lessonId}`).toBe(true);
        expect(p.lessonId).not.toBe(l.id);
      }
    }
    const visit = (id: string, stack: string[]) => {
      expect(stack.includes(id), `cycle: ${[...stack, id].join(" -> ")}`).toBe(false);
      const l = lessons.find((x) => x.id === id)!;
      for (const p of l.unlock.prerequisites) visit(p.lessonId, [...stack, id]);
    };
    lessons.forEach((l) => visit(l.id, []));
  });
});

describe("knowledge check scoring", () => {
  const lesson = lessons.find((l) => l.id === "dora-metrics")!;
  const perfect = Object.fromEntries(lesson.knowledgeCheck.map((q) => [q.id, q.answer]));

  it("scores a perfect submission as 1", () => {
    expect(scoreKnowledgeCheck(lesson, perfect).score).toBe(1);
  });

  it("scores partial and empty submissions", () => {
    const partial = { ...perfect, [lesson.knowledgeCheck[0].id]: (lesson.knowledgeCheck[0].answer + 1) % 4 };
    expect(scoreKnowledgeCheck(lesson, partial).correct).toBe(4);
    expect(scoreKnowledgeCheck(lesson, {}).score).toBe(0);
  });

  it("treats invalid values as wrong", () => {
    const bad = { [lesson.knowledgeCheck[0].id]: NaN as unknown as number };
    expect(scoreKnowledgeCheck(lesson, bad).correct).toBe(0);
  });
});
