import Link from "next/link";
import { readState } from "@/lib/store";
import { explainTradeOff, DECISION_RULES } from "@/lib/decision-loop";
import { submitDecision } from "../decision-actions";

export const dynamic = "force-dynamic";

export default async function DecisionPage({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const state = readState();
  const attempts = [...state.decisionAttempts].reverse();

  return (
    <>
      <h1>Decision loop</h1>
      <p className="muted">
        Practice how you think, not what you remember. Frame the real decision, commit to a call inside{" "}
        {DECISION_RULES.initialDecisionMinutes} minutes, then examine what you accepted. Speed is recorded for
        calibration and never scored as a bonus.
      </p>
      {sp.ok && <div className="notice ok">{sp.ok}</div>}
      {sp.error && <div className="notice warn">{sp.error}</div>}

      <div className="card">
        <h2>1–2. Frame, then decide</h2>
        <form action={submitDecision}>
          <label htmlFor="st">Scenario</label>
          <input id="st" name="scenarioTitle" placeholder="e.g. Whether to migrate the ledger before the audit" required />

          <h3>Problem framing</h3>
          <label htmlFor="dec">The actual decision, in one sentence</label>
          <input id="dec" name="decision" required />
          <label htmlFor="out">Desired outcome</label>
          <input id="out" name="desiredOutcome" required />
          <label htmlFor="con">Constraints (one per line)</label>
          <textarea id="con" name="constraints" required />
          <label htmlFor="stk">Stakeholders (one per line)</label>
          <textarea id="stk" name="stakeholders" required />
          <label htmlFor="unk">Unknowns (one per line)</label>
          <textarea id="unk" name="unknowns" />
          <label htmlFor="asm">Assumptions you are relying on (one per line)</label>
          <textarea id="asm" name="assumptions" />
          <label htmlFor="val">How each assumption would be validated</label>
          <input id="val" name="howToValidate" placeholder="Describe the check that would confirm or kill the assumption" />

          <h3>Rapid decision</h3>
          <label htmlFor="rec">Recommendation</label>
          <input id="rec" name="recommendation" required />
          <label htmlFor="rat">Short rationale</label>
          <textarea id="rat" name="rationale" required />
          <label htmlFor="rsk">Risks (one per line)</label>
          <textarea id="rsk" name="risks" />
          <label htmlFor="wcm">What evidence would change your mind</label>
          <input id="wcm" name="wouldChangeMyMind" required />
          <label htmlFor="min">Minutes the initial call actually took</label>
          <input id="min" name="minutesTaken" type="number" min="1" required />

          <h3>Trade-off analysis</h3>
          <label htmlFor="crit">Criteria (one per line)</label>
          <textarea id="crit" name="criteria" placeholder={"cost\ndelivery-speed\nreversibility"} />
          <label htmlFor="opts">Option titles (one per line, at least two)</label>
          <textarea id="opts" name="optionTitles" />
          <label htmlFor="pref">Preferred option title</label>
          <input id="pref" name="preferred" />
          <label htmlFor="comp">The compromise you are accepting</label>
          <input id="comp" name="compromiseAccepted" />

          <h3>Second-order thinking</h3>
          <label htmlFor="down">Downstream consequences (one per line)</label>
          <textarea id="down" name="downstream" />
          <label htmlFor="fm">Failure modes (one per line)</label>
          <textarea id="fm" name="failureModes" />
          <label htmlFor="oi">Organisational impact (one per line)</label>
          <textarea id="oi" name="organisationalImpact" />
          <label htmlFor="oc">Operational cost (one per line)</label>
          <textarea id="oc" name="operationalCost" />
          <label htmlFor="fc">Future constraints this creates (one per line)</label>
          <textarea id="fc" name="futureConstraints" />

          <p style={{ marginTop: 10 }}><button className="btn" type="submit">Record attempt</button></p>
        </form>
      </div>

      <h2>Your attempts ({attempts.length})</h2>
      {attempts.length === 0 && <div className="card">No attempts yet. Commit to a call before you analyse it.</div>}
      {attempts.map((a) => {
        const analysis = a.tradeOff ? explainTradeOff(a.tradeOff) : null;
        return (
          <div className="card" key={a.id} style={{ marginBottom: 12 }}>
            <h3>{a.scenarioTitle}</h3>
            <p className="muted">{new Date(a.createdAt).toLocaleString()} &mdash; first call took {a.initialDecision.minutesTaken} minutes</p>
            <p><strong>Decision:</strong> {a.framing.decision}</p>
            <p><strong>Recommendation:</strong> {a.initialDecision.recommendation}</p>
            <p><strong>Would change my mind if:</strong> {a.initialDecision.wouldChangeMyMind}</p>
            {analysis && (
              <>
                <h4>Trade-off result</h4>
                <ul className="tight">
                  {analysis.findings.map((f) => (
                    <li key={f.optionId}>
                      {f.optionId}: {f.total}{f.preferred ? " (your choice)" : ""}
                      {f.lostOn.length ? ` &mdash; loses on ${f.lostOn.join(", ")}` : ""}
                    </li>
                  ))}
                </ul>
                <p className="muted">{analysis.caution}</p>
              </>
            )}
            <p className="muted">
              Stages recorded:{" "}
              {["Frame", "Rapid decision", ...(a.tradeOff ? ["Trade-off"] : []), ...(a.secondOrder ? ["Second-order"] : [])].join(", ")}
            </p>
          </div>
        );
      })}

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
