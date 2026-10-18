import Link from "next/link";
import { loadRoadmap } from "@/lib/content";

export default function Roadmap() {
  const r = loadRoadmap();
  return (
    <>
      <h1>Roadmap</h1>
      <p className="muted">{r.note}</p>
      {r.phases.map((p) => {
        const mods = r.modules.filter((m) => m.phase === p.id);
        return (
          <div key={p.id}>
            <h2>
              {p.title} <span className="badge">{p.monthEstimate}</span>
              <span className="badge">{p.status.replace("_", " ")}</span>
            </h2>
            {mods.length === 0 ? (
              <p className="muted">No modules mapped yet.</p>
            ) : (
              <div className="grid cols3">
                {mods.map((m) => (
                  <div className="card" key={m.id}>
                    <span className="badge">{m.pillar}</span>
                    <span className={`badge ${m.status === "available" ? "good" : ""}`}>{m.status}</span>
                    <h3>{m.title}</h3>
                    <p className="muted" style={{ fontSize: 13 }}>
                      {m.registerPaths.length} official guides in the source register
                    </p>
                    {m.lessons.length > 0 ? (
                      <ul className="tight">
                        {m.lessons.map((id) => (
                          <li key={id}><Link href={`/lessons/${id}`}>{id}</Link></li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted" style={{ fontSize: 13 }}>
                        Lesson content is written after the guides are read in full.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <p className="muted" style={{ marginTop: 24 }}>
        The entry assessment (competency baseline) is planned for the next build step.
      </p>
    </>
  );
}
