import Link from "next/link";
import { loadRegister } from "@/lib/register";

export default async function Sources({ searchParams }: { searchParams: Promise<{ pillar?: string; q?: string }> }) {
  const sp = await searchParams;
  const all = loadRegister();
  const pillars = [...new Set(all.map((r) => r.pillar))];
  const q = (sp.q ?? "").toLowerCase();
  const rows = all.filter(
    (r) => (!sp.pillar || r.pillar === sp.pillar) && (!q || r.title.toLowerCase().includes(q)),
  );

  return (
    <>
      <h1>Source register</h1>
      <p className="muted">
        Pages on ctoframework.com, reviewed 2026-10-11 from its site map. Review depth "index-only" means only the title,
        URL and role tag were read; the guide itself has not yet been studied.
      </p>
      <div className="row">
        <Link href="/sources" className="badge">All ({all.length})</Link>
        {pillars.map((p) => (
          <Link key={p} href={`/sources?pillar=${p}`} className="badge">
            {p} ({all.filter((r) => r.pillar === p).length})
          </Link>
        ))}
      </div>
      <form style={{ margin: "12px 0" }}>
        {sp.pillar && <input type="hidden" name="pillar" value={sp.pillar} />}
        <input type="text" name="q" placeholder="Filter by title" defaultValue={sp.q ?? ""} />
      </form>
      <p className="muted">{rows.length} shown</p>
      <div className="card">
        <table>
          <thead><tr><th>Title</th><th>Pillar / section</th><th>Role tag</th><th>Review depth</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.path}>
                <td><a href={r.url} target="_blank" rel="noreferrer">{r.title}</a></td>
                <td>{r.pillar} / {r.section}</td>
                <td>{r.roleTag}</td>
                <td>{r.reviewDepth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
