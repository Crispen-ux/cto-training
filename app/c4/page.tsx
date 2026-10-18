import Link from "next/link";
import { listProjects } from "@/lib/architecture/store";
import { allDiagrams } from "@/lib/architecture/report";
import { C4_SOURCES } from "@/lib/architecture/svg";
import ProjectPicker from "@/components/ProjectPicker";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function C4Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const sp = await searchParams;
  const projects = listProjects();
  const p = projects.find((x) => x.id === sp.id) ?? projects[0];
  const diagrams = p ? allDiagrams(p) : [];

  return (
    <>
      <h1>C4 diagrams</h1>
      <p className="muted">
        Diagrams are generated from the architecture model, so they always match the latest data.
        Notation follows <a href="https://c4model.com/diagrams" target="_blank" rel="noreferrer">c4model.com</a>.
      </p>

      {projects.length === 0 ? (
        <div className="card">No architecture projects yet. <Link href="/architecture">Create one</Link>.</div>
      ) : (
        <>
          <div className="card">
            <ProjectPicker projects={projects.map((x) => ({ id: x.id, name: x.name }))} current={p?.id} />
            {p && (
              <p>
                <a className="btn" href={`/architecture/export?format=svg&id=${p.id}`}>Download all diagrams (SVG)</a>{" "}
                <a className="btn ghost" href={`/architecture/export?format=md&id=${p.id}`}>Report (Markdown)</a>{" "}
                <a className="btn ghost" href={`/architecture/export?format=json&id=${p.id}`}>Model (JSON)</a>{" "}
                <PrintButton id={p.id} label="Export PDF" />{" "}
                <a className="btn ghost" href={`/architecture/wizard?step=containers&id=${p.id}`}>Edit the model</a>
              </p>
            )}
          </div>

          {p && diagrams.length === 0 && <div className="card">No diagrams to show yet.</div>}

          {diagrams.map((d) => (
            <div className="card" key={d.title} style={{ marginBottom: 16 }}>
              <h2>{d.title} <span className="muted" style={{ fontSize: 13 }}>({d.source})</span></h2>
              <div className="preview-frame" dangerouslySetInnerHTML={{ __html: d.svg }} />
              <p className="muted">{d.caption}</p>
              {p && (
                <p>
                  <a className="btn ghost" href={`/architecture/export?format=svg-one&level=${encodeURIComponent(d.source)}&id=${p.id}`}>Download this diagram (SVG)</a>
                </p>
              )}
            </div>
          ))}

          <div className="card">
            <h2>Notation sources</h2>
            <ul className="tight">
              {C4_SOURCES.map((s) => <li key={s.page}><a href={s.page} target="_blank" rel="noreferrer">{s.page}</a> &mdash; {s.note}</li>)}
            </ul>
            <p className="muted">
              Sample content in this app is original and not taken from the c4model.com examples. The C4 model and notation are
              the work of Simon Brown; see <a href="https://c4model.com/" target="_blank" rel="noreferrer">c4model.com</a>.
            </p>
          </div>
        </>
      )}

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
