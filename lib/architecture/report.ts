import type { Adr, ArchitectureProject } from "./model";
import { containerDiagram, componentDiagram, contextDiagram, codeDiagram, landscapeDiagram, deploymentDiagram, dynamicDiagram, escapeXml, type DiagramSpec } from "./svg";
import { runChecks, summariseChecks } from "./checks";

const NR = "not recorded";

function bullets(items: string[]): string[] {
  return items.length ? items.map((i) => `- ${i}`) : [`- ${NR}`];
}

export function adrToMarkdown(a: Adr): string {
  const chosen = a.options.find((o) => o.id === a.chosenOptionId);
  const L: string[] = [];
  L.push(`# ADR-${String(a.number).padStart(4, "0")}: ${a.title}`);
  L.push("");
  L.push(`- **Status**: ${a.status}${a.aiDrafted ? " (AI-assisted draft, not yet human-reviewed)" : ""}`);
  L.push(`- **Date**: ${a.date || NR}`);
  L.push(`- **Author**: ${a.author || NR}`);
  L.push("");
  L.push("## Context");
  L.push(a.context || NR);
  L.push("");
  L.push("## Problem statement");
  L.push(a.problemStatement || NR);
  L.push("");
  L.push("## Decision drivers");
  L.push(...bullets(a.decisionDrivers));
  L.push("");
  L.push("## Options considered");
  L.push("");
  for (const o of a.options) {
    L.push(`### ${o.title}`);
    L.push(`**Pros**`);
    L.push(...bullets(o.pros.split("\n").filter(Boolean)));
    L.push(`**Cons**`);
    L.push(...bullets(o.cons.split("\n").filter(Boolean)));
    L.push("");
  }
  L.push("## Decision");
  L.push(chosen ? `We will use **${chosen.title}**.` : NR);
  L.push("");
  L.push("## Rationale");
  L.push(a.rationale || NR);
  L.push("");
  L.push("## Consequences");
  L.push("**Positive**");
  L.push(...bullets(a.positiveConsequences));
  L.push("**Negative**");
  L.push(...bullets(a.negativeConsequences));
  L.push("");
  L.push("## Risks and mitigations");
  L.push(...bullets(a.risksAndMitigations));
  L.push("");
  L.push("## Security and compliance");
  L.push(a.securityAndCompliance || NR);
  L.push("");
  L.push("## Cost and operations");
  L.push(a.costAndOperations || NR);
  L.push("");
  if (a.supersedesId) L.push(`Supersedes ${a.supersedesId}.`);
  return L.join("\n");
}

export function adrsToMarkdown(p: ArchitectureProject): string {
  return p.adrs.map(adrToMarkdown).join("\n\n---\n\n");
}

function diagramMarkdown(p: ArchitectureProject, d: DiagramSpec): string {
  return `### ${d.title}\n\n_${d.caption}_\n\n\`\`\`svg\n${d.svg}\n\`\`\`\n`;
}

/** Every diagram selected in the model, in reporting order. */
export function allDiagrams(p: ArchitectureProject): DiagramSpec[] {
  const out: DiagramSpec[] = [contextDiagram(p)];
  if (p.includeLandscape) out.push(landscapeDiagram(p));
  out.push(containerDiagram(p));
  for (const id of p.componentDiagramContainerIds) {
    if (p.elements.some((e) => e.id === id)) out.push(componentDiagram(p, id));
  }
  for (const id of p.codeDiagramComponentIds) {
    if (p.elements.some((e) => e.id === id)) out.push(codeDiagram(p, id));
  }
  for (const id of p.dynamicScenarioIds) {
    if (p.scenarios.some((s) => s.id === id)) out.push(dynamicDiagram(p, id));
  }
  if (p.includeDeployment) out.push(deploymentDiagram(p));
  return out;
}

