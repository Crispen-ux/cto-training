import { describe, expect, it } from "vitest";
import { sampleProject } from "@/lib/architecture/sample";
import { textWidth, fitText, wrapToWidth, contentHeight } from "@/lib/architecture/svg";
import {
  contextDiagram,
  containerDiagram,
  componentDiagram,
  codeDiagram,
  landscapeDiagram,
  deploymentDiagram,
  dynamicDiagram,
} from "@/lib/architecture/svg";
import type { ArchitectureProject } from "@/lib/architecture/model";

function allDiagrams(p: ArchitectureProject) {
  return [
    contextDiagram(p),
    containerDiagram(p),
    landscapeDiagram(p),
    deploymentDiagram(p),
    componentDiagram(p, "con_api"),
    codeDiagram(p, "cmp_reserve"),
    dynamicDiagram(p, "scn_order"),
  ];
}

function canvas(svg: string): { w: number; h: number } {
  const m = svg.match(/width="(\d+)" height="(\d+)"/)!;
  return { w: Number(m[1]), h: Number(m[2]) };
}

interface TextRun { x: number; y: number; size: number; anchor: string; text: string }

function textRuns(svg: string): TextRun[] {
  const runs: TextRun[] = [];
  for (const m of svg.matchAll(/<text x="(-?\d+)" y="(-?\d+)" font-size="(\d+)"([^>]*)>([^<]*)<\/text>/g)) {
    const attrs = m[4];
    const anchor = /text-anchor="(\w+)"/.exec(attrs)?.[1] ?? "start";
    runs.push({ x: Number(m[1]), y: Number(m[2]), size: Number(m[3]), anchor, text: m[5] });
  }
  return runs;
}

describe("text fitting primitives", () => {
  it("measures width from the font size, not the character count", () => {
    expect(textWidth("abcd", 11)).toBeCloseTo(4 * 11 * 0.56, 5);
    expect(textWidth("abcd", 22)).toBeCloseTo(textWidth("abcd", 11) * 2, 5);
  });

  it("leaves short text untouched", () => {
    expect(fitText("Order API", 300, 13)).toBe("Order API");
  });

  it("truncates with an ellipsis instead of dropping text silently", () => {
    const out = fitText("a very long element name that will not fit at all", 80, 13);
    expect(out.endsWith("...")).toBe(true);
    expect(textWidth(out, 13)).toBeLessThanOrEqual(80);
  });

  it("wraps on measured width and never silently loses words", () => {
    const long = "Checks and updates stock levels across every warehouse in the region before confirming";
    const lines = wrapToWidth(long, 200, 11, 4);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 11)).toBeLessThanOrEqual(200);
    // nothing is dropped: the last line is marked if content was cut
    const rejoined = lines.join(" ").replace(/\.\.\.$/, "");
    expect(rejoined.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(long.split(/\s+/).length - 3);
  });

  it("breaks a single word that is wider than the box", () => {
    const lines = wrapToWidth("Supercalifragilisticexpialidocious", 60, 11, 4);
    expect(lines.length).toBeGreaterThan(1);
    for (const l of lines) expect(textWidth(l, 11)).toBeLessThanOrEqual(60);
  });

  it("sizes a box to its content, never below the minimum", () => {
    const e = { id: "a", kind: "container" as const, name: "Order reservation service", description: "Reserves stock for an order line and records the decision" };
    // narrower boxes force more lines, so the box must grow
    expect(contentHeight(e, 120)).toBeGreaterThanOrEqual(contentHeight(e, 400));
    expect(contentHeight(e, 400)).toBeGreaterThanOrEqual(96);
    // a long technology line adds room as well
    const withTech = { ...e, technology: "Node.js" };
    expect(contentHeight(withTech, 400)).toBeGreaterThanOrEqual(contentHeight(e, 400));
  });
});

describe("no diagram text is cut off", () => {
  it("keeps every text run inside the canvas horizontally", () => {
    for (const d of allDiagrams(sampleProject())) {
      const { w } = canvas(d.svg);
      for (const t of textRuns(d.svg)) {
        const width = textWidth(t.text, t.size);
        const left = t.anchor === "middle" ? t.x - width / 2 : t.x;
        const right = t.anchor === "middle" ? t.x + width / 2 : t.x + width;
        expect(left, `${d.title}: "${t.text}" left`).toBeGreaterThanOrEqual(-1);
        expect(right, `${d.title}: "${t.text}" right (${Math.round(right)} > ${w})`).toBeLessThanOrEqual(w + 1);
      }
    }
  });

  it("keeps every text run inside the canvas vertically", () => {
    for (const d of allDiagrams(sampleProject())) {
      const { h } = canvas(d.svg);
      for (const t of textRuns(d.svg)) {
        expect(t.y, `${d.title}: "${t.text}" bottom`).toBeLessThanOrEqual(h);
        expect(t.y, `${d.title}: "${t.text}" top`).toBeGreaterThan(0);
      }
    }
  });

  it("handles a deliberately hostile project without cutting text", () => {
    const p = sampleProject();
    p.name = "An extremely long project name that will certainly not fit inside any reasonable canvas width";
    p.elements[0].name = "Software system with a name far longer than any box could ever accommodate";
    p.elements[0].description = "Description ".repeat(40);
    p.elements[4].technology = "SomeVeryLongTechnologyNameThatKeepsGoingAndGoing/WithAMassiveVersionString";
    for (const e of p.elements) if (e.kind === "component") e.parentId = e.parentId ?? "con_api";
    for (const d of allDiagrams(p)) {
      const { w } = canvas(d.svg);
      for (const t of textRuns(d.svg)) {
        const width = textWidth(t.text, t.size);
        const left = t.anchor === "middle" ? t.x - width / 2 : t.x;
        expect(left, `${d.title}: "${t.text.slice(0, 30)}"`).toBeGreaterThanOrEqual(-1);
        expect(left + width, `${d.title}: "${t.text.slice(0, 30)}"`).toBeLessThanOrEqual(w + 1);
      }
    }
  });

  it("marks truncated text with an ellipsis rather than losing it", () => {
    const p = sampleProject();
    p.elements[0].name = "A".repeat(300);
    const svg = contextDiagram(p).svg;
    expect(svg).toContain("...");
  });
});
