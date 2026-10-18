# Personal CTO Academy

Learn the framework. Build real systems. Defend your decisions. Prove your competence.

A Next.js app that trains toward the CTO role using the official CTO Framework (https://www.ctoframework.com) as its curriculum source, with Learn / Build / Defend lessons, evidence-gated mastery, and transparent XP.

## Run

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # 57 tests: engine, content integrity, persistence, user journey
npm run typecheck
npm run build && npm start
```

Learner data is stored in `.data/state.json` (git-ignored). Set `ACADEMY_DATA_DIR` to change the location.

## What exists

- Source register of 281 ctoframework.com pages (`data/source-register.csv`), browsable at /sources.
- Roadmap of 8 phases and 20 modules, every module path verified against the register by a test.
- Fifty-eight lessons in twenty-one modules, each with Learn, Build and Defend: Delivery metrics (DORA, SLI/SLO/SLA, RTO/RPO), Reporting and risk (Four Square and RAG, RAID and ROAM, Three Lines of Defence and Swiss Cheese; milestone 1 of the Cretek CTO Operating System) Tech architecture (ADRs and C4, patterns/events/CAP, technical debt) Economics costs (TCO and cloud unit economics, build/buy/outsource) Economics business cases (technology budgets, ROI/NPV/payback, gross margin) Economics investment (funding stages, Jevons rebound forecasting, technology due diligence) Delivery incidents (RCA and blameless post-mortems, pre-mortems and Pareto analysis) Delivery execution (Scrum and Monte Carlo forecasting, WSJF and MoSCoW, RACI and Brooks' law) Tech engineering (SOLID and design patterns, Big-O, the test pyramid and the Boy Scout rule) Tech data and APIs (REST, SQL versus NoSQL, medallion architecture and file formats) and Tech cloud, DevOps and SRE (infrastructure as code and golden paths, error budgets and chaos engineering, cloud provider choice and lock-in) and Tech security (threat modelling and shift-left, least privilege and access control models, SBOMs and supply chain risk), and Tech AI (AI-SDLC and AGENTS.md, choosing and costing models, the EU AI Act with the MIT AI Risk Repository and model collapse), and Product strategy (business models and the Lean Canvas, economic moats and Porter's Five Forces, SWOT and PESTLE), and Product metrics (SaaS metrics and unit economics, NPS and the North Star Metric, A/B/N testing and MVPs), and Product requirements (non-functional requirements and the nines, PII and data protection, ISO 22301 and ISO/IEC 42001), and People leadership (leadership styles and choosing between them, disagree and commit, one-on-ones, skip levels and 360 feedback), and People organisation (Team Topologies and Conway's Law, Dunbar's number, spans of control and matrix structures, developer experience and blameless culture), and People talent (hiring models and cost per effective engineer-year, CTO interviews and succession planning, the 9-box grid and career ladders), and People communication (storytelling and the STAR method, assertive communication and the C-suite, the first 90 days as a CTO).
- Config-driven engine: XP, levels, unlocks, mastery gates, streaks (`docs/RULES.md`).
- Dashboard with today's mission sized to your daily schedule, competency per pillar, evidence log, review queue.

## Honest status and limits

- All 20 planned modules have lesson content, but only the pages named in each module are covered. Many guides in the official index have no lesson and are marked index-only in the source register. They will be written only after the guides are read in full.
- The fifty-six lessons were written from an automated summary of each official guide, not a full manual read. Each lesson lists what requires verification. Read the guides before relying on any figure. The Well-architected guide's body could not be retrieved, so it is not covered by any lesson.
- There is no authentication and no multi-user support. Run it locally; do not expose it publicly.
- Builds and defences are scored by a human reviewer through /review. The app cannot tell who is at the keyboard, so reviewing your own work is possible and defeats the purpose.
- The AI tutor, build feedback and interactive defence assessor are built (see docs/AI.md) but have only been tested against a fake provider and scripted tests, never a real model. Without `ANTHROPIC_API_KEY` they are off and no AI provider is called. The entry baseline diagnostic is built (see docs/DIAGNOSTIC.md). Sign-in is not built yet.
- The Corporate Jargon Assistant and Cretek CTO Operating System are not integrated: no repository for either was available.
- Server-action forms are tested through the action functions with Next's redirect and cache stubbed, plus an HTTP smoke test of every page. They have not been exercised in a real browser.

## Layout

```
app/            pages and server actions
components/     client components
content/        lessons (JSON) and roadmap
data/           source register
lib/engine/     XP, mastery, unlock, streak rules
lib/ai/         provider client, tutor, assessor, flow and caps
lib/diagnostic.ts  entry baseline sampling, scoring and statistics
lib/            content, register, store, scoring, dashboard
tests/          vitest suites
docs/RULES.md   progression rules
docs/AI.md      AI tutor and assessor: setup, privacy, rules, limits
docs/DIAGNOSTIC.md  entry baseline: what it measures and how to read it
scripts/e2e/    browser test against a fake AI provider
```
# cto-training
