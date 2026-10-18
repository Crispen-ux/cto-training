import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error("REDIRECT:" + url);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));

import { loadLessons } from "@/lib/content";
import {
  DIAGNOSTIC_RULES,
  band,
  buildDiagnostic,
  guessChance,
  publicItems,
  scoreDiagnostic,
  selfGap,
  wilson,
} from "@/lib/diagnostic";
import { PILLARS, computeCompetency, computeXp, checkUnlock } from "@/lib/engine";
import { readState } from "@/lib/store";
import { submitDiagnostic } from "@/app/actions";
import { getLesson } from "@/lib/content";

const lessons = loadLessons();

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "academy-diag-"));
  process.env.ACADEMY_DATA_DIR = dir;
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
  delete process.env.ACADEMY_DATA_DIR;
});

async function redirectedTo(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("REDIRECT:")) return decodeURIComponent(m.slice(9));
    throw e;
  }
  throw new Error("expected a redirect");
}

function form(seed: number, pick: (itemAnswer: number, n: number) => number, self: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("seed", String(seed));
  for (const it of buildDiagnostic(lessons, seed)) fd.set("a:" + it.id, String(pick(it.answer, it.options.length)));
  for (const [k, v] of Object.entries(self)) fd.set("self:" + k, v);
  return fd;
}

describe("buildDiagnostic", () => {
  it("is deterministic for a seed and differs between seeds", () => {
    const a = buildDiagnostic(lessons, 7).map((i) => i.id);
    expect(buildDiagnostic(lessons, 7).map((i) => i.id)).toEqual(a);
    expect(buildDiagnostic(lessons, 8).map((i) => i.id)).not.toEqual(a);
  });

  it("draws the configured number per pillar, from real questions, with no repeats", () => {
    const items = buildDiagnostic(lessons, 123);
    expect(items).toHaveLength(PILLARS.length * DIAGNOSTIC_RULES.perPillar);
    expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
    for (const p of PILLARS) expect(items.filter((i) => i.pillar === p)).toHaveLength(DIAGNOSTIC_RULES.perPillar);
  });

  it("spreads each pillar's questions across different lessons", () => {
    for (const seed of [1, 2, 3, 99]) {
      const items = buildDiagnostic(lessons, seed);
      for (const p of PILLARS) {
        const ls = items.filter((i) => i.pillar === p).map((i) => i.lessonId);
        expect(new Set(ls).size).toBe(DIAGNOSTIC_RULES.perPillar); // every pillar has at least 6 lessons
      }
    }
  });

  it("keeps the answer index pointing at the correct option after shuffling", () => {
    for (const seed of [5, 6, 7]) {
      for (const it of buildDiagnostic(lessons, seed)) {
        const [lessonId, qid] = it.id.split(":");
        const q = getLesson(lessonId)!.knowledgeCheck.find((x) => x.id === qid)!;
        expect(it.options[it.answer]).toBe(q.options[q.answer]);
        expect([...it.options].sort()).toEqual([...q.options].sort());
      }
    }
  });

  it("actually shuffles option order for some questions", () => {
    const moved = buildDiagnostic(lessons, 11).filter((it) => {
      const [lessonId, qid] = it.id.split(":");
      const q = getLesson(lessonId)!.knowledgeCheck.find((x) => x.id === qid)!;
      return it.options.some((o, i) => o !== q.options[i]);
    });
    expect(moved.length).toBeGreaterThan(10);
  });

  it("never sends answers to the browser", () => {
    for (const it of publicItems(buildDiagnostic(lessons, 3))) expect("answer" in it).toBe(false);
  });
});

