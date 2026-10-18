import { describe, expect, it } from "vitest";
import { sampleProject } from "@/lib/architecture/sample";
import { migrateProject, validateProject, adrRules, canAccept } from "@/lib/architecture/validation";
import { contextDiagram, containerDiagram, componentDiagram, escapeXml } from "@/lib/architecture/svg";
import { reportToMarkdown, reportToHtml, adrToMarkdown } from "@/lib/architecture/report";
import { runChecks, summariseChecks } from "@/lib/architecture/checks";
import { emptyProject, SCHEMA_VERSION } from "@/lib/architecture/model";

describe("model migration and validation", () => {
  it("round-trips the sample project with no errors", () => {
    const issues = validateProject(sampleProject()).filter((i) => i.severity === "error");
    expect(issues).toEqual([]);
  });

  it("migrates a partial or older payload to the current schema", () => {
    const p = migrateProject({ id: "x", name: "Old", elements: [{ id: "a", kind: "nonsense", name: "A" }] });
    expect(p.schemaVersion).toBe(SCHEMA_VERSION);
    expect(p.elements[0].kind).toBe("container");
    expect(p.elements[0].description).toBe("");
  });

  it("survives completely empty input", () => {
    expect(migrateProject(null).elements).toEqual([]);
    expect(migrateProject("nonsense").adrs).toEqual([]);
  });

  it("rejects a relationship pointing at a missing element", () => {
    const p = sampleProject();
    p.relationships.push({ id: "bad", sourceId: "sys_orders", targetId: "nope", label: "uses" });
    const errors = validateProject(p).filter((i) => i.severity === "error");
    expect(errors.some((e) => e.message.includes("target does not exist"))).toBe(true);
  });

  it("rejects self-referencing relationships", () => {
    const p = sampleProject();
    p.relationships.push({ id: "self", sourceId: "sys_orders", targetId: "sys_orders", label: "uses" });
    expect(validateProject(p).some((i) => i.message.includes("cannot point at itself"))).toBe(true);
  });

  it("requires a project name", () => {
    const p = emptyProject("");
    expect(validateProject(p).some((i) => i.field === "name" && i.severity === "error")).toBe(true);
  });
});

describe("ADR rules", () => {
  const base = sampleProject().adrs[0];

  it("accepts a complete ADR", () => {
    expect(canAccept(base)).toBe(true);
  });

  it("blocks acceptance without context, options, choice or rationale", () => {
    const a = { ...base, context: "", options: [base.options[0]], chosenOptionId: undefined, rationale: "", positiveConsequences: [] };
    const errors = adrRules({ ...a, status: "accepted" }).filter((i) => i.severity === "error");
    expect(errors.length).toBeGreaterThanOrEqual(4);
    expect(canAccept(a)).toBe(false);
  });

  it("rejects a chosen option that is not among the options", () => {
    expect(adrRules({ ...base, chosenOptionId: "missing" }).some((i) => i.severity === "error")).toBe(true);
  });

  it("refuses to accept an AI-drafted ADR", () => {
    expect(adrRules({ ...base, aiDrafted: true, status: "accepted" }).some((i) => i.message.includes("AI-drafted"))).toBe(true);
  });
});

