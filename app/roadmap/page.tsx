import Link from "next/link";
import { loadRoadmap, getLesson } from "@/lib/content";

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
            <h2 id={p.id}>
              {p.title} <span className="badge">{p.monthEstimate}</span>
              <span className="badge">{p.status.replace("_", " ")}</span>
            </h2>
            {mods.length === 0 ? (
              <p className="muted">No modules mapped yet.</p>
            ) : (
              <div className="grid cols3">
                {mods.map((m) => {
                  const first = m.lessons.find((id) => getLesson(id));
                  return (
                    <div className="card" key={m.id} id={m.id}>
                      <span className="badge">{m.pillar}</span>
                      <span className={`badge ${m.status === "available" ? "good" : ""}`}>{m.status}</span>
                      <h3>
                        {first ? (
                          <Link href={`/lessons/${first}`}>{m.title}</Link>
                        ) : (
                          m.title
                        )}
                      </h3>
                      <p className="muted" style={{ fontSize: 13 }}>
                        {m.registerPaths.length} official guides in the source register
                      </p>
                      {m.lessons.length > 0 ? (
                        <ul className="tight">
                          {m.lessons.map((id) => {
                            const lesson = getLesson(id);
                            return (
                              <li key={id}>
                                {lesson ? (
                                  <Link href={`/lessons/${id}`}>{lesson.title}</Link>
                                ) : (
                                  <span className="muted">{id} (content pending)</span>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="muted" style={{ fontSize: 13 }}>
                          Lesson content is written after the guides are read in full.
                        </p>
                      )}
                    </div>
                  );
                })}
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

