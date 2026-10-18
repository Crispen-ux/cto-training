"use client";

import { useState, useTransition } from "react";
import { askTutor } from "@/app/ai-actions";

type Mode = "explain" | "quiz" | "feedback";
interface Msg { role: "user" | "assistant"; content: string }

const HINT: Record<Mode, string> = {
  explain: "Ask about anything in this lesson.",
  quiz: "Type 'start' and the tutor asks you one question at a time.",
  feedback: "Write your own answer to the explanation task and get feedback. No score, not evidence.",
};

export default function Tutor({ lessonId, configured, mock }: { lessonId: string; configured: boolean; mock: boolean }) {
  const [mode, setMode] = useState<Mode>("explain");
  const [history, setHistory] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!configured) {
    return (
      <div className="notice warn">
        <strong>AI tutor is off.</strong> The server has no AI provider configured. Set <code>ANTHROPIC_API_KEY</code> and restart to turn it on.
      </div>
    );
  }

  function send() {
    const message = text.trim();
    if (!message) return;
    setError("");
    const before = history;
    setHistory([...before, { role: "user", content: message }]);
    setText("");
    start(async () => {
      const r = await askTutor(lessonId, mode, before, message);
      if (r.ok) setHistory((h) => [...h, { role: "assistant", content: r.data }]);
      else {
        setError(r.error);
        setHistory(before);
        setText(message);
      }
    });
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>AI tutor <span className="badge">practice only, never evidence</span></h3>
      {mock && <div className="notice warn">Mock provider: replies are placeholders, not answers.</div>}
      <div className="row" role="tablist" aria-label="Tutor mode">
        {(["explain", "quiz", "feedback"] as Mode[]).map((m) => (
          <button key={m} type="button" role="tab" aria-selected={mode === m} className={mode === m ? "" : "ghost"} onClick={() => { setMode(m); setHistory([]); setError(""); }}>
            {m === "explain" ? "Explain" : m === "quiz" ? "Quiz me" : "Feedback on my explanation"}
          </button>
        ))}
      </div>
      <p className="muted">{HINT[mode]} Answers come from this lesson only; anything beyond it is labelled. The tutor does not know the knowledge-check answers.</p>
      <div className="chat" aria-live="polite">
        {history.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>
            <strong>{m.role === "user" ? "You" : "Tutor"}</strong>
            <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
          </div>
        ))}
        {pending && <p className="muted">Thinking…</p>}
      </div>
      {error && <div className="notice err">{error}</div>}
      <label htmlFor={`tutor-${lessonId}`}>Your message</label>
      <textarea id={`tutor-${lessonId}`} value={text} onChange={(e) => setText(e.target.value)} style={{ minHeight: 80 }} maxLength={6000} />
      <p><button type="button" onClick={send} disabled={pending || !text.trim()}>{pending ? "Sending…" : "Send"}</button></p>
      <p className="muted">Your messages and this lesson's text are sent to the AI provider. Do not paste secrets or personal data.</p>
    </div>
  );
}
