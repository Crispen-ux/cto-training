import Link from "next/link";
import { readState } from "@/lib/store";
import { loadCompetencies } from "@/lib/capability";
import { capabilityDashboard } from "@/lib/capability";
import { submitCapabilityAssessment } from "../capability-actions";

export const dynamic = "force-dynamic";

const TRACKS = ["Solutions Architect", "AI Solutions Architect", "CTO / Technology Strategist"] as const;

export default function CapabilityPage({ searchParams }: { searchParams?: { track?: string; ok?: string; error?: string } }) {
  const state = readState();
  const track = (TRACKS.includes(searchParams?.track as any) ? searchParams?.track : "Solutions Architect") as (typeof TRACKS)[number];
  const dashboard = capabilityDashboard(state.capabilityAssessments, track, state.evidence);
  const comps = loadCompetencies().filter((c) => c.tracks.includes(track === "Solutions Architect" ? "SA" : track === "AI Solutions Architect" ? "AISA" : "CTO"));

  return (
    <>
      <h1>Capability assessment and gap analysis</h1>
      <p className="muted">Evidence-backed proficiency across three career tracks. Unassessed competencies are not treated as zero.</p>
      {searchParams?.ok && <div className="notice ok">{searchParams.ok}</div>}
      {searchParams?.error && <div className="notice warn">{searchParams.error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="get" action="/capability">
          <label>Track</label>
          <select name="track" defaultValue={track}>
            {TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn" type="submit" style={{ marginLeft: 8 }}>View</button>
        </form>
      </div>

      <div className="grid cols4" style={{ marginBottom: 16 }}>
        <div className="card"><div className="muted">Competencies</div><div className="big">{dashboard.total}</div></div>
        <div className="card">
          <div className="muted">From reviewed evidence</div>
          <div className="big">{dashboard.fromEvidence}</div>
          <div className="muted">{dashboard.fromSelf} from self-rating · {dashboard.unassessed} unassessed</div>
        </div>
        <div className="card"><div className="muted">Critical gaps</div><div className="big">{dashboard.critical}</div></div>
        <div className="card"><div className="muted">Coverage</div><div className="big">{dashboard.coverage}%</div></div>
      </div>

      {dashboard.fromEvidence === 0 && (
        <div className="notice warn">
          <strong>Nothing here is evidence-backed yet.</strong> Proving a competency needs reviewed work: pass a
          knowledge check, then submit a reviewed artefact and defend it. A self-rating is recorded separately and is
          never counted as demonstrated ability.
        </div>
      )}

      <h2>Record a baseline assessment</h2>
      <div className="card" style={{ marginBottom: 16 }}>
        <form action={submitCapabilityAssessment}>
          <input type="hidden" name="track" value={track} />
          <label>Competency</label>
          <select name="competencyId">
            {comps.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
          </select>
          <div className="grid cols4" style={{ marginTop: 8 }}>
            <div><label>Knowledge (0-5)</label><input name="knowledge" type="number" min="0" max="5" defaultValue="0" /></div>
            <div><label>Execution (0-5)</label><input name="execution" type="number" min="0" max="5" defaultValue="0" /></div>
            <div><label>Judgement (0-5)</label><input name="judgement" type="number" min="0" max="5" defaultValue="0" /></div>
            <div><label>Communication (0-5)</label><input name="communication" type="number" min="0" max="5" defaultValue="0" /></div>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Evidence reference (optional)</label>
            <input name="evidenceRef" type="text" placeholder="path, link or artifact id" />
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Assessed by</label>
            <select name="assessedBy">
              <option value="self">Self (baseline only)</option>
              <option value="reviewer">Reviewer</option>
              <option value="ai">AI simulated reviewer</option>
            </select>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>Notes</label>
            <textarea name="notes" rows={3} />
          </div>
          <p style={{ marginTop: 8 }}>
            <button className="btn" type="submit">Record assessment</button>
          </p>
          <p className="muted" style={{ fontSize: 12 }}>A self-rating alone does not award mastery. Evidence and review are required for higher status.</p>
        </form>
      </div>

      <h2>Gap analysis and priorities</h2>
      <div className="card">
        <table>
            <thead>
              <tr><th>Competency</th><th>Target</th><th>Demonstrated</th><th>Gap</th><th>Based on</th><th>Status</th></tr>
            </thead>
            <tbody>
              {dashboard.gaps.map((g) => (
                <tr key={g.competencyId}>
                  <td>{g.title}{g.foundation ? " (foundation)" : ""}</td>
                  <td>{g.target}</td>
                  <td>{g.unassessed ? "Unassessed" : g.demonstrated}</td>
                  <td>{g.unassessed ? "-" : g.gap}</td>
                  <td>
                    {g.source === "evidence"
                      ? `${g.evidenceIds.length} reviewed evidence item(s), weakest: ${g.weakestDimension}`
                      : g.source === "self-report"
                        ? "self-rating with a reference"
                        : "nothing yet"}
                    <div className="muted" style={{ fontSize: 12 }}>
                      {g.provenance === "declared"
                        ? `sources: ${g.sourceKinds.join(", ")}${g.specificRubric ? " · competency-specific rubric" : ""}`
                        : "no declared sources yet"}
                    </div>
                  </td>
                  <td>{g.stale ? "Stale" : g.unassessed ? "Unassessed" : g.gap <= 0 ? "Met" : "Gap"}</td>
                </tr>
              ))}
            </tbody>
        </table>
      </div>

      <h2>Prioritised next actions</h2>
      <div className="card">
        <ol>
          {dashboard.priorities.map((p) => (
            <li key={p.competencyId} style={{ marginBottom: 8 }}>
              <strong>{p.title}</strong> (score {p.score})<br />
              <span className="muted">{p.reasons.join(" ")}</span><br />
              <span>{p.gap.recommendedActivity}</span>
            </li>
          ))}
        </ol>
      </div>

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