describe("diagram generation", () => {
  it("renders all three levels as self-contained SVG", () => {
    const p = sampleProject();
    for (const d of [contextDiagram(p), containerDiagram(p), componentDiagram(p, "con_api")]) {
      expect(d.svg.startsWith("<svg")).toBe(true);
      expect(d.svg.endsWith("</svg>")).toBe(true);
      expect(d.svg).toContain("<title>");
      expect(d.svg).toContain("Key</text>");
      expect(d.svg).toContain("stroke-width");
    }
  });

  it("is deterministic: the same model renders byte-identical SVG", () => {
    const p = sampleProject();
    expect(containerDiagram(p).svg).toBe(containerDiagram(p).svg);
  });

  it("escapes user text so nothing can break out of the SVG", () => {
    const p = sampleProject();
    p.elements[0].name = '<script>alert("x")</script>';
    const svg = contextDiagram(p).svg;
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("escapes ampersands and quotes", () => {
    expect(escapeXml(`a & b " c ' d`)).toBe("a &amp; b &quot; c &apos; d");
  });

  it("shows the project name and a caption", () => {
    const d = containerDiagram(sampleProject());
    expect(d.svg).toContain(sampleProject().name);
    expect(d.caption.length).toBeGreaterThan(10);
  });

  it("renders an empty state rather than failing with no elements", () => {
    const p = sampleProject();
    p.elements = [];
    p.relationships = [];
    expect(containerDiagram(p).svg).toContain("Add containers");
  });

  it("uses distinct shapes for people and data stores", () => {
    const p = sampleProject();
    // people live on the context diagram
    const ctx = contextDiagram(p).svg;
    expect(ctx).toMatch(/<rect [^>]*rx="10"[^>]*fill="#fef3c7"/);
    // data stores live on the container diagram, drawn as a cylinder
    const svg = containerDiagram(p).svg;
    expect((svg.match(/<ellipse/g) ?? []).length).toBe(2);
    expect(svg).toContain('fill="#f3e8ff"');
  });
});

describe("report assembly", () => {
  const p = sampleProject();

  it("produces markdown containing the project name and every ADR title", () => {
    const md = reportToMarkdown(p, "v1");
    expect(md).toContain(p.name);
    for (const a of p.adrs) expect(md).toContain(a.title);
  });

  it("says 'not recorded' rather than inventing content", () => {
    const empty = { ...p, purpose: "", businessContext: "", securityNotes: "" };
    const md = reportToMarkdown(empty, "v1");
    expect(md).toContain("not recorded");
    expect(md).not.toContain("undefined");
  });

  it("includes diagrams as inline SVG and the report sections", () => {
    const html = reportToHtml(p, "v1");
    expect(html).toContain("<svg");
    for (const heading of ["Executive summary", "System context diagram", "Container diagram", "Architecture decisions", "Risks and mitigations", "Open questions"]) {
      expect(html).toContain(heading);
    }
  });

  it("escapes HTML in the report body", () => {
    const evil = { ...p, name: '<img src=x onerror="alert(1)">' };
    const html = reportToHtml(evil, "v1");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("numbers ADRs and renders a single ADR as markdown", () => {
    const md = adrToMarkdown(p.adrs[0]);
    expect(md).toContain("ADR-0001");
    expect(md).toContain("## Context");
    expect(md).toContain("## Consequences");
  });
});

describe("quality checks", () => {
  it("warns on a clean sample rather than claiming correctness", () => {
    const checks = runChecks(sampleProject());
    const s = summariseChecks(checks);
    expect(s.total).toBeGreaterThanOrEqual(0);
    expect(s.errors).toBe(0);
  });

  it("flags missing descriptions and technology per the C4 notation", () => {
    const p = sampleProject();
    p.elements[1].description = "";
    p.elements[4].technology = "";
    const checks = runChecks(p);
    expect(checks.some((c) => c.message.includes("no description"))).toBe(true);
    expect(checks.some((c) => c.message.includes("no technology"))).toBe(true);
    expect(checks.some((c) => c.basis === "c4model")).toBe(true);
  });

  it("flags unconnected people and unlinked requirements", () => {
    const p = sampleProject();
    p.elements.push({ id: "orphan", kind: "person", name: "Nobody", description: "d" });
    p.requirements.push({ id: "r9", title: "Loose", category: "functional", description: "", linkedElementIds: [], adrIds: [] });
    const checks = runChecks(p);
    expect(checks.some((c) => c.message.includes("not connected"))).toBe(true);
    expect(checks.some((c) => c.message.includes("not linked"))).toBe(true);
  });
});
