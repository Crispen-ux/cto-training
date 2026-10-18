import Link from "next/link";
import { loadLessons, getLesson } from "@/lib/content";
import { DIAGNOSTIC_RULES, band, buildDiagnostic, guessChance, publicItems, selfGap, wilson } from "@/lib/diagnostic";
import { lessonStatus } from "@/lib/dashboard";
import { PILLARS } from "@/lib/engine";
import { readState, today } from "@/lib/store";
import { submitDiagnostic } from "@/app/actions";

export const dynamic = "force-dynamic";

const pc = (x: number) => `${Math.round(x * 100)}%`;
const BAND_TEXT = { strong: "strong on this sample", mixed: "mixed on this sample", weak: "weak on this sample" } as const;

export default async function Diagnostic({
  searchParams,
}: {
  searchParams: Promise<{ retake?: string; error?: string; ok?: string }>;
}) {
  const sp = await searchParams;
  const state = readState();
  const attempts = state.diagnostics;
  const takenToday = attempts.filter((a) => a.takenAt.slice(0, 10) === today()).length >= DIAGNOSTIC_RULES.maxPerDay;
  const showForm = (attempts.length === 0 || sp.retake === "1") && !takenToday;
  const lessons = loadLessons();

  const notice = (
    <div className="notice warn">
      <strong>This is a baseline, not an assessment of competence.</strong> It samples {DIAGNOSTIC_RULES.perPillar} knowledge-check questions per
      pillar. It awards no XP, unlocks no lessons and counts toward no competency level: those come only from reviewed or auto-scored evidence in the
      lessons. With so few questions each result is rough, and the page shows how rough.
    </div>
  );

  if (showForm) {
    const seed = Math.floor(Math.random() * 2 ** 31);
    const items = publicItems(buildDiagnostic(lessons, seed));
    return (
      <>
        <h1>Entry baseline</h1>
        {notice}
        {sp.error && <div className="notice err">{sp.error}</div>}
        <p className="muted">
          About {items.length} questions, 15 to 25 minutes, no looking things up. Correct answers are never shown, so the lesson knowledge checks stay fresh.
          Rate yourself first if you like: it lets the results show how well your self-view matches the sample.
        </p>
        <form action={submitDiagnostic}>
          <input type="hidden" name="seed" value={seed} />
          {PILLARS.map((pillar) => (
            <div className="card" key={pillar} style={{ marginTop: 14 }}>
              <h2 style={{ marginTop: 0 }}>{pillar}</h2>
              <label htmlFor={`self-${pillar}`}>How would you rate yourself in {pillar}? (optional)</label>
              <select id={`self-${pillar}`} name={`self:${pillar}`} defaultValue="">
                <option value="">No rating</option>
                <option value="1">1: new to it</option>
                <option value="2">2: some knowledge</option>
                <option value="3">3: working knowledge</option>
                <option value="4">4: strong</option>
                <option value="5">5: expert</option>
              </select>
              {items.filter((i) => i.pillar === pillar).map((it, n) => (
                <fieldset key={it.id} className="q" style={{ border: 0, padding: 0, margin: "14px 0 0" }}>
                  <legend><strong>{n + 1}. {it.question}</strong></legend>
                  {it.options.map((o, idx) => (
                    <label className="opt" key={idx}>
                      <input type="radio" name={`a:${it.id}`} value={idx} required />
                      <span>{o}</span>
                    </label>
                  ))}
                </fieldset>
              ))}
            </div>
          ))}
          <p><button type="submit">Record my baseline</button></p>
        </form>
      </>
    );
  }

  if (attempts.length === 0) {
    return (
      <>
        <h1>Entry baseline</h1>
        {notice}
        <p>You have already taken a diagnostic today. Try again tomorrow.</p>
      </>
    );
  }

  const latest = attempts[attempts.length - 1];
  const first = attempts[0];
  const optionCounts = (seed: number) => {
    const m: Record<string, number[]> = {};
    for (const it of buildDiagnostic(lessons, seed)) (m[it.pillar] ??= []).push(it.options.length);
    return m;
  };
  const counts = optionCounts(latest.seed);

  const ranked = [...latest.results].sort((a, b) => a.correct / a.total - b.correct / b.total);
  const missed = ranked.flatMap((r) => r.missedLessonIds);
  const rows = [...new Set(missed)]
    .map((id) => getLesson(id))
    .filter((l): l is NonNullable<typeof l> => !!l)
    .map((l) => ({ l, st: lessonStatus(l, state.evidence, state.submissions) }));
  // Lessons you can open now come first; the list is capped so it stays readable.
  const ordered = [...rows.filter((r) => r.st.unlocked), ...rows.filter((r) => !r.st.unlocked)];
  const shown = ordered.slice(0, 8);

  return (
    <>
      <h1>Entry baseline</h1>
      {notice}
      {sp.ok && <div className="notice ok">{sp.ok}</div>}
      {sp.error && <div className="notice err">{sp.error}</div>}
      <p className="muted">
        Latest attempt {latest.takenAt.slice(0, 16).replace("T", " ")}
        {attempts.length > 1 && <> · baseline (first attempt) {first.takenAt.slice(0, 10)}</>}
      </p>

      <div className="card">
        <table>
          <thead>
            <tr><th>Pillar</th><th>Score</th><th>95% interval for what you would score on all questions</th><th>Chance by guessing alone</th><th>Reading</th><th>Self-rating</th></tr>
          </thead>
          <tbody>
            {latest.results.map((r) => {
              const [lo, hi] = wilson(r.correct, r.total);
              const chance = guessChance(counts[r.pillar] ?? Array(r.total).fill(4), r.correct);
              const gap = selfGap(latest.selfRatings[r.pillar], r.correct, r.total);
              return (
                <tr key={r.pillar}>
                  <td>{r.pillar}</td>
                  <td>{r.correct}/{r.total}</td>
                  <td>{pc(lo)} to {pc(hi)}</td>
                  <td>{chance < 0.001 ? "under 0.1%" : pc(chance)}</td>
                  <td>{BAND_TEXT[band(r.correct, r.total)]}</td>
                  <td>{latest.selfRatings[r.pillar] ? `${latest.selfRatings[r.pillar]}/5: ${gap}` : "not rated"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="muted">
          The intervals are wide because the samples are small: a score of 5/6 is compatible with anything from about 44% to 97%. Read these as a starting hint, not a level.
          A self-rating gap is a prompt to check yourself, not a finding.
        </p>
      </div>

      {attempts.length > 1 && (
        <>
          <h2>Baseline against latest</h2>
          <div className="card">
            <table>
              <thead><tr><th>Pillar</th><th>Baseline (first attempt)</th><th>Latest</th></tr></thead>
              <tbody>
                {latest.results.map((r) => {
                  const f = first.results.find((x) => x.pillar === r.pillar);
                  return <tr key={r.pillar}><td>{r.pillar}</td><td>{f ? `${f.correct}/${f.total}` : "–"}</td><td>{r.correct}/{r.total}</td></tr>;
                })}
              </tbody>
            </table>
            <p className="muted">Different attempts sample different questions, so small changes are noise.</p>
          </div>
        </>
      )}

      <h2>Where to start</h2>
      {rows.length === 0 ? (
        <p>You answered every sampled question correctly. Start from the first lesson on the roadmap and pass knowledge checks quickly to move through the prerequisites.</p>
      ) : (
        <div className="card">
          <p className="muted">
            Lessons whose sampled question you missed: ones you can open now first, then locked ones, weakest pillar first within each. Opening a lesson is free, but a lesson unlocks only when its prerequisite lessons have passed
            knowledge checks. That is how you skip ahead: pass those checks. The diagnostic does not unlock anything.
          </p>
          <ul className="tight">
            {shown.map(({ l, st }) => (
              <li key={l.id}>
                {st.unlocked ? <Link href={`/lessons/${l.id}`}>{l.title}</Link> : l.title} <span className="badge">{l.pillar}</span>{" "}
                {!st.unlocked && <span className="muted">locked: {st.lockReasons.join("; ")}</span>}
              </li>
            ))}
          </ul>
          {ordered.length > shown.length && <p className="muted">and {ordered.length - shown.length} more. Retake the baseline later, or open the roadmap for the full list.</p>}
        </div>
      )}

      <p style={{ marginTop: 16 }}>
        {takenToday ? <span className="muted">You can retake the baseline tomorrow.</span> : <Link className="btn" href="/diagnostic?retake=1">Retake the baseline</Link>}
      </p>
    </>
  );
}