describe("scoring and statistics", () => {
  it("counts correct, treats unanswered as wrong, and lists each missed lesson once", () => {
    const items = buildDiagnostic(lessons, 42);
    const answers: Record<string, number> = {};
    for (const it of items) answers[it.id] = it.answer;
    expect(scoreDiagnostic(items, answers).every((r) => r.correct === r.total && r.missedLessonIds.length === 0)).toBe(true);

    const tech = items.filter((i) => i.pillar === "Tech");
    delete answers[tech[0].id];
    answers[tech[1].id] = (tech[1].answer + 1) % tech[1].options.length;
    const r = scoreDiagnostic(items, answers).find((x) => x.pillar === "Tech")!;
    expect(r.correct).toBe(DIAGNOSTIC_RULES.perPillar - 2);
    expect(r.missedLessonIds).toEqual([tech[0].lessonId, tech[1].lessonId]);
  });

  it("matches independently computed Wilson intervals", () => {
    const close = (a: [number, number], b: [number, number]) => {
      expect(a[0]).toBeCloseTo(b[0], 3);
      expect(a[1]).toBeCloseTo(b[1], 3);
    };
    close(wilson(3, 4), [0.3006, 0.9544]);
    close(wilson(5, 6), [0.4365, 0.9699]);
    close(wilson(6, 6), [0.6097, 1.0]);
    close(wilson(0, 6), [0.0, 0.3903]);
    close(wilson(2, 6), [0.0968, 0.7]);
  });

  it("matches independently computed chances of guessing", () => {
    expect(guessChance([4, 4, 4, 4], 3)).toBeCloseTo(0.05078, 4);
    expect(guessChance(Array(6).fill(4), 5)).toBeCloseTo(0.00464, 4);
    expect(guessChance(Array(6).fill(4), 4)).toBeCloseTo(0.0376, 3);
    expect(guessChance(Array(6).fill(4), 3)).toBeCloseTo(0.16943, 4);
    expect(guessChance([4, 4, 2, 3, 4, 5], 4)).toBeCloseTo(0.06302, 4);
    expect(guessChance(Array(6).fill(4), 0)).toBeCloseTo(1, 10);
  });

  it("bands and self-rating gaps follow the documented thresholds", () => {
    expect(band(5, 6)).toBe("strong");
    expect(band(4, 6)).toBe("mixed");
    expect(band(3, 6)).toBe("mixed");
    expect(band(2, 6)).toBe("weak");
    expect(selfGap(5, 2, 6)).toBe("possible overestimate");
    expect(selfGap(1, 6, 6)).toBe("possible underestimate");
    expect(selfGap(3, 3, 6)).toBe("consistent");
    expect(selfGap(undefined, 3, 6)).toBe("not rated");
    expect(selfGap(9, 3, 6)).toBe("not rated");
  });
});

describe("submitDiagnostic", () => {
  it("records a baseline but creates no evidence, XP, unlocks or competency", async () => {
    const before = readState();
    const url = await redirectedTo(submitDiagnostic(form(21, (a) => a, { Tech: "4", People: "9" })));
    expect(url).toMatch(/^\/diagnostic\?ok=/);
    const st = readState();
    expect(st.diagnostics).toHaveLength(1);
    expect(st.diagnostics[0].results.every((r) => r.correct === r.total)).toBe(true);
    expect(st.diagnostics[0].selfRatings).toEqual({ Tech: 4 }); // invalid rating dropped
    expect(st.evidence).toEqual(before.evidence);
    expect(st.submissions).toEqual(before.submissions);
    expect(computeXp(st.evidence).total).toBe(0);
    for (const p of PILLARS) expect(computeCompetency(p, st.evidence).level).toBe(0);
    const locked = lessons.find((l) => l.unlock.prerequisites.length > 0)!;
    expect(checkUnlock(locked.unlock, st.evidence).unlocked).toBe(false);
  });

  it("scores wrong answers and stores them", async () => {
    await redirectedTo(submitDiagnostic(form(22, (a, n) => (a + 1) % n)));
    expect(readState().diagnostics[0].results.every((r) => r.correct === 0)).toBe(true);
  });

  it("requires every question to be answered", async () => {
    const fd = form(23, (a) => a);
    const first = buildDiagnostic(lessons, 23)[0];
    fd.delete("a:" + first.id);
    expect(await redirectedTo(submitDiagnostic(fd))).toMatch(/Answer every question/);
    expect(readState().diagnostics).toHaveLength(0);
  });

  it("rejects out-of-range answers and bad seeds", async () => {
    const fd = form(24, (a) => a);
    fd.set("a:" + buildDiagnostic(lessons, 24)[0].id, "9");
    expect(await redirectedTo(submitDiagnostic(fd))).toMatch(/Answer every question/);
    const bad = form(24, (a) => a);
    bad.set("seed", "-5");
    expect(await redirectedTo(submitDiagnostic(bad))).toMatch(/invalid/);
    expect(readState().diagnostics).toHaveLength(0);
  });

  it("allows one attempt per day", async () => {
    await redirectedTo(submitDiagnostic(form(25, (a) => a)));
    expect(await redirectedTo(submitDiagnostic(form(26, (a) => a)))).toMatch(/already taken the diagnostic today/);
    expect(readState().diagnostics).toHaveLength(1);
  });

  it("keeps the first attempt as the baseline when an earlier-dated attempt exists", async () => {
    // Simulate a previous day's attempt, then take today's.
    const file = path.join(dir, "state.json");
    fs.writeFileSync(
      file,
      JSON.stringify({
        evidence: [],
        submissions: [],
        diagnostics: [{ id: "old", takenAt: "2020-01-01T00:00:00.000Z", seed: 1, selfRatings: {}, answers: {}, results: [{ pillar: "Tech", correct: 1, total: 6, missedLessonIds: [] }] }],
      }),
    );
    await redirectedTo(submitDiagnostic(form(27, (a) => a)));
    const d = readState().diagnostics;
    expect(d.map((x) => x.id)[0]).toBe("old");
    expect(d).toHaveLength(2);
  });
});