export function reportToMarkdown(p: ArchitectureProject, version: string): string {
  const L: string[] = [];
  L.push(`# Architecture report: ${p.name || "Untitled project"}`);
  L.push("");
  L.push(`- **Version**: ${version}`);
  L.push(`- **Generated**: ${new Date().toISOString()}`);
  L.push(`- **Author**: ${NR}`);
  L.push("");
  L.push("## Executive summary");
  L.push(p.purpose || NR);
  L.push("");
  L.push("## Business context and objectives");
  L.push(p.businessContext || NR);
  L.push("");
  L.push("## Scope");
  L.push(p.scope || NR);
  L.push("");
  L.push("### Assumptions");
  L.push(...bullets(p.assumptions));
  L.push("### Constraints");
  L.push(...bullets(p.constraints));
  L.push("");
  L.push("## Stakeholders");
  L.push(...bullets(p.stakeholders));
  L.push("");
  L.push("## Diagrams");
  for (const d of allDiagrams(p)) L.push(diagramMarkdown(p, d));
  L.push("## Architecture decisions");
  if (p.adrs.length === 0) L.push(NR);
  else {
    L.push("| ADR | Title | Status | Date |");
    L.push("|---|---|---|---|");
    for (const a of p.adrs) L.push(`| ADR-${String(a.number).padStart(4, "0")} | ${a.title} | ${a.status} | ${a.date || NR} |`);
    L.push("");
    L.push(adrsToMarkdown(p));
  }
  L.push("## Requirements and traceability");
  if (p.requirements.length === 0) L.push(NR);
  else {
    L.push("| Requirement | Category | Linked elements |");
    L.push("|---|---|---|");
    for (const r of p.requirements) {
      const names = r.linkedElementIds.map((id) => p.elements.find((e) => e.id === id)?.name ?? id);
      L.push(`| ${r.title} | ${r.category} | ${names.length ? names.join(", ") : "not linked"} |`);
    }
  }
  L.push("");
  L.push("## Security considerations");
  L.push(p.securityNotes || NR);
  L.push("");
  L.push("## Quality attributes");
  L.push(p.requirements.filter((r) => r.category && r.category !== "functional").map((r) => `- ${r.category}: ${r.title}`).join("\n") || NR);
  L.push("");
  L.push("## Risks and mitigations");
  if (p.risks.length === 0) L.push(NR);
  else {
    L.push("| Risk | Category | Severity | Likelihood | Mitigation |");
    L.push("|---|---|---|---|---|");
    for (const r of p.risks) L.push(`| ${r.title} | ${r.category} | ${r.severity} | ${r.likelihood} | ${r.mitigation || NR} |`);
  }
  L.push("");
  L.push("## Operations, DR and cost notes");
  L.push(p.operationalNotes || NR);
  L.push("");
  L.push(p.costNotes || NR);
  L.push("");
  L.push("## Open questions");
  L.push(...bullets(p.openQuestions));
  return L.join("\n") + "\n";
}

function li(items: string[]): string {
  return items.length ? `<ul>${items.map((i) => `<li>${escapeXml(i)}</li>`).join("")}</ul>` : `<p class="nr">${NR}</p>`;
}

function p_(text: string): string {
  return text.trim() ? `<p>${escapeXml(text).replace(/\n/g, "<br/>")}</p>` : `<p class="nr">${NR}</p>`;
}

/**
 * Print-optimised HTML. Deliberately light-themed with page-break control so the
 * browser's "Save as PDF" produces a clean, paginated document.
 */
