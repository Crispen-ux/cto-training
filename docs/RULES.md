# Progression rules

All values live in `lib/engine/rules.ts`. Change them there; tests in `tests/engine.test.ts` document the behaviour.

## XP

XP is derived from evidence on every read. It is never stored, so it cannot be edited or drift.

| Evidence type | XP (first pass per lesson) |
|---|---|
| Knowledge check | 20 |
| Practical lab | 40 |
| Tested artifact | 60 |
| Defence | 80 |
| Milestone | 100 |
| Measured outcome | 120 |

- Pass mark is 70%.
- Each (lesson, type) pair pays once.
- Improvement bonus of 50 XP when a first attempt scored under 60% and a later attempt passes with at least 15 points of gain.
- Evidence counts only if assessed by `auto`, `ai` or `human`, and is not flagged for further human review. `self` never counts.
- XP levels use cumulative thresholds: 0, 100, 250, 500, 900, 1400, 2000, 2800, 3800, 5000.

## Academy competency levels (per pillar)

These are Academy assessment levels, not official CTO Framework levels. Levels are cumulative.

| Level | Meaning | Evidence required |
|---|---|---|
| 0 | Not assessed | none |
| 1 | Understands the concept | A passed knowledge check |
| 2 | Applies it with guidance | Level 1 plus a passed lab or reviewed artifact |
| 3 | Executes independently | Level 2 plus, on the same lesson, an artifact with a reference and a passed defence |
| 4 | Designs and leads complex implementations | Level 3 on two different lessons plus one passed milestone |
| 5 | Strategic decisions with measurable outcomes | Level 4 plus a passed outcome with a reference and two defences at 85%+, at least one human-assessed |

## Unlocks

A lesson unlocks from passed prerequisites (and optionally a minimum pillar level), computed from evidence. XP alone never unlocks anything.

## Streaks

Active days count. One missed day between active days is forgiven; two break the streak. The longest streak is kept.

## Review

Builds and defences are submissions. They become evidence only when a reviewer scores them with written notes. A reviewer can flag a result as uncertain, which stops it counting until cleared.

## AI assessment

AI-assessed defences count as `ai` evidence only when no safeguard flag fires. Thresholds, caps and the full procedure are in `docs/AI.md` and `lib/ai/config.ts`. Flagged results go to the review queue and do not count. Tutor and build-feedback output is never evidence.

## Entry baseline

The entry diagnostic is a baseline only. It writes no evidence, awards no XP, unlocks nothing and does not affect competency levels. See `docs/DIAGNOSTIC.md`.
