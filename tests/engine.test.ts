import { describe, expect, it } from "vitest";
import {
  RULES,
  checkUnlock,
  computeCompetency,
  computeStreak,
  computeXp,
  levelFromXp,
  type Evidence,
} from "@/lib/engine";

let n = 0;
function ev(p: Partial<Evidence>): Evidence {
  n++;
  return {
    id: `e${n}`,
    lessonId: "l1",
    pillar: "Delivery",
    type: "knowledge_check",
    score: 0.9,
    passed: true,
    assessedBy: "auto",
    needsHumanReview: false,
    createdAt: new Date(Date.UTC(2026, 9, 1, 0, 0, n)).toISOString(),
    ...p,
  };
}

describe("XP", () => {
  it("awards XP only for passed, countable evidence", () => {
    const { total } = computeXp([
      ev({ type: "knowledge_check" }),
      ev({ type: "defence", assessedBy: "self" }),
      ev({ type: "lab", passed: false, score: 0.3 }),
      ev({ type: "artifact", needsHumanReview: true }),
    ]);
    expect(total).toBe(RULES.xp.knowledge_check);
  });

  it("pays each lesson/type once", () => {
    const { total } = computeXp([ev({}), ev({}), ev({})]);
    expect(total).toBe(RULES.xp.knowledge_check);
  });

  it("gives an improvement bonus when a weak first attempt is later passed", () => {
    const { total, ledger } = computeXp([
      ev({ score: 0.4, passed: false }),
      ev({ score: 0.8, passed: true }),
    ]);
    expect(total).toBe(RULES.xp.knowledge_check + RULES.improvementBonus);
    expect(ledger.map((l) => l.reason)).toContain("Improved a previously weak result");
  });

  it("gives no bonus when the first attempt was not weak", () => {
    const { total } = computeXp([
      ev({ score: 0.65, passed: false }),
      ev({ score: 0.9, passed: true }),
    ]);
    expect(total).toBe(RULES.xp.knowledge_check);
  });

  it("maps XP to levels with progress", () => {
    expect(levelFromXp(0).level).toBe(1);
    expect(levelFromXp(100).level).toBe(2);
    expect(levelFromXp(249).level).toBe(2);
    expect(levelFromXp(250)).toMatchObject({ level: 3, xpIntoLevel: 0, xpForNext: 250 });
    expect(levelFromXp(99999).xpForNext).toBeNull();
  });
});

describe("Mastery", () => {
  it("is level 0 with no evidence", () => {
    expect(computeCompetency("Delivery", []).level).toBe(0);
  });

  it("level 1 from a knowledge check", () => {
    expect(computeCompetency("Delivery", [ev({})]).level).toBe(1);
  });

  it("ignores self-assessed and flagged evidence", () => {
    const c = computeCompetency("Delivery", [
      ev({ assessedBy: "self" }),
      ev({ needsHumanReview: true }),
    ]);
    expect(c.level).toBe(0);
  });

  it("tracks pillars independently", () => {
    const all = [ev({ pillar: "Tech" })];
    expect(computeCompetency("Tech", all).level).toBe(1);
    expect(computeCompetency("Delivery", all).level).toBe(0);
  });

  it("level 2 needs a lab or artifact on top of level 1", () => {
    const all = [ev({}), ev({ type: "lab", assessedBy: "human" })];
    expect(computeCompetency("Delivery", all).level).toBe(2);
  });

  it("does not skip levels: lab without knowledge check stays 0", () => {
    expect(computeCompetency("Delivery", [ev({ type: "lab", assessedBy: "human" })]).level).toBe(0);
  });

  it("level 3 requires artifact WITH reference and defence on the same lesson", () => {
    const base = [ev({}), ev({ type: "lab", assessedBy: "human" })];
    const noRef = [...base, ev({ type: "artifact", assessedBy: "human" }), ev({ type: "defence", assessedBy: "human" })];
    expect(computeCompetency("Delivery", noRef).level).toBe(2);

    const differentLessons = [
      ...base,
      ev({ type: "artifact", assessedBy: "human", artifactRef: "x", lessonId: "l1" }),
      ev({ type: "defence", assessedBy: "human", lessonId: "l2" }),
    ];
    expect(computeCompetency("Delivery", differentLessons).level).toBe(2);

    const ok = [
      ...base,
      ev({ type: "artifact", assessedBy: "human", artifactRef: "x" }),
      ev({ type: "defence", assessedBy: "human" }),
    ];
    expect(computeCompetency("Delivery", ok).level).toBe(3);
  });

  function level3(lesson: string): Evidence[] {
    return [
      ev({ type: "artifact", assessedBy: "human", artifactRef: "repo", lessonId: lesson }),
      ev({ type: "defence", assessedBy: "human", lessonId: lesson, score: 0.9 }),
    ];
  }

  it("level 4 needs two lessons plus a milestone", () => {
    const base = [ev({}), ev({ type: "lab", assessedBy: "human" }), ...level3("l1")];
    expect(computeCompetency("Delivery", base).level).toBe(3);
    const two = [...base, ...level3("l2")];
    expect(computeCompetency("Delivery", two).level).toBe(3);
    const full = [...two, ev({ type: "milestone", assessedBy: "human" })];
    expect(computeCompetency("Delivery", full).level).toBe(4);
  });

  it("level 5 needs outcome evidence, two strong defences and a human assessor", () => {
    const l4 = [
      ev({}),
      ev({ type: "lab", assessedBy: "human" }),
      ...level3("l1"),
      ...level3("l2"),
      ev({ type: "milestone", assessedBy: "human" }),
    ];
    const outcome = ev({ type: "outcome", assessedBy: "human", artifactRef: "report" });
    expect(computeCompetency("Delivery", [...l4, outcome]).level).toBe(5);

    // Same, but strong defences assessed only by AI: capped at 4.
    const aiOnly = l4.map((e) => (e.type === "defence" ? { ...e, assessedBy: "ai" as const } : e));
    expect(computeCompetency("Delivery", [...aiOnly, outcome]).level).toBe(4);

    // Outcome without a reference does not count.
    const noRef = ev({ type: "outcome", assessedBy: "human" });
    expect(computeCompetency("Delivery", [...l4, noRef]).level).toBe(4);
  });

  it("reports the next missing criterion", () => {
    const c = computeCompetency("Delivery", [ev({})]);
    expect(c.next?.level).toBe(2);
  });
});

