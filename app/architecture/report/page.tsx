import { notFound } from "next/navigation";
import Link from "next/link";
import { listProjects } from "@/lib/architecture/store";
import { reportToHtml, REPORT_CSS, reportToMarkdown } from "@/lib/architecture/report";
import PrintButton from "@/components/PrintButton";

export const dynamic = "force-dynamic";

/**
 * Print view. The PDF path is deliberately browser-native: this page is
 * paginated with a dedicated print stylesheet and the user chooses
 * "Save as PDF" in the print dialog. That keeps the cost at zero and needs no
 * headless browser or paid service, which is what a free serverless tier can
 * actually run. A PDF-library integration can be added behind this route later.
 */
export default async function ReportPage({ searchParams }: { searchParams: Promise<{ id?: string; print?: string }> }) {
  const sp = await searchParams;
  const requestedId = sp.id ?? "";
  const projects = listProjects();
  if (projects.length === 0) notFound();
  // Missing id means most recently updated, matching the export route. A stale
  // id (deleted project, cached bookmark) explains itself instead of 404ing.
  const p = requestedId
    ? projects.find((x) => x.id === requestedId)
    : [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!p) {
    return (
      <div className="card">
        <h1>That project no longer exists</h1>
        <p className="muted">
          This link points at a project that has been deleted. Pick one from the{" "}
          <Link href="/architecture">project list</Link> or create a new one.
        </p>
        <ul className="tight">
          {projects.map((x) => (
            <li key={x.id}><Link href={`/architecture/report?id=${x.id}`}>{x.name || "Untitled"}</Link></li>
          ))}
        </ul>
      </div>
    );
  }
  const version = `v1.${p.adrs.length}a.${p.elements.length}e`;
  const autoPrint = sp.print === "1";

  return (
    <>
      <div className="no-print">
        <div className="card">
          <strong>Export PDF:</strong> the button below opens this report in a new tab and opens your browser's print
          dialog. Choose <strong>&ldquo;Save as PDF&rdquo;</strong> as the destination, keep margins on default and
          enable <strong>background graphics</strong> so the diagrams and key print correctly.
          <p style={{ marginTop: 8 }}>
            <PrintButton id={p.id} label="Export PDF" />{" "}
            <a className="btn" href={`/architecture/export?format=md&id=${p.id}`}>Download Markdown</a>{" "}
            <a className="btn" href={`/architecture/export?format=svg&id=${p.id}`}>Download diagrams (SVG)</a>{" "}
            <a className="btn" href={`/architecture/export?format=json&id=${p.id}`}>Download model (JSON)</a>{" "}
            <a className="btn" href={`/architecture/export?format=adrs&id=${p.id}`}>Download ADRs</a>{" "}
            <Link className="btn ghost" href={`/architecture/wizard?step=review&id=${p.id}`}>Back to editor</Link>
          </p>
          <details>
            <summary>Markdown preview</summary>
            <pre className="work">{reportToMarkdown(p, version).slice(0, 4000)}</pre>
          </details>
        </div>
      </div>
      {autoPrint && (
        <div className="no-print">
          <div className="card">Choose <strong>Save as PDF</strong> in the dialog that just opened.</div>
        </div>
      )}
      <div className="report">
        <style dangerouslySetInnerHTML={{ __html: REPORT_CSS }} />
        <div dangerouslySetInnerHTML={{ __html: reportToHtml(p, version) }} />
      </div>
      {autoPrint && <AutoPrint />}
    </>
  );
}

function AutoPrint() {
  return <PrintButton label="" autoPrint />;
}