export function reportToHtml(p: ArchitectureProject, version: string): string {
  const diagrams = allDiagrams(p);
  const checks = runChecks(p);
  const summary = summariseChecks(checks);
  const generated = new Date().toISOString().slice(0, 10);

  const figure = (d: DiagramSpec) => `
<figure class="diagram">
  <div class="diagram-frame">${d.svg}</div>
  <figcaption><strong>${escapeXml(d.title)}</strong> &mdash; ${escapeXml(d.caption)}</figcaption>
</figure>`;

  const body = `
<section class="cover">
  <h1>Architecture report</h1>
  <h2>${escapeXml(p.name || "Untitled project")}</h2>
  <table class="meta">
    <tr><th>Version</th><td>${escapeXml(version)}</td></tr>
    <tr><th>Date</th><td>${generated}</td></tr>
    <tr><th>Author</th><td>${escapeXml("Author not recorded")}</td></tr>
  </table>
</section>

<section class="page">
  <h2 class="section">1. Executive summary</h2>
  ${p_(p.purpose)}
  <h2 class="section">2. Business context and objectives</h2>
  ${p_(p.businessContext)}
  <h2 class="section">3. Scope, assumptions and constraints</h2>
  ${p_(p.scope)}
  <h4>Assumptions (unverified unless confirmed)</h4>
  ${li(p.assumptions)}
  <h4>Constraints</h4>
  ${li(p.constraints)}
  <h2 class="section">4. Stakeholders</h2>
  ${li(p.stakeholders)}
</section>

<section class="page">
  <h2 class="section">5. Architecture diagrams</h2>
  ${diagrams.map((d, i) => `<h3 class="section">${i + 1}. ${escapeXml(d.title)} <span class="level">(${escapeXml(d.source)})</span></h3>${figure(d)}`).join("")}
</section>

<section class="page">
  <h2 class="section">7. Architecture decisions</h2>
  ${p.adrs.length === 0 ? `<p class="nr">${NR}</p>` : `
  <table class="grid"><thead><tr><th>ADR</th><th>Title</th><th>Status</th><th>Date</th></tr></thead><tbody>
  ${p.adrs.map((a) => `<tr><td>ADR-${String(a.number).padStart(4, "0")}</td><td>${escapeXml(a.title)}</td><td>${escapeXml(a.status)}${a.aiDrafted ? " (AI draft)" : ""}</td><td>${escapeXml(a.date || NR)}</td></tr>`).join("")}
  </tbody></table>`}
  ${p.adrs.map((a) => `<div class="adr"><h3>ADR-${String(a.number).padStart(4, "0")}: ${escapeXml(a.title)}</h3>
    <p><strong>Status</strong> ${escapeXml(a.status)} &middot; <strong>Date</strong> ${escapeXml(a.date || NR)} &middot; <strong>Author</strong> ${escapeXml(a.author || NR)}</p>
    ${a.aiDrafted ? `<p class="flag">AI-assisted draft. Not human-reviewed and not accepted.</p>` : ""}
    <h4>Context</h4>${p_(a.context)}
    <h4>Decision</h4>${p_(a.rationale)}
    <h4>Positive consequences</h4>${li(a.positiveConsequences)}
    <h4>Negative consequences</h4>${li(a.negativeConsequences)}
    <h4>Risks and mitigations</h4>${li(a.risksAndMitigations)}
  </div>`).join("")}
</section>

<section class="page">
  <h2 class="section">8. Requirements and traceability</h2>
  ${p.requirements.length === 0 ? `<p class="nr">${NR}</p>` : `
  <table class="grid"><thead><tr><th>Requirement</th><th>Category</th><th>Linked elements</th></tr></thead><tbody>
  ${p.requirements.map((r) => `<tr><td>${escapeXml(r.title)}</td><td>${escapeXml(r.category)}</td><td>${escapeXml(r.linkedElementIds.map((id) => p.elements.find((e) => e.id === id)?.name ?? id).join(", ") || "not linked")}</td></tr>`).join("")}
  </tbody></table>`}
  <h2 class="section">9. Security considerations</h2>
  ${p_(p.securityNotes)}
  <h2 class="section">10. Risks and mitigations</h2>
  ${p.risks.length === 0 ? `<p class="nr">${NR}</p>` : `
  <table class="grid"><thead><tr><th>Risk</th><th>Severity</th><th>Likelihood</th><th>Mitigation</th></tr></thead><tbody>
  ${p.risks.map((r) => `<tr><td>${escapeXml(r.title)}</td><td>${escapeXml(r.severity)}</td><td>${escapeXml(r.likelihood)}</td><td>${escapeXml(r.mitigation || NR)}</td></tr>`).join("")}
  </tbody></table>`}
  <h2 class="section">11. Operations, disaster recovery and cost notes</h2>
  ${p_(p.operationalNotes)}
  ${p_(p.costNotes)}
  <h2 class="section">12. Open questions</h2>
  ${li(p.openQuestions)}
  <h2 class="section">Appendix A. Quality checks</h2>
  <p>${summary.total} checks: ${summary.errors} errors, ${summary.warnings} warnings, ${summary.heuristics} heuristics. A clean result does not mean this design is secure, correct or approved.</p>
  ${checks.length ? `<ul class="checks">${checks.map((c) => `<li><strong>${escapeXml(c.severity)}</strong> ${escapeXml(c.message)} <em>(${escapeXml(c.basis)})</em></li>`).join("")}</ul>` : `<p class="nr">${NR}</p>`}
  <h2 class="section">Appendix B. Notation sources</h2>
  <ul>${["https://c4model.com/diagrams", "https://c4model.com/diagrams/notation", "https://c4model.com/diagrams/checklist", "https://c4model.com/abstractions"].map((u) => `<li>${escapeXml(u)}</li>`).join("")}</ul>
</section>`;

  return body;
}

export const REPORT_CSS = `
@page { size: A4; margin: 18mm 14mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #0f172a; background: #ffffff; margin: 0; font-size: 11pt; line-height: 1.45; }
.cover { page-break-after: always; text-align: left; padding-top: 40mm; }
.cover h1 { font-size: 26pt; margin: 0 0 6pt; }
.cover h2 { font-size: 18pt; margin: 0 0 18pt; color: #0f766e; }
table.meta { border-collapse: collapse; width: 60%; }
table.meta th, table.meta td { border: 1px solid #cbd5e1; padding: 6pt 8pt; text-align: left; font-size: 10pt; }
.page { page-break-before: always; }
h2.section { font-size: 14pt; border-bottom: 2px solid #0f766e; padding-bottom: 4pt; margin: 0 0 10pt; break-after: avoid; }
h3.section { font-size: 12pt; color: #0f172a; margin: 14pt 0 6pt; break-after: avoid; }
.level { font-weight: 400; font-size: 9.5pt; color: #64748b; }
h3, h4 { break-after: avoid; margin: 12pt 0 4pt; font-size: 11.5pt; }
table.grid { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 6pt 0 12pt; }
table.grid th, table.grid td { border: 1px solid #cbd5e1; padding: 5pt 6pt; text-align: left; vertical-align: top; }
figure.diagram { margin: 8pt 0 16pt; break-inside: avoid; }
.diagram-frame svg { max-width: 100%; height: auto; }
figcaption { font-size: 9pt; color: #475569; margin-top: 4pt; }
.nr { color: #64748b; font-style: italic; }
.flag { background: #fff7ed; border: 1px solid #fdba74; padding: 6pt; font-size: 9.5pt; }
.adr { break-inside: avoid; border-left: 3px solid #0f766e; padding-left: 10pt; margin: 12pt 0 18pt; }
ul.checks { font-size: 9pt; }
p, li { orphans: 3; widows: 3; }
@media screen { body { padding: 24px; max-width: 900px; margin: 0 auto; } .page { border-top: 1px dashed #cbd5e1; margin-top: 28px; padding-top: 18px; } }
`;