describe("Unlocks", () => {
  it("requires passed countable prerequisites", () => {
    const rule = { prerequisites: [{ lessonId: "l1", type: "knowledge_check" as const }] };
    expect(checkUnlock(rule, []).unlocked).toBe(false);
    expect(checkUnlock(rule, [ev({ assessedBy: "self" })]).unlocked).toBe(false);
    expect(checkUnlock(rule, [ev({ passed: false })]).unlocked).toBe(false);
    expect(checkUnlock(rule, [ev({})]).unlocked).toBe(true);
  });

  it("is not unlocked by XP alone: min level is checked from evidence", () => {
    const rule = { prerequisites: [], minLevel: { pillar: "Delivery" as const, level: 2 } };
    const r = checkUnlock(rule, [ev({})]);
    expect(r.unlocked).toBe(false);
    expect(r.reasons[0]).toContain("Delivery level 2");
    expect(checkUnlock(rule, [ev({}), ev({ type: "lab", assessedBy: "human" })]).unlocked).toBe(true);
  });

  it("is unlocked when there are no requirements", () => {
    expect(checkUnlock({ prerequisites: [] }, []).unlocked).toBe(true);
  });
});

describe("Streaks", () => {
  it("is zero with no activity", () => {
    expect(computeStreak([], "2026-10-11")).toEqual({ current: 0, longest: 0 });
  });

  it("counts consecutive days", () => {
    const s = computeStreak(["2026-10-09", "2026-10-10", "2026-10-11"], "2026-10-11");
    expect(s.current).toBe(3);
  });

  it("forgives one missed day", () => {
    const s = computeStreak(["2026-10-08", "2026-10-10", "2026-10-11"], "2026-10-11");
    expect(s.current).toBe(3);
  });

  it("breaks after two missed days between active days", () => {
    const s = computeStreak(["2026-10-07", "2026-10-10", "2026-10-11"], "2026-10-11");
    expect(s.current).toBe(2);
    expect(s.longest).toBe(2);
  });

  it("current is 0 when too long since last activity but longest is kept", () => {
    const s = computeStreak(["2026-10-01", "2026-10-02", "2026-10-03"], "2026-10-11");
    expect(s.current).toBe(0);
    expect(s.longest).toBe(3);
  });

  it("does not double count several events on one day", () => {
    const s = computeStreak(["2026-10-11T08:00:00Z", "2026-10-11T09:00:00Z"], "2026-10-11");
    expect(s.current).toBe(1);
  });
});
