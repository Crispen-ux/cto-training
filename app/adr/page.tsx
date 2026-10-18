import Link from "next/link";
import { listProjects } from "@/lib/architecture/store";
import { adrsToMarkdown, adrToMarkdown } from "@/lib/architecture/report";
import { adrRules } from "@/lib/architecture/validation";
import ProjectPicker from "@/components/ProjectPicker";

export const dynamic = "force-dynamic";

export default async function AdrPage({ searchParams }: { searchParams: Promise<{ id?: string; error?: string }> }) {
  const sp = await searchParams;
  const projects = listProjects();
  const selected = projects.find((p) => p.id === sp.id) ?? projects[0];
  const adrs = selected?.adrs ?? [];

  return (
    <>
      <h1>ADR generator</h1>
      <p className="muted">
        MADR-style architecture decision records, numbered automatically and stored with the project.
        ADRs are created from the <Link href={`/architecture/wizard?step=decisions&id=${selected?.id ?? ""}`}>architecture report wizard</Link> so decisions stay linked to the elements they affect.
      </p>
      {sp.error && <div className="notice warn">{sp.error}</div>}

      {projects.length === 0 ? (
        <div className="card">No architecture projects yet. <Link href="/architecture">Create one</Link>.</div>
      ) : (
        <>
          <div className="card">
            <ProjectPicker projects={projects.map((x) => ({ id: x.id, name: x.name }))} current={selected?.id} />
            {selected && (
              <p>
                <a className="btn" href={`/architecture/export?format=adrs&id=${selected.id}`}>Download all ADRs (Markdown)</a>{" "}
                <a className="btn ghost" href={`/architecture/wizard?step=decisions&id=${selected.id}`}>Create a decision</a>
              </p>
            )}
          </div>

          <div className="card">
            <h2>Decisions</h2>
            {adrs.length === 0 ? <p className="muted">No decisions recorded yet.</p> : (
              <table>
                <thead><tr><th>ADR</th><th>Title</th><th>Status</th><th>Date</th><th>Actions</th></tr></thead>
                <tbody>
                  {adrs.map((a) => (
                    <tr key={a.id}>
                      <td>ADR-{String(a.number).padStart(4, "0")}</td>
                      <td>{a.title}</td>
                      <td>{a.status}{a.aiDrafted ? " (AI draft)" : ""}</td>
                      <td>{a.date || "not recorded"}</td>
                      <td>
                        <a className="btn ghost" href={`/architecture/export?format=adrs&id=${selected?.id}`}>Export all</a>
                      </td>                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p><a className="btn" href={`/architecture/wizard?step=decisions&id=${selected?.id}`}>Create a decision</a></p>
          </div>
          {adrs.map((a) => {
            const issues = adrRules(a);
            return (
              <div className="card" key={a.id}>
                <h2>ADR-{String(a.number).padStart(4, "0")}: {a.title}</h2>
                {issues.length > 0 && (
                  <div className="notice warn">
                    <strong>Not ready to accept:</strong>
                    <ul className="tight">{issues.map((i, n) => <li key={n}>{i.message}</li>)}</ul>
                  </div>
                )}
                <pre className="work">{adrToMarkdown(a)}</pre>
              </div>
            );
          })}

          {selected && (
            <p><a className="btn" href={`/architecture/export?format=adrs&id=${selected.id}`}>Download all ADRs (Markdown)</a></p>
          )}
        </>
      )}

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
