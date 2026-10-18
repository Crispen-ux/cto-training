"use client";

import { useState, useTransition } from "react";
import { submitCheck } from "@/app/actions";

interface Q {
  id: string;
  question: string;
  options: string[];
}

interface Result {
  correct: number;
  total: number;
  score: number;
  passed: boolean;
  passMark: number;
  perQuestion: { id: string; correct: boolean; why: string }[];
}

export default function KnowledgeCheck({ lessonId, questions }: { lessonId: string; questions: Q[] }) {
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const complete = questions.every((q) => answers[q.id] !== undefined);

  function submit() {
    setError("");
    start(async () => {
      try {
        setResult(await submitCheck(lessonId, answers));
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <div>
      {questions.map((q, i) => {
        const r = result?.perQuestion.find((p) => p.id === q.id);
        return (
          <div key={q.id} className={`q ${r ? (r.correct ? "correct" : "wrong") : ""}`}>
            <strong>{i + 1}. {q.question}</strong>
            {q.options.map((o, idx) => (
              <label className="opt" key={idx}>
                <input
                  type="radio"
                  name={q.id}
                  disabled={!!result}
                  checked={answers[q.id] === idx}
                  onChange={() => setAnswers({ ...answers, [q.id]: idx })}
                />
                <span>{o}</span>
              </label>
            ))}
            {r && <p className="muted">{r.correct ? "Correct. " : "Not quite. "}{r.why}</p>}
          </div>
        );
      })}
      {error && <div className="notice err">{error}</div>}
      {result ? (
        <div className={`notice ${result.passed ? "ok" : "warn"}`}>
          Score {result.correct}/{result.total} ({Math.round(result.score * 100)}%).{" "}
          {result.passed
            ? "Passed: evidence recorded and XP awarded."
            : `Below the ${Math.round(result.passMark * 100)}% pass mark. Re-read the guide and try again later; the attempt is recorded.`}{" "}
          {!result.passed && <button onClick={() => { setResult(null); setAnswers({}); }}>Retry</button>}
        </div>
      ) : (
        <button disabled={!complete || pending} onClick={submit}>
          {pending ? "Scoring…" : "Submit answers"}
        </button>
      )}
    </div>
  );
}
