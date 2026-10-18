# AI tutor and assessor

## What it is, and what it is not

- **Tutor** (Learn tab): answers questions about one lesson, quizzes you one question at a time, and gives feedback on your own explanation. It is practice. **Nothing it says is evidence and it never awards XP.**
- **Build feedback** (Build tab): reads your written description of your build against the acceptance criteria. It **cannot see your repository, files or running system**, says so, and gives no score. A person still scores the build.
- **Defence assessor** (Defend tab): cross-examines your written defence for up to two follow-up rounds, then scores it against the lesson's rubric. This is the only AI output that can become evidence.

## Turning it on

Set environment variables on the server and restart:

| Variable | Meaning |
|---|---|
| `ANTHROPIC_API_KEY` | Required. Read from the environment only. Never stored, logged or shown. |
| `ACADEMY_AI_MODEL` | Optional. Default `claude-sonnet-5-5` (listed in Anthropic's model docs when this was written; check it is available to your key). |
| `ACADEMY_AI_BASE_URL` | Optional. A gateway or test server. Operator-set; never taken from users. |
| `ACADEMY_AI_PROVIDER` | Optional. `mock` runs a placeholder provider whose output never counts; `off` disables AI. |

With no key the tutor and assessor are off and the written, human-reviewed defence route is the only one.

## Privacy

When you use the tutor, build feedback or the assessor, **your messages and the lesson text are sent to the AI provider** (Anthropic's Messages API when configured). Do not paste secrets or personal data. Your email address is never sent.

## How an AI score becomes evidence (and when it does not)

1. Preconditions are the same as the written defence: lesson unlocked, knowledge check passed, build submitted. At most 2 AI defence sessions per lesson per day, and 60 provider calls per UTC day overall.
2. After your answers and up to two follow-up rounds, you press Finish. The assessor runs **two independent scoring passes** (the API accepts only the default sampling on current models, so a single pass is noisy).
3. Each pass gives every rubric criterion a level from 0 to 4 and **quotes from your own words**. The system checks that each quote really appears in what you wrote. **Credit without a verifiable quote is set to 0.**
4. **The score is computed in code** from the rubric weights and the mean level per criterion. Any overall score the model reports is ignored.
5. The result goes to a human, **does not count and earns no XP**, if any of these hold: the passes disagree by more than one level on a criterion; average confidence is below 0.6; the score is within 5 points of the pass mark; some credit had no verifiable quote; a pass failed; the assessor reports an attempt to influence scoring, or your text contains instruction-like wording; or the provider is the mock.
6. Otherwise the result is recorded as evidence with `assessedBy: "ai"` (a failing score is recorded as a failed attempt). Existing rules still apply: the defence pays XP once per lesson, and Level 5 still requires a human-assessed defence.
7. Everything is written to the AI log page: provider, model, prompt version, per-criterion levels, verified quotes, flags, and the raw model replies.

Flagged results appear in the Review queue with the AI's preliminary result marked "not evidence". You score from the work, not from that number.

## Limits you should know

- An AI score is an estimate by a language model reading your text. It can be wrong in either direction. It cannot check that your artifact exists or works.
- There is no appeal for an AI score that counted. If you disagree, submit a written defence for a human reviewer; the existing evidence rules decide what counts.
- Prompts: `lib/ai/assessor.ts`, `lib/ai/tutor.ts`. Thresholds: `lib/ai/config.ts`. Bump `promptVersion` when you change a prompt.
- The tutor sees the lesson's learning content, sources and verification notes, but **not** the knowledge-check questions or answers.
- Prompt injection is mitigated (delimiters, neutralised tags, quote verification, flags) but not eliminated.

## How this was tested

- Unit tests with scripted providers (`tests/ai.test.ts`, `tests/ai-actions.test.ts`): parsing, quote verification, score computation, every flag, the flow gates, caps, and the HTTP client against a local server (headers, body, retries, error mapping, key not leaked).
- A browser run (`scripts/e2e/run.sh`) drives the real pages in Chromium against a **fake** Anthropic-compatible server that rejects requests with a wrong header or deprecated sampling parameters.
- **Not tested: any real model.** No API key was available. The first real run may show prompt or parsing problems, for example a model that wraps JSON differently. Run a few defences of known quality (a strong one, a weak one, one with invented numbers) and read the AI log before trusting scores.
