"use client";

import { useState, useTransition } from "react";
import { getBuildFeedback } from "@/app/ai-actions";

export default function BuildFeedback({ lessonId, configured }: { lessonId: string; configured: boolean }) {
  const [text, setText] = useState("");
  const [out, setOut] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  if (!configured) return null;
  return (
    <div className="card" style={{ marginTop: 14 }}>
      <h3 style={{ marginTop: 0 }}>Draft feedback from the AI tutor <span className="badge">not a score, not evidence</span></h3>
      <p className="muted">
        Paste your write-up before you submit it. The AI sees only your words. It cannot open your repository or run your code, so it cannot confirm that anything works. A person still scores the build.
      </p>
      <label htmlFor="bf">Your write-up</label>
      <textarea id="bf" value={text} onChange={(e) => setText(e.target.value)} maxLength={6000} />
      {error && <div className="notice err">{error}</div>}
      {out && <pre className="work">{out}</pre>}
      <p>
        <button type="button" disabled={pending || text.trim().length < 100} onClick={() => {
          setError(""); setOut("");
          start(async () => { const r = await getBuildFeedback(lessonId, text); if (r.ok) setOut(r.data); else setError(r.error); });
        }}>{pending ? "Reading…" : "Get feedback"}</button>
      </p>
    </div>
  );
}
