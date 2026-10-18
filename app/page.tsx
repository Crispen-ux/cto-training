import Link from "next/link";
import { orderedLessons } from "@/lib/content";
import { buildDashboard } from "@/lib/dashboard";
import { readState } from "@/lib/store";
import { MASTERY_LABELS } from "@/lib/engine";

export const dynamic = "force-dynamic";

export default function Dashboard() {
  const state = readState();
  const today = new Date().toISOString().slice(0, 10);
  const d = buildDashboard(orderedLessons(), state, today);
  const pct = d.level.xpForNext ? Math.round((d.level.xpIntoLevel / d.level.xpForNext) * 100) : 100;
  const s = state.settings.schedule;

  return (
    <>
      <h1>Today</h1>
      <p className="muted">
        Learn the framework. Build real systems. Defend your decisions. Prove your competence.
      </p>

      {d.mission ? (
        <div className="card mission">
          <span className="badge">{d.mission.step.toUpperCase()}</span>
          <span className="badge">{d.mission.minutes} min</span>
          <h2 style={{ margin: "8px 0" }}>{d.mission.lessonTitle}</h2>
          <p>{d.mission.headline}</p>
          {d.mission.awaitingReview && (
            <div className="notice warn">
              Waiting for review. Nothing is credited until a reviewer scores it.{" "}
              <Link href="/review">Open reviews</Link>
            </div>
          )}
          <h3>Evidence required</h3>
          <ul className="tight">
            {d.mission.evidenceRequired.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
          <p>
            <Link className="btn" href={`/lessons/${d.mission.lessonId}?mode=${d.mission.step}`}>
              Open mission
            </Link>
          </p>
        </div>
      ) : (
        <div className="card">All available lessons are complete. See the roadmap for what is planned next.</div>
      )}

      <p className="muted">Recommended next action: {d.recommended}</p>

      <p><Link className="btn" href="/capability">Capability assessment and gap analysis</Link></p>
      <p><Link className="btn" href="/mentor">Mentor workspace</Link></p>

      {state.diagnostics.length === 0 && (
        <div className="notice warn">
          <strong>No entry baseline yet.</strong> A 30-question diagnostic shows where to start and gives you something to measure progress against.
          It awards no XP and is not evidence. <Link href="/diagnostic">Take the baseline</Link>
        </div>
      )}

      <div className="grid cols3" style={{ marginTop: 16 }}>
        <div className="card">
          <div className="muted">Level</div>
          <div className="big">{d.level.level}</div>
          <div className="muted">
            {d.xp.total} XP{d.level.xpForNext ? ` · ${d.level.xpIntoLevel}/${d.level.xpForNext} to next` : ""}
          </div>
          <div className="bar"><span style={{ width: `${pct}%` }} /></div>
          <p className="muted" style={{ fontSize: 13 }}>XP is only awarded for reviewed or auto-scored evidence.</p>
        </div>
        <div className="card">
          <div className="muted">Consistency</div>
          <div className="big">{d.streak.current} days</div>
          <div className="muted">Longest {d.streak.longest}. One missed day is forgiven.</div>
        </div>
        <div className="card">
          <div className="muted">Progress</div>
          <div className="big">{d.lessonsDone}/{d.lessonsTotal}</div>
          <div className="muted">lessons complete · {d.pendingReviews} awaiting review</div>
        </div>
      </div>

      <h2>Competency by pillar</h2>
      <p className="muted">Academy levels 0 to 5, from evidence only. Not official CTO Framework levels. The baseline sample, if you took one, is shown for comparison and is not part of the level.</p>
      <div className="grid cols5">
        {d.competencies.map((c) => (
          <div className="card" key={c.pillar}>
            <strong>{c.pillar}</strong>
            <div className="big">L{c.level}</div>
            <div className="muted" style={{ fontSize: 13 }}>{MASTERY_LABELS[c.level]}</div>
            {state.diagnostics[0] && (
              <p className="muted" style={{ fontSize: 13 }}>
                Baseline sample: {(() => { const r = state.diagnostics[0].results.find((x) => x.pillar === c.pillar); return r ? `${r.correct}/${r.total}` : "–"; })()}
              </p>
            )}
            {c.next && (
              <p style={{ fontSize: 13 }}>
                <span className="muted">Next (L{c.next.level}):</span> {c.next.label}
              </p>
            )}
          </div>
        ))}
      </div>

      <h2>Lessons</h2>
      <div className="card">
        <table>
          <thead>
            <tr><th>Lesson</th><th>Check</th><th>Build</th><th>Defend</th><th>Status</th></tr>
          </thead>
          <tbody>
            {d.statuses.map((st) => (
              <tr key={st.lesson.id}>
                <td>
                  {st.unlocked ? <Link href={`/lessons/${st.lesson.id}`}>{st.lesson.title}</Link> : st.lesson.title}
                </td>
                <td>{st.checkPassed ? "✓" : "–"}</td>
                <td>{st.buildPassed ? "✓" : st.pendingBuild ? "review" : "–"}</td>
                <td>{st.defencePassed ? "✓" : st.pendingDefence ? "review" : "–"}</td>
                <td>
                  {st.unlocked ? (
                    st.nextStep === "done" ? "Complete" : `Next: ${st.nextStep}`
                  ) : (
                    <span className="muted">Locked: {st.lockReasons.join("; ")}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted" style={{ marginTop: 16 }}>
        Daily plan: {s.framework} min official framework, {s.fundamentals} min fundamentals, {s.project} min project,{" "}
        {s.assessment} min assessment. <Link href="/settings">Change</Link>
      </p>
    </>
  );
}
