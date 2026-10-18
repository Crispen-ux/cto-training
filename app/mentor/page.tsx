import Link from "next/link";
import { readState } from "@/lib/store";
import { loadPersonas, MENTOR_MODES } from "@/lib/mentor";
import { sendMentorMessage } from "../mentor-actions";

export const dynamic = "force-dynamic";

const TRACKS = ["Solutions Architect", "AI Solutions Architect", "CTO / Technology Strategist"];

export default function MentorPage({ searchParams }: { searchParams?: Record<string, string> }) {
  const personas = loadPersonas();
  const personaId = searchParams?.personaId ?? personas[0]?.id;
  const mode = searchParams?.mode ?? "learn";
  const objective = searchParams?.objective ?? "";
  const track = searchParams?.track ?? "Solutions Architect";
  const sessionId = searchParams?.sessionId ?? "";
  const state = readState();
  const session = sessionId ? state.mentorSessions.find((s) => s.id === sessionId) : undefined;

  return (
    <>
      <h1>Mentor workspace</h1>
      <p className="muted">AI-assisted mentoring. Feedback is simulated coaching, not accreditation.</p>
      {searchParams?.error && <div className="notice warn">{searchParams.error}</div>}

      <div className="card" style={{ marginBottom: 16 }}>
        <form method="get" action="/mentor">
          <label>Persona</label>
          <select name="personaId" defaultValue={personaId}>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <label style={{ marginLeft: 8 }}>Mode</label>
          <select name="mode" defaultValue={mode}>
            {MENTOR_MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
          <label style={{ marginLeft: 8 }}>Track</label>
          <select name="track" defaultValue={track}>
            {TRACKS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <div style={{ marginTop: 8 }}>
            <label>Session objective</label>
            <input name="objective" defaultValue={objective} style={{ width: "100%" }} />
          </div>
          <input type="hidden" name="sessionId" value={sessionId} />
          <p style={{ marginTop: 8 }}><button className="btn" type="submit">Apply settings</button></p>
        </form>
      </div>

      {session && (
        <div className="card" style={{ marginBottom: 16 }}>
          <h2>Session history</h2>
          {session.messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <strong>{m.role === "user" ? "You" : "Mentor"}:</strong>
              <p style={{ whiteSpace: "pre-wrap" }}>{m.text}</p>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <form action={sendMentorMessage}>
          <input type="hidden" name="personaId" value={personaId} />
          <input type="hidden" name="mode" value={mode} />
          <input type="hidden" name="objective" value={objective} />
          <input type="hidden" name="track" value={track} />
          <input type="hidden" name="sessionId" value={sessionId} />
          <label>Your message</label>
          <textarea name="message" rows={4} style={{ width: "100%" }} />
          <p style={{ marginTop: 8 }}><button className="btn" type="submit">Send</button></p>
        </form>
      </div>

      <p style={{ marginTop: 16 }}><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
