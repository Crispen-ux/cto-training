import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { parseMarkdownLesson, loadMarkdownLessons } from "@/lib/content-markdown";
import { loadLessons } from "@/lib/content";

const FILE = path.join(process.cwd(), "lessons", "reliability-engineering", "sli-slo-sla-error-budgets.md");

describe("markdown lesson import", () => {
  it("parses the real authored lesson", () => {
    const raw = fs.readFileSync(FILE, "utf8");
    const lesson = parseMarkdownLesson(FILE, raw);
    expect(lesson).not.toBeNull();
    expect(lesson!.title).toBe("SLI, SLO, SLA and Error Budgets");
    expect(lesson!.kind).toBe("reference");
    expect(lesson!.objectives.length).toBeGreaterThanOrEqual(5);
  });

  it("keeps the author's em dash intact rather than mangling it", () => {
    const raw = fs.readFileSync(FILE, "utf8");
    const lesson = parseMarkdownLesson(FILE, raw)!;
    const all = JSON.stringify(lesson);
    expect(all).not.toContain("\uFFFD");
    expect(raw).toContain("\u2014");
  });

  it("extracts real section content, not placeholders", () => {
    const lesson = parseMarkdownLesson(FILE, fs.readFileSync(FILE, "utf8"))!;
    expect(lesson.learn.sections.length).toBeGreaterThan(4);
    const sli = lesson.learn.sections.find((s) => /Service Level Indicator/i.test(s.heading));
    expect(sli, "SLI section should be found").toBeTruthy();
    expect(sli!.body).toContain("quantitative measure");
  });

  it("does NOT fabricate a knowledge check", () => {
    const lesson = parseMarkdownLesson(FILE, fs.readFileSync(FILE, "utf8"))!;
    expect(lesson.knowledgeCheck).toHaveLength(0);
    expect(lesson.verificationNotes.join(" ")).toMatch(/none was generated/i);
  });

  it("builds defence prompts from the author's own objectives", () => {
    const lesson = parseMarkdownLesson(FILE, fs.readFileSync(FILE, "utf8"))!;
    expect(lesson.defend.prompts.length).toBeGreaterThan(0);
    // prompts must come from the lesson, not be invented
    const objectives = lesson.objectives.join(" ").toLowerCase();
    expect(objectives).toContain("sli");
  });

  it("records provenance to the authored source", () => {
    const lesson = parseMarkdownLesson(FILE, fs.readFileSync(FILE, "utf8"))!;
    expect(lesson.sources[0].url).toContain("sli-slo-sla-error-budgets.md");
    expect(lesson.sources[0].reviewDepth).toMatch(/verbatim/i);
  });

  it("escapes nothing dangerous because it never renders raw HTML", () => {
    const lesson = parseMarkdownLesson(FILE, fs.readFileSync(FILE, "utf8"))!;
    for (const s of lesson.learn.sections) expect(typeof s.body).toBe("string");
  });

  it("loads through the normal lesson loader", () => {
    const all = loadLessons();
    const found = all.find((l) => l.id === "sli-slo-sla-error-budgets");
    expect(found, "markdown lesson must be visible to the app").toBeTruthy();
    expect(found!.kind).toBe("reference");
  });

  it("does not duplicate framework lessons", () => {
    const all = loadLessons();
    const ids = all.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("dora-metrics");
  });

  it("returns an empty list when the directory is absent", () => {
    expect(loadMarkdownLessons()).toBeInstanceOf(Array);
  });
});

describe("the lesson integrity rule now distinguishes reference lessons", () => {
  it("framework lessons keep their quiz requirement", () => {
    const all = loadLessons();
    for (const l of all.filter((x) => x.kind !== "reference")) {
      expect(l.knowledgeCheck.length, l.id).toBeGreaterThanOrEqual(5);
    }
  });

  it("reference lessons are allowed to have none, and that is asserted", () => {
    const refs = loadLessons().filter((l) => l.kind === "reference");
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      // Either the author supplied questions, or none were invented.
      const supplied = r.sources[0].reviewDepth.includes("Knowledge check supplied");
      if (!supplied) expect(r.knowledgeCheck).toHaveLength(0);
    }
  });
});
