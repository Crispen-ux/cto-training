import { getLesson } from "@/lib/content";
import { readState, scenarioRefToAttemptId } from "@/lib/store";
import { getAttempt } from "@/lib/scenario/store";
import { getScenario } from "@/lib/scenario/bank";
import { submitReview } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Review({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string; scenario?: string }>;
}) {
  const sp = await searchParams;
  const pending = readState().submissions.filter((s) => s.status === "pending");

  // A scenario submission is judged on the reasoning behind the deliverable, not
  // on the deliverable alone, so the attempt is loaded and shown alongside it.
  const scenarioContext = (artifactRef: string | undefined) => {
    const attemptId = scenarioRefToAttemptId(artifactRef);
    if (!attemptId) return null;
    const attempt = getAttempt(attemptId);
    if (!attempt) return null;
    const scenario = getScenario(attempt.scenarioId);
    return { attempt, scenario };
  };

  return (
    <>
      <h1>Review queue</h1>
      <p className="muted">
        Builds and defences become evidence only when a reviewer scores them. The pass mark is 70%. Flag anything you are
        unsure about and it will not count until cleared.
      </p>
      <div className="notice warn">
        Reviewing your own work defeats the purpose. Use a mentor or peer; this app cannot yet tell who is at the keyboard.
        Defences the AI assessor was unsure about appear here with its preliminary result. That result is not evidence and
        does not count unless you score the submission yourself.
      </div>
      {sp.error && <div className="notice err">{sp.error}</div>}
      {sp.ok && <div className="notice ok">{sp.ok}</div>}

      {pending.length === 0 && <p className="muted">Nothing is waiting for review.</p>}
      {pending.map((s) => {
        const lesson = getLesson(s.lessonId);
        const ctx = scenarioContext(s.artifactRef);
        const criteria = ctx?.scenario
          ? ctx.scenario.deliverable.acceptance
          : s.kind === "defence"
            ? lesson?.defend.rubric.map((r) => `${r.criterion} (${Math.round(r.weight * 100)}%)`)
            : lesson?.build.acceptance;
        return (
          <div className="card" key={s.id} style={{ marginTop: 14 }}>
            <span className="badge">{s.kind}</span>
            {s.dataLabel && <span className="badge">{s.dataLabel} data</span>}
            {ctx && <span className="badge official">scenario exercise</span>}
            <h3 style={{ marginTop: 8 }}>
              {ctx?.scenario ? ctx.scenario.title : (lesson?.title ?? s.lessonId)}
            </h3>
            <p className="muted">Submitted {s.createdAt.slice(0, 16).replace("T", " ")}</p>
            {s.artifactRef && <p>Artifact: {s.artifactRef}</p>}
            {s.aiPreliminary && (
              <div className="notice warn">
                <strong>AI preliminary, not evidence:</strong> {Math.round(s.aiPreliminary.score * 100)}%. {s.aiPreliminary.summary}
                <div className="muted">Sent to you because: {s.aiPreliminary.flags.join(", ") || "n/a"}. Full audit record is in the assessment log. Score it from the work, not from this number.</div>
              </div>
            )}

            {ctx && ctx.attempt.score && (
              <div className="notice">
                <strong>Objective questions:</strong> {ctx.attempt.score.objectiveCorrect} of{" "}
                {ctx.attempt.score.objectiveTotal} correct. This covers knowledge only. Score the design from the
                deliverable below, not from that number.
                {ctx.attempt.score.blockers.length > 0 && (
                  <div className="muted">{ctx.attempt.score.blockers.join(" ")}</div>
                )}
              </div>
            )}

            {ctx && (
              <details>
                <summary>Full reasoning behind this deliverable</summary>
                <h4>Stated decisive constraints</h4>
                <ul className="tight">
                  {ctx.attempt.decisiveRequirements.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
                <h4>Rationale</h4>
                <pre className="work">{ctx.attempt.rationale || "not recorded"}</pre>
                {ctx.attempt.challenges.length > 0 && (
                  <>
                    <h4>Challenges raised that the learner had to answer</h4>
                    <ul className="tight">
                      {ctx.attempt.challenges.map((c, i) => (
                        <li key={i}>
                          {c.finding} {c.challenge}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
                <h4>Alternatives considered</h4>
                <pre className="work">{ctx.attempt.alternatives || "not recorded"}</pre>
                <h4>Revision after the requirement changed</h4>
                <pre className="work">{ctx.attempt.twistAnswer || "not recorded"}</pre>
                {!ctx.attempt.twistApplied && (
                  <p className="muted">
                    The revision did not visibly engage with the changed requirement. Worth probing in your notes.
                  </p>
                )}
                <h4>Open questions, as written</h4>
                {Object.entries(ctx.attempt.openAnswers).map(([qid, text]) => (
                  <div key={qid}>
                    <h5>{qid}</h5>
                    <pre className="work">{text}</pre>
                  </div>
                ))}
              </details>
            )}

            <pre className="work">{s.content}</pre>
            <h3>{ctx?.scenario ? "Acceptance criteria" : s.kind === "defence" ? "Rubric" : "Acceptance criteria"}</h3>
            <ul className="tight">{criteria?.map((c) => <li key={c}>{c}</li>)}</ul>
            <form action={submitReview}>
              <input type="hidden" name="submissionId" value={s.id} />
              <label htmlFor={`score-${s.id}`}>Score (0 to 100)</label>
              <input id={`score-${s.id}`} name="score" type="number" min={0} max={100} required />
              <label htmlFor={`notes-${s.id}`}>Review notes (required: what was met, what was missing)</label>
              <textarea id={`notes-${s.id}`} name="notes" required style={{ minHeight: 90 }} />
              <label className="opt" style={{ display: "flex", gap: 8, fontWeight: 400 }}>
                <input type="checkbox" name="flag" /> Uncertain: flag for further human review (does not count yet)
              </label>
              <p><button type="submit">Save review</button></p>
            </form>
          </div>
        );
      })}
    </>
  );
}
