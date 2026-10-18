import Link from "next/link";
import { validateBank } from "@/lib/scenario/bank";
import { listAttempts, pendingReview } from "@/lib/scenario/store";
import { loadRoadmap } from "@/lib/content";
import { startScenario } from "@/app/scenario-actions";

export const dynamic = "force-dynamic";

const THEME_LABELS: Record<string, string> = {
  "application-architecture": "Application architecture",
  "serverless-event-driven": "Serverless and event-driven",
  "streaming-analytics": "Streaming and analytics",
  "security-identity": "Security and identity",
  "data-architecture": "Data architecture",
  "ai-data": "AI and data",
  "resilience-recovery": "Resilience and recovery",
  "migration-modernisation": "Migration and modernisation",
  "cost-performance": "Cost and performance",
  "hybrid-networking": "Hybrid, APIs and networking",
  "governance-observability": "Governance and observability",
  "executive-risk": "Executive risk decisions",
};

export default async function ScenarioBank({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const report = validateBank();
  const attempts = listAttempts();
  const waiting = pendingReview();
  const roadmap = loadRoadmap();

  return (
    <>
      <h1>Scenario lab</h1>
      <p className="muted">
        Enterprise design problems with competing requirements, incomplete information and a mid-exercise
        change. Difficulty comes from the decision, not from obscurity. A correct service name with weak
        reasoning does not pass; a defensible alternative does, when you state the conditions that make it win.
      </p>

      {sp.ok && <p className="notice ok">{sp.ok}</p>}
      {sp.error && <p className="notice err">{sp.error}</p>}

      {report.errorCount > 0 && (
        <p className="notice err">
          {report.errorCount} structural problem(s) in the bank. Scenarios with errors are not offered below.
        </p>
      )}

      <div className="grid cols3">
        {report.scenarios.map((s) => {
          const errors = report.issues.filter(
            (i) => i.severity === "error" && i.issue.startsWith(s.id),
          );
          const mine = attempts.filter((a) => a.scenarioId === s.id);
          const submitted = mine.filter((a) => a.submittedAt);
          const best = submitted.reduce<number | null>(
            (acc, a) => {
              const obj = a.score?.objectiveScore ?? 0;
              return acc === null ? obj : Math.max(acc, obj);
            },
            null,
          );
          const module = roadmap.modules.find((m) => m.id === s.moduleId);

          if (errors.length > 0) {
            return (
              <div className="card" key={s.id}>
                <span className="badge bad">not offered</span>
                <h3>{s.title}</h3>
                <p className="muted" style={{ fontSize: 13 }}>
                  {errors.length} structural problem(s), for example: {errors[0].issue}
                </p>
              </div>
            );
          }

          return (
            <div className="card" key={s.id}>
              <span className="badge">{THEME_LABELS[s.theme] ?? s.theme}</span>
              <span className="badge">{s.difficulty}</span>
              <span className="badge">{s.cloudScope}</span>
              <h3>{s.title}</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                {s.timeEstimateMinutes} minutes · {s.questions.length} questions · {s.diagram.elements.length}{" "}
                components · {s.sources.length} sources
              </p>
              {module && (
                <p className="muted" style={{ fontSize: 13 }}>
                  Curriculum: {module.title}
                </p>
              )}
              <p className="muted" style={{ fontSize: 13 }}>
                {s.ambiguity.missingInformation.length} things not told to you, {s.ambiguity.ambiguities.length}{" "}
                ambiguous statements.
              </p>
              <p style={{ fontSize: 13 }}>
                {submitted.length > 0 ? (
                  <>
                    <span className="badge good">
                      {submitted.length} submitted
                      {best !== null ? ` · best objective ${Math.round(best * 100)}%` : ""}
                    </span>{" "}
                  </>
                ) : (
                  <span className="badge">not started</span>
                )}
              </p>
              <form action={startScenario}>
                <input type="hidden" name="scenarioId" value={s.id} />
                <button className="btn" type="submit">
                  {mine.length > 0 ? "Start a new attempt" : "Start"}
                </button>
              </form>
              {mine.length > 0 && (
                <ul className="tight">
                  {mine
                    .slice(-3)
                    .reverse()
                    .map((a) => (
                      <li key={a.id}>
                        <Link href={`/scenario/${s.id}?attempt=${a.id}`}>
                          {a.submittedAt ? `Submitted · stage ${a.stage}` : `In progress · stage ${a.stage}`}
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {report.scenarios.length === 0 && (
        <p className="notice warn">
          No scenarios have been authored yet. The bank is validated on load, so a malformed file is reported
          rather than silently skipped.
        </p>
      )}

      {waiting.length > 0 && (
        <>
          <h2>Waiting for review</h2>
          <p className="muted">
            A submitted scenario is not evidence until someone other than you has judged the deliverable.
          </p>
          <ul className="tight">
            {waiting.map((a) => (
              <li key={a.id}>
                <Link href={`/review?scenario=${a.id}`}>{a.scenarioId} — submitted {a.submittedAt?.slice(0, 10)}</Link>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>What a scenario asks of you</h2>
      <p className="muted">
        Every scenario runs the same sequence. The model answer stays hidden until you have committed to a
        decision, defended it, adapted to a change and produced a deliverable.
      </p>
      <ol>
        <li>Read the context, requirements, constraints and diagram. Nothing is hidden.</li>
        <li>Name the requirements that actually decide the design, and what you still need to ask.</li>
        <li>Choose, and justify it by mechanism rather than adjective.</li>
        <li>Name the alternatives you rejected and the conditions under which each wins.</li>
        <li>Revise or defend the decision after a requirement changes.</li>
        <li>Produce the deliverable the scenario asks for.</li>
        <li>Compare against the model answer and its sources.</li>
      </ol>
    </>
  );
}
