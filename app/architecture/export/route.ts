import { notFound, redirect } from "next/navigation";
import { listProjects } from "@/lib/architecture/store";
import { reportToMarkdown, adrsToMarkdown } from "@/lib/architecture/report";
import { allDiagrams } from "@/lib/architecture/report";

export const dynamic = "force-dynamic";

function download(body: string, filename: string, type: string) {
  return new Response(body, {
    headers: {
      "content-type": `${type}; charset=utf-8`,
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function safeName(name: string): string {
  return (name || "project").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "project";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "md";
  const requestedId = url.searchParams.get("id") ?? "";
  const projects = listProjects();
  if (projects.length === 0) {
    // Nothing to export: send the user somewhere they can act, not a dead 404.
    return redirect("/architecture?error=No+projects+yet.+Create+one+or+import+a+project+JSON");
  }

  // A missing id means "most recently updated" so a download link is never a
  // dead 404. An id that was supplied but does not exist means the project was
  // deleted or the link is stale, so explain that instead of returning a bare 404.
  const p = requestedId
    ? projects.find((x) => x.id === requestedId)
    : [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!p) {
    return redirect("/architecture?error=That+project+no+longer+exists.+It+may+have+been+deleted.");
  }

  const base = safeName(p.name);

  if (format === "json") {
    return download(JSON.stringify(p, null, 2), `${base}.json`, "application/json");
  }
  if (format === "adrs") {
    return download(adrsToMarkdown(p) || "# No architecture decisions recorded.\n", `${base}-adrs.md`, "text/markdown");
  }
  if (format === "svg") {
    const diagrams = allDiagrams(p);
    const combined = diagrams.map((d) => `<!-- ${d.title} (${d.source}) -->\n${d.svg}`).join("\n\n");
    return download(combined, `${base}-diagrams.svg`, "image/svg+xml");
  }
  if (format === "svg-one") {
    const diagrams = allDiagrams(p);
    const want = (url.searchParams.get("level") ?? "").toLowerCase();
    // match on words so "Level 2 - Container", "container" and "level-2-container"
    // all resolve, instead of requiring one exact slug
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const target = norm(want);
    const d = diagrams.find((x) => {
      const t = norm(x.source);
      const title = norm(x.title);
      return t === target || title.includes(target) || t.includes(target);
    }) ?? diagrams[0];
    const file = `${base}-${norm(d.source).replace(/\s+/g, "-")}.svg`;
    return download(d.svg, file, "image/svg+xml");
  }
  return download(reportToMarkdown(p, "v1"), `${base}-report.md`, "text/markdown");
}
