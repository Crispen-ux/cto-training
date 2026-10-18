"use client";

import { useState, useTransition } from "react";
import { abandonAiDefence, finishAiDefence, replyAiDefence, startAiDefence } from "@/app/ai-actions";
import type { FinishResult, SessionView } from "@/lib/ai/flow";

const FLAG_TEXT: Record<string, string> = {
  low_confidence: "the assessor was not confident",
  borderline_score: "the score is too close to the pass mark",
  pass_disagreement: "two scoring passes disagreed",
  unverified_quote: "some credit had no checkable quote from your words",
  manipulation_attempt: "the assessor noticed an attempt to influence the score",
  injection_phrase: "your text contains wording that looks like an instruction to the assessor",
  sample_failed: "a scoring pass failed",
  mock_provider: "this is the mock provider, whose scores never count",
};

export default function DefenceSession({ lessonId, assessor, mock }: { lessonId: string; assessor: string; mock: boolean }) {
  const [session, setSession] = useState<SessionView | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<FinishResult | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function send() {
    setError("");
    const message = text;
    start(async () => {
      const r = session ? await replyAiDefence(session.id, message) : await startAiDefence(lessonId, message);
      if (r.ok) { setSession(r.data); setText(""); } else setError(r.error);
    });
  }
  function finish() {
    if (!session) return;
    setError("");
    start(async () => {
      const r = await finishAiDefence(session.id);
      if (r.ok) { setResult(r.data); setSession({ ...session, status: "scored" }); } else setError(r.error);
    });
  }

  if (result) {
    const counted = result.outcome === "evidence_created";
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Result: {Math.round(result.score * 100)}% ({result.passed ? "pass" : "not passed"}; pass mark {Math.round(result.passMark * 100)}%)</h3>
        {counted ? (
          <div className="notice ok">Recorded as evidence, assessed by AI. It is in your record below, with the full audit trail stored.</div>
        ) : (
          <div className="notice warn">
            <strong>Sent to a human reviewer. This score does not count yet.</strong>
            <ul className="tight">{result.flags.map((f) => <li key={f}>{FLAG_TEXT[f] ?? f}</li>)}</ul>
          </div>
        )}
        <p>{result.summary}</p>
        <table>
          <thead><tr><th>Criterion</th><th>Level (0-4)</th><th>Your words the assessor relied on</th></tr></thead>
          <tbody>
            {result.criteria.map((c) => (
              <tr key={c.criterion}><td>{c.criterion} ({Math.round(c.weight * 100)}%)</td><td>{c.level.toFixed(1)}</td><td>{c.quotes[0] ? `"${c.quotes[0]}"` : "no checkable quote"}</td></tr>
            ))}
          </tbody>
        </table>
        {result.gaps.length > 0 && (<><h3>Gaps</h3><ul className="tight">{result.gaps.map((g) => <li key={g}>{g}</li>)}</ul></>)}
        {result.issues.length > 0 && (<><h3>Checks that reduced credit</h3><ul className="tight">{result.issues.map((g) => <li key={g}>{g}</li>)}</ul></>)}
        <p className="muted">An AI score is an estimate: two passes were averaged and the system checked each quote, but a reviewer can still disagree.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Defend with the AI assessor <span className="badge">{assessor}</span></h3>
      {mock && <div className="notice warn">Mock provider: scores from it never count as evidence and always go to a human.</div>}
      <p className="muted">
        Answer all the questions above in one message. The assessor then asks up to two rounds of follow-up questions, and you finish to get scored. It can only judge your words; it cannot see your repository. Credit needs a quote from what you wrote, so be specific, label assumptions and say how you checked things. At most two AI defences per lesson per day.
      </p>
      {session && (
        <div className="chat" aria-live="polite">
          {session.turns.map((t, i) => (
            <div key={i} className={`bubble ${t.role === "learner" ? "user" : "assistant"}`}>
              <strong>{t.role === "learner" ? "You" : assessor}</strong>
              <div style={{ whiteSpace: "pre-wrap" }}>{t.text}</div>
            </div>
          ))}
        </div>
      )}
      {error && <div className="notice err">{error}</div>}
      {(!session || session.followUpsLeft > 0 || session.turns.at(-1)?.role === "assessor") && (
        <>
          <label htmlFor="ai-def">{session ? "Your reply" : "Your answers"}</label>
          <textarea id="ai-def" value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: session ? 120 : 240 }} maxLength={6000} />
        </>
      )}
      <div className="row">
        {(!session || session.followUpsLeft > 0 || session.turns.at(-1)?.role === "assessor") && (
          <button type="button" onClick={send} disabled={pending || text.trim().length < 30}>{pending ? "Working…" : session ? "Send reply" : "Start defence"}</button>
        )}
        {session && (
          <>
            <button type="button" disabled={pending} onClick={finish}>{pending ? "Scoring…" : "Finish and score"}</button>
            <button type="button" className="ghost" disabled={pending} onClick={() => { void abandonAiDefence(session.id); setSession(null); }}>Abandon</button>
          </>
        )}
      </div>
      <p className="muted">Your answers and this lesson's text are sent to the AI provider. Do not include secrets or personal data.</p>
    </div>
  );
}
