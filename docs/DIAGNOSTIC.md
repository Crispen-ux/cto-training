# Entry baseline (diagnostic)

The spec asks for an "entry assessment and competency baseline" and also says every claimed competency needs evidence. The baseline resolves that by being **a measurement of where you start, never a credential**.

## What it is

- 30 questions: 6 per pillar, drawn from the lessons' knowledge-check questions and spread across as many different lessons as possible.
- Options are shuffled per attempt. A seed makes a given attempt reproducible.
- Optional self-rating (1 to 5) per pillar, compared with the sample afterwards.
- Correct answers and explanations are never shown, so the lesson knowledge checks stay meaningful.

## What it is not

- It writes **no evidence**. It awards no XP, unlocks no lesson and cannot raise a competency level. Lessons unlock only from passed prerequisite knowledge checks; to skip ahead, pass those checks.
- It is not a measure of CTO competence. Six multiple-choice questions cannot show that.

## How to read a result

- Each pillar shows the score, a 95% Wilson interval for the score you would get on all of that pillar's questions, and the exact chance of scoring that well by guessing alone (every question has four options, so 25% per question).
- Intervals are wide on purpose. 5/6 is compatible with about 44% to 97%; 6/6 with about 61% to 100%; 2/6 with about 10% to 70%. A band ("strong" at 80% or more, "weak" under 50%) is a label for the sample, not a level.
- A self-rating gap ("possible overestimate": self 4 or 5 with under 50% correct; "possible underestimate": self 1 or 2 with 80% or more) is a prompt to check yourself, not a finding.
- "Where to start" lists lessons whose sampled question you missed, openable ones first, capped at eight.

## Rules and limits

- One attempt per UTC day (`DIAGNOSTIC_RULES.maxPerDay`). The first attempt is kept as the baseline and the latest is shown beside it; different attempts sample different questions, so small changes are noise.
- Every question must be answered; unanswered would skew the score.
- Self-serve: the app has no sign-in, so nothing stops you taking it with help. That only misleads you.
- Thresholds are in `lib/diagnostic.ts`. Tests: `tests/diagnostic.test.ts`. Browser check: `scripts/e2e/run-diagnostic.sh`.
