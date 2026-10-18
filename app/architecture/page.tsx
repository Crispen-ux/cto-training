import Link from "next/link";
import { listProjects } from "@/lib/architecture/store";
import { createProjectAction, importProjectAction, deleteProjectAction, loadSampleAction } from "../architecture-actions";

export const dynamic = "force-dynamic";

export default async function ArchitectureHome({ searchParams }: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const sp = await searchParams;
  const projects = listProjects();
  return (
    <>
      <h1>Architecture report builder</h1>
      <p className="muted">
        Enter your details once. The model is the source of truth; C4 diagrams, ADRs, the report, Markdown and PDF are all generated from it.
        Diagram notation follows <a href="https://c4model.com/" target="_blank" rel="noreferrer">c4model.com</a>.
      </p>
      {sp.ok && <div className="notice ok">{sp.ok}</div>}
      {sp.error && <div className="notice warn">{sp.error}</div>}

      <div className="grid cols3">
        <div className="card">
          <h2>New project</h2>
          <form action={createProjectAction}>
            <label htmlFor="np">Project name</label>
            <input id="np" name="name" placeholder="e.g. Cretek Ledger" required />
            <p><button className="btn" type="submit">Start</button></p>
          </form>
        </div>
        <div className="card">
          <h2>Explore the sample</h2>
          <p className="muted">A small worked example so you can see the output before entering your own details.</p>
          <form action={loadSampleAction}>
            <button className="btn" type="submit">Create sample project</button>
          </form>
        </div>
        <div className="card">
          <h2>Import JSON</h2>
          <form action={importProjectAction}>
            <label htmlFor="imp">Project JSON</label>
            <textarea id="imp" name="json" placeholder="Paste exported project JSON" required />
            <p><button className="btn" type="submit">Import</button></p>
          </form>
        </div>
      </div>

      <h2>Your projects</h2>
      {projects.length === 0 ? (
        <div className="card">No projects yet. Create one, or import an export.</div>
      ) : (
        <div className="card">
          <table>
            <thead><tr><th>Name</th><th>Elements</th><th>ADRs</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/architecture/wizard?step=project&id=${p.id}`}>{p.name || "Untitled"}</Link></td>
                  <td>{p.elements.length}</td>
                  <td>{p.adrs.length}</td>
                  <td>{p.updatedAt.slice(0, 10)}</td>
                  <td>
                    <form action={deleteProjectAction} style={{ display: "inline" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button className="btn ghost" type="submit">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p><Link href="/">Back to dashboard</Link></p>
    </>
  );
}
