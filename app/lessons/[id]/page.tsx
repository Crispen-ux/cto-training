import Link from "next/link";
import { notFound } from "next/navigation";
import KnowledgeCheck from "@/components/KnowledgeCheck";
import Tutor from "@/components/Tutor";
import BuildFeedback from "@/components/BuildFeedback";
import DefenceSession from "@/components/DefenceSession";
import { aiStatus } from "@/lib/ai";
import { getLesson, type SourceCategory } from "@/lib/content";
import { lessonStatus } from "@/lib/dashboard";
import { readState } from "@/lib/store";
import { submitWork } from "@/app/actions";

export const dynamic = "force-dynamic";

function Cat({ c }: { c: SourceCategory }) {
  const cls = c === "Official CTO Framework" ? "official" : c.startsWith("Original") ? "original" : "";
  return <span className={`badge ${cls}`}>{c}</span>;
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mode?: string; error?: string; ok?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  const ai = aiStatus();
  const mode = sp.mode === "build" || sp.mode === "defend" ? sp.mode : "learn";

  const state = readState();
  const st = lessonStatus(lesson, state.evidence, state.submissions);
  const mine = state.submissions.filter((s) => s.lessonId === id);
  const evidence = state.evidence.filter((e) => e.lessonId === id);

  if (!st.unlocked) {
    return (
      <>
        <h1>{lesson.title}</h1>
        <div className="notice warn">
          <strong>Locked.</strong> Unlocks from demonstrated prerequisites:
          <ul className="tight">{st.lockReasons.map((r) => <li key={r}>{r}</li>)}</ul>
        </div>
        <Link href="/">Back to dashboard</Link>
      </>
    );
  }

  const tab = (m: string, label: string) => (
    <Link href={`/lessons/${id}?mode=${m}`} className={mode === m ? "active" : ""}>{label}</Link>
  );

  return (
    <>
      <span className="badge">{lesson.pillar}</span>
      <h1>{lesson.title}</h1>
      <div className="row">
        {[...new Set(lesson.sources.map((s) => s.category))].map((c) => <Cat key={c} c={c} />)}
        <span className="muted">
          ~{lesson.estimatedMinutes.learn} / {lesson.estimatedMinutes.build} / {lesson.estimatedMinutes.defend} min (learn / build / defend)
        </span>
      </div>

      <div className="tabs">
        {tab("learn", `Learn ${st.checkPassed ? "✓" : ""}`)}
        {tab("build", `Build ${st.buildPassed ? "✓" : ""}`)}
        {tab("defend", `Defend ${st.defencePassed ? "✓" : ""}`)}
      </div>

      {sp.error && <div className="notice err">{sp.error}</div>}
      {sp.ok && <div className="notice ok">{sp.ok}</div>}

      {mode === "learn" && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Objectives</h3>
            <ul className="tight">{lesson.objectives.map((o) => <li key={o}>{o}</li>)}</ul>
            <h3>Official source (read this first)</h3>
            <ul className="tight">
              {lesson.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noreferrer">{s.title}</a> <Cat c={s.category} />
                  <div className="muted" style={{ fontSize: 13 }}>Reviewed {s.reviewed}. {s.reviewDepth}</div>
                </li>
              ))}
            </ul>
            <div className="notice warn">
              <strong>Requires verification</strong>
              <ul className="tight">{lesson.verificationNotes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          </div>

          {lesson.learn.sections.map((sec) => (
            <div className="card" key={sec.heading} style={{ marginTop: 14 }}>
              <h3 style={{ marginTop: 0 }}>{sec.heading} <Cat c={sec.sourceCategory} /></h3>
              {sec.body.split("\n\n").map((p, i) => <p key={i} style={{ whiteSpace: "pre-line" }}>{p}</p>)}
            </div>
          ))}

          <div className="card" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Worked example: {lesson.learn.workedExample.title} <Cat c={lesson.learn.workedExample.sourceCategory} /></h3>
            <p>{lesson.learn.workedExample.body}</p>
          </div>

          <div className="card" style={{ marginTop: 14 }}>
            <h3 style={{ marginTop: 0 }}>Common mistakes</h3>
            <ul className="tight">{lesson.learn.misconceptions.map((m) => <li key={m}>{m}</li>)}</ul>
            <h3>Explanation task</h3>
            <p>{lesson.learn.explainTask}</p>
            <p className="muted">Practise this aloud or in writing; you will be asked something similar in the Defend step.</p>
          </div>

          <h2>Ask the tutor</h2>
          <Tutor lessonId={id} configured={ai.configured} mock={ai.mock} />

          {lesson.knowledgeCheck.length > 0 ? (
            <>
              <h2>Knowledge check</h2>
              {st.checkPassed ? (
                <div className="notice ok">Passed. Move on to <Link href={`/lessons/${id}?mode=build`}>Build</Link>.</div>
              ) : (
                <KnowledgeCheck
                  lessonId={id}
                  questions={lesson.knowledgeCheck.map(({ id: qid, question, options }) => ({ id: qid, question, options }))}
                />
              )}
            </>
          ) : (
            <div className="notice">
              <strong>No knowledge check for this lesson.</strong> It is imported study material, so no quiz was
              generated and nothing is invented on your behalf. You are evidenced by the written work and the
              defence instead. Move on to <Link href={`/lessons/${id}?mode=build`}>Build</Link>.
            </div>
          )}
        </>
      )}

      {mode === "build" && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Business problem</h3>
            <p>{lesson.build.business}</p>
            <p><strong>{lesson.build.problem}</strong></p>
            <h3>Requirements</h3>
            <ul className="tight">{lesson.build.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            <h3>Constraints</h3>
            <ul className="tight">{lesson.build.constraints.map((r) => <li key={r}>{r}</li>)}</ul>
            <h3>Design</h3>
            <p>{lesson.build.design}</p>
            <h3>Tasks</h3>
            <ul className="tight">{lesson.build.tasks.map((r) => <li key={r}>{r}</li>)}</ul>
            <h3>Acceptance criteria</h3>
            <ul className="tight">{lesson.build.acceptance.map((r) => <li key={r}>{r}</li>)}</ul>
            <h3>Deliverable</h3>
            <p>{lesson.build.deliverable}</p>
          </div>

          {st.checkPassed && <BuildFeedback lessonId={id} configured={ai.configured} />}

          <h2>Submit your deliverable</h2>
          {!st.checkPassed ? (
            <div className="notice warn">Pass the knowledge check first.</div>
          ) : (
            <form action={submitWork} className="card">
              <input type="hidden" name="lessonId" value={id} />
              <input type="hidden" name="mode" value="build" />
              <label htmlFor="artifactRef">Artifact reference (repo URL, path or document link)</label>
              <input id="artifactRef" name="artifactRef" type="text" required />
              <label htmlFor="dataLabel">Data used</label>
              <select id="dataLabel" name="dataLabel" required defaultValue="">
                <option value="" disabled>Choose…</option>
                <option value="REAL">REAL (from actual systems)</option>
                <option value="SIMULATED">SIMULATED (clearly labelled)</option>
              </select>
              <label htmlFor="content">What you built, how it meets each acceptance criterion, and known gaps</label>
              <textarea id="content" name="content" required />
              <p className="muted">A reviewer scores this against the acceptance criteria. Running code is not enough on its own.</p>
              <button type="submit">Submit for review</button>
            </form>
          )}
        </>
      )}

      {mode === "defend" && (
        <>
          <div className="card">
            <span className="badge">Assessor: {lesson.defend.assessor}</span>
            <p>{lesson.defend.scenario}</p>
            <h3>Questions you must answer</h3>
            <ol className="tight">{lesson.defend.prompts.map((p) => <li key={p}>{p}</li>)}</ol>
            <h3>Scored on</h3>
            <ul className="tight">
              {lesson.defend.rubric.map((r) => <li key={r.criterion}>{r.criterion} ({Math.round(r.weight * 100)}%)</li>)}
            </ul>
          </div>

          <h2>Submit your defence</h2>
          {!mine.some((s) => s.kind === "artifact") ? (
            <div className="notice warn">Submit your build deliverable first.</div>
          ) : (
            <>
            {ai.configured ? (
              <DefenceSession lessonId={id} assessor={lesson.defend.assessor} mock={ai.mock} />
            ) : (
              <div className="notice warn"><strong>AI assessor is off.</strong> No AI provider is configured on the server, so only the written route below is available.</div>
            )}
            <h3>Or submit a written defence for a human reviewer</h3>
            <form action={submitWork} className="card">
              <input type="hidden" name="lessonId" value={id} />
              <input type="hidden" name="mode" value="defend" />
              <label htmlFor="content">Your answers to each question, with the evidence you rely on</label>
              <textarea id="content" name="content" required style={{ minHeight: 260 }} />
              <p className="muted">
                A person scores this against the rubric. It does not go to the AI assessor.
              </p>
              <button type="submit">Submit defence</button>
            </form>
            </>
          )}
        </>
      )}

      {(mine.length > 0 || evidence.length > 0) && (
        <>
          <h2>Your record for this lesson</h2>
          <div className="card">
            <table>
              <thead><tr><th>When</th><th>Type</th><th>Result</th></tr></thead>
              <tbody>
                {evidence.map((e) => (
                  <tr key={e.id}>
                    <td>{e.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{e.type.replace("_", " ")}</td>
                    <td>{Math.round(e.score * 100)}% {e.passed ? "passed" : "not passed"} · {e.assessedBy}{e.needsHumanReview ? " · flagged for review" : ""}</td>
                  </tr>
                ))}
                {mine.filter((s) => s.status === "pending").map((s) => (
                  <tr key={s.id}>
                    <td>{s.createdAt.slice(0, 16).replace("T", " ")}</td>
                    <td>{s.kind}</td>
                    <td>Awaiting review</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
