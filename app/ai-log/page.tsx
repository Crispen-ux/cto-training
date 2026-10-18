import { getLesson } from "@/lib/content";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function AiLog() {
  const log = [...readState().aiAssessments].reverse();
  return (
    <>
      <h1>AI assessment log</h1>
      <p className="muted">
        Every AI defence assessment, with the model, prompt version, per-criterion levels, the quotes the system verified, the flags that
        sent it to a human, and the raw model replies. Nothing here is hidden from you and nothing is edited after the fact.
      </p>
      {log.length === 0 && <p className="muted">No AI assessments yet.</p>}
      {log.map((a) => (
        <div className="card" key={a.id} style={{ marginTop: 14 }}>
          <span className="badge">{a.outcome === "evidence_created" ? "counted as evidence" : "sent to human"}</span>
          <span className="badge">{a.provider} {a.model}</span>
          <span className="badge">{a.promptVersion}</span>
          <h3 style={{ marginTop: 8 }}>{getLesson(a.lessonId)?.title ?? a.lessonId}</h3>
          <p className="muted">
            {a.createdAt.slice(0, 16).replace("T", " ")} · score {Math.round(a.score * 100)}% · confidence {a.confidence.toFixed(2)} · {a.samplesUsed} pass(es)
            {a.flags.length > 0 && <> · flags: {a.flags.join(", ")}</>}
          </p>
          <p>{a.summary}</p>
          <table>
            <thead><tr><th>Criterion</th><th>Level</th><th>Verified quote</th></tr></thead>
            <tbody>
              {a.criteria.map((c) => (
                <tr key={c.criterion}><td>{c.criterion}</td><td>{c.level.toFixed(2)}</td><td>{c.quotes[0] ? `"${c.quotes[0]}"` : "none"}</td></tr>
              ))}
            </tbody>
          </table>
          {a.issues.length > 0 && <ul className="tight">{a.issues.map((i) => <li key={i}>{i}</li>)}</ul>}
          <details>
            <summary>Raw model replies ({a.rawResponses.length})</summary>
            {a.rawResponses.map((r, i) => <pre className="work" key={i}>{r}</pre>)}
          </details>
        </div>
      ))}
    </>
  );
}
