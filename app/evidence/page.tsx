import { computeXp, counts } from "@/lib/engine";
import { readState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default function EvidencePage() {
  const { evidence } = readState();
  const xp = computeXp(evidence);
  const sorted = [...evidence].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <>
      <h1>Evidence and XP ledger</h1>
      <p className="muted">
        Everything that counts toward mastery is listed here. XP is derived from this evidence, so it cannot be edited.
      </p>

      <h2>Evidence ({evidence.length})</h2>
      <div className="card">
        {sorted.length === 0 ? (
          <p className="muted">No evidence yet. Pass a knowledge check to record the first.</p>
        ) : (
          <table>
            <thead><tr><th>When</th><th>Lesson</th><th>Type</th><th>Score</th><th>Assessed by</th><th>Counts?</th><th>Reference</th></tr></thead>
            <tbody>
              {sorted.map((e) => (
                <tr key={e.id}>
                  <td>{e.createdAt.slice(0, 16).replace("T", " ")}</td>
                  <td>{e.lessonId}</td>
                  <td>{e.type.replace("_", " ")}</td>
                  <td>{Math.round(e.score * 100)}% {e.passed ? "" : "(not passed)"}</td>
                  <td>{e.assessedBy}</td>
                  <td>{counts(e) ? "yes" : e.needsHumanReview ? "no (flagged)" : "no"}</td>
                  <td>{e.artifactRef ?? ""}{e.notes ? <div className="muted">{e.notes}</div> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2>XP ledger ({xp.total} XP)</h2>
      <div className="card">
        {xp.ledger.length === 0 ? (
          <p className="muted">No XP yet.</p>
        ) : (
          <table>
            <thead><tr><th>Lesson</th><th>Reason</th><th>XP</th></tr></thead>
            <tbody>
              {xp.ledger.map((l, i) => (
                <tr key={i}><td>{l.lessonId}</td><td>{l.reason}</td><td>+{l.xp}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
