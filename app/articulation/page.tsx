import Link from "next/link";
import { readState } from "@/lib/store";
import { ARTICULATION, ARTICULATION_RUBRIC_VERSION, leadsWithConclusion } from "@/lib/articulation";
import { submitArticulation } from "../articulation-actions";

export const dynamic = "force-dynamic";

export default async function ArticulationPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string; level?: string }> }) {
  const sp = await searchParams;
  const state = readState();
  const current = ARTICULATION.find((l) => l.id === sp.level) ?? ARTICULATION[0];
  const attempts = [...state.articulationAttempts].reverse();

  return (
    <>
      <h1>Executive communication practice</h1>
      <p className="muted">
        Communication is trained as a capability, not a soft skill. Every attempt is kept so you can see improvement.
        Rubric: {ARTICULATION_RUBRIC_VERSION}. Findings are things to act on, never a score.
      </p>
      {sp.ok && <div className="notice ok">{sp.ok}</div>}
      {sp.error && <div className="notice warn">{sp.error}</div>}

      <div className="tabs">
        {ARTICULATION.map((l) => (
          <a key={l.id} href={`/articulation?level=${l.id}`} className={l.id === current.id ? "active" : ""}>
            {l.label}
          </a>
        ))}
      </div>

      <div className="card">
        <h2>{current.label}</h2>
        <p className="muted"><strong>Audience:</strong> {current.audience}</p>
        <p><strong>Task:</strong> {current.prompt}</p>
        <p className="muted">Target length {current.targetWords[0]}–{current.targetWords[1]} words.</p>
        <h3>How this is judged</h3>
        <ul className="tight">
          {current.rubric.map((r) => <li key={r.criterion}>{r.criterion} ({Math.round(r.weight * 100)}%)</li>)}
        </ul>
        <form action={submitArticulation} style={{ marginTop: 12 }}>
          <input type="hidden" name="level" value={current.id} />
          <label htmlFor="answer">Your answer, written as you would say it</label>
          <textarea id="answer" name="text" rows={8} required />
          <p style={{ marginTop: 8 }}><button className="btn" type="submit">Submit for analysis</button></p>
        </form>
      </div>

      <h2>Your attempts ({attempts.length})</h2>
      {attempts.length === 0 && <div className="card">No attempts yet. Start with level 1.</div>}
      {attempts.map((a) => (
        <div className="card" key={a.id} style={{ marginBottom: 12 }}>
          <h3>{ARTICULATION.find((l) => l.id === a.level)?.label ?? a.level} &mdash; {a.wordCount} words</h3>
          <p className="muted">{new Date(a.createdAt).toLocaleString()}</p>
          <pre className="work">{a.text}</pre>
          {!leadsWithConclusion(a.text) && (
            <div className="notice">This answer does not open with a conclusion. Say the recommendation first.</div>
          )}
          {a.findings.length === 0 ? (
            <div className="notice ok">No language problems detected. Length and precision look right for this level.</div>
          ) : (
            <ul className="tight">
              {a.findings.map((f, i) => (
                <li key={i}>
                  <strong>{f.finding}</strong>
                  {f.excerpt ? <span className="muted"> &mdash; &ldquo;{f.excerpt}&rdquo;</span> : null}
                  <div className="muted">Challenge: {f.challenge}</div>
                </li>
              ))}
            </ul>
          )}
          {!a.review && <p className="muted">Not yet reviewed by a person, so it counts for nothing on the competency model.</p>}
        </div>
      ))}

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
