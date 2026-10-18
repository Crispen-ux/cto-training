import { describe, expect, it } from "vitest";
import { sampleProject } from "@/lib/architecture/sample";
import { contextDiagram, containerDiagram, componentDiagram, codeDiagram, landscapeDiagram, deploymentDiagram, dynamicDiagram } from "@/lib/architecture/svg";

interface Rect { x: number; y: number; w: number; h: number }

function boxes(svg: string): Rect[] {
  return [...svg.matchAll(/<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)"[^>]*fill="(#[0-9a-f]{6})"/g)]
    .map((m) => ({ x: Number(m[1]), y: Number(m[2]), w: Number(m[3]), h: Number(m[4]) }))
    .filter((r) => r.w > 80 && r.h > 60);
}

function overlapsIn(list: Rect[], b: Rect): boolean {
  return list.some((a) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h);
}

describe("diagram layout geometry", () => {
  it("never overlaps element boxes in the container diagram", () => {
    const rects = boxes(containerDiagram(sampleProject()).svg);
    expect(rects.length).toBeGreaterThan(1);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlapsIn([rects[i]], rects[j]), `${i} vs ${j}`).toBe(false);
    }
  });

  it("never overlaps element boxes in the context diagram", () => {
    const rects = boxes(contextDiagram(sampleProject()).svg).filter((r) => r.w >= 280);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlapsIn([rects[i]], rects[j]), `${i} vs ${j}`).toBe(false);
    }
  });

  it("never overlaps element boxes in a component diagram", () => {
    const rects = boxes(componentDiagram(sampleProject(), "con_api").svg);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlapsIn([rects[i]], rects[j]), `${i} vs ${j}`).toBe(false);
    }
  });

  it("keeps every box inside the SVG canvas", () => {
    for (const d of [contextDiagram(sampleProject()), containerDiagram(sampleProject()), componentDiagram(sampleProject(), "con_api")]) {
      const [, w, h] = d.svg.match(/width="(\d+)" height="(\d+)"/)!.map(Number) as unknown as number[];
      for (const r of boxes(d.svg)) {
        expect(r.x + r.w).toBeLessThanOrEqual(w!);
        expect(r.y + r.h).toBeLessThanOrEqual(h!);
      }
    }
  });

  it("colours boxes by kind so the key matches the diagram", () => {
    const svg = contextDiagram(sampleProject()).svg;
    const external = svg.match(/<rect x="82" y="480" width="280" height="110" rx="6" fill="(#[0-9a-f]{6})"/);
    expect(external?.[1]).toBe("#e2e8f0");
    // the same fill is used by an "External system" key swatch
    expect(svg).toContain('fill="#e2e8f0" stroke="#334155" stroke-width="1"/>');
    expect(svg).toContain("External system</text>");
  });

  it("scales the canvas with the number of elements", () => {
    const p = sampleProject();
    const small = boxes(containerDiagram(p).svg).length;
    for (let i = 0; i < 12; i++) {
      p.elements.push({ id: `x${i}`, kind: "container", name: `Container ${i}`, description: "Extra", technology: "Node" });
    }
    const large = containerDiagram(p).svg;
    const [, w, h] = large.match(/width="(\d+)" height="(\d+)"/)!.map(Number) as unknown as number[];
    expect(boxes(large).length).toBeGreaterThan(small);
    expect(w!).toBeGreaterThan(700);
    expect(h!).toBeGreaterThan(200);
  });
});

describe("text is never cut off", () => {
  const p = sampleProject();

  it("draws relationship labels after every box so they cannot be painted over", () => {
    for (const d of [contextDiagram(p), containerDiagram(p), componentDiagram(p, "con_api"), codeDiagram(p, "cmp_reserve")]) {
      const lines = d.svg.split("\n");
      const lastBox = lines.findLastIndex((l) => l.includes("</text>") && l.includes("font-weight=\"700\"") && l.includes("text-anchor=\"middle\""));
      const labelIndex = lines.findIndex((l) => l.includes("labelled") === false && /opacity="0\.96"/.test(l));
      expect(labelIndex, `${d.title} draws an edge label`).toBeGreaterThan(-1);
      expect(labelIndex, `${d.title} label must come after the boxes`).toBeGreaterThan(0);
      // the relationship text itself must appear after the last box outline
      const firstLabelText = lines.findIndex((l) => /opacity="0\.96"/.test(l));
      expect(firstLabelText).toBeGreaterThan(lastBox - 1);
    }
  });

  it("keeps every edge label inside the canvas", () => {
    for (const d of [contextDiagram(p), containerDiagram(p), componentDiagram(p, "con_api")]) {
      const w = Number(d.svg.match(/width="(\d+)" height="(\d+)"/)![1]);
      for (const m of d.svg.matchAll(/<rect x="(-?\d+)" y="(-?\d+)" width="(\d+)" height="(\d+)" rx="4" fill="#ffffff" opacity="0\.96"/g)) {
        const x = Number(m[1]);
        const width = Number(m[3]);
        expect(x, "label left edge inside canvas").toBeGreaterThanOrEqual(0);
        expect(x + width, "label right edge inside canvas").toBeLessThanOrEqual(w);
      }
    }
  });

  it("keeps relationship text complete, wrapped only when it must be", () => {
    const svg = containerDiagram(p).svg;
    // the full label must appear, either on one line or split across two
    const flat = svg.replace(/<\/text>\s*<text[^>]*>/g, " ");
    expect(flat).toContain("publishes order events to / HTTPS");
  });

  it("wraps the empty-state message inside its placeholder box", () => {
    const q = sampleProject();
    q.elements = [];
    q.relationships = [];
    const svg = containerDiagram(q).svg;
    const w = Number(svg.match(/width="(\d+)" height="(\d+)"/)![1]);
    for (const m of svg.matchAll(/<text x="(\d+)" y="\d+" font-size="14"[^>]*>([^<]*)<\/text>/g)) {
      expect(Number(m[1])).toBeLessThanOrEqual(w);
      expect(m[2].length).toBeGreaterThan(0);
    }
    expect(svg).toContain("Add containers");
  });
});

describe("the other C4 diagram types", () => {
  const p = sampleProject();

  it("draws data stores as cylinders, not arcs that scale past their box", () => {
    const p = sampleProject();
    const svg = containerDiagram(p).svg;
    // two ellipses plus a body: the cylinder parts
    expect(svg).toContain("<ellipse");
    expect((svg.match(/<ellipse/g) ?? []).length).toBeGreaterThanOrEqual(2);
    // no arc command is used for data stores: an arc whose radius is smaller
    // than its chord is scaled up by the renderer and escapes the box
    expect(svg).not.toMatch(/<path d="M \d+ \d+ A \d+ \d+ 0 0 1/);
  });

  it("draws people as rounded rectangles, not full pills", () => {
    const svg = contextDiagram(sampleProject()).svg;
    expect(svg).toContain('rx="10"');
    expect(svg).not.toContain('rx="55"');
  });

  it("draws software systems with their dashed boundary", () => {
    const svg = contextDiagram(sampleProject()).svg;
    expect(svg).toContain('stroke-dasharray="8 5"');
  });

  it("renders a system landscape with one boundary per software system", () => {
    const d = landscapeDiagram(p);
    expect(d.svg.startsWith("<svg")).toBe(true);
    expect(d.title).toContain("landscape");
    // group boundaries are dashed containers drawn behind their system
    expect(d.svg).toContain("stroke-dasharray=\"7 5\"");
  });

  it("renders a deployment diagram with nested environment boundaries", () => {
    const d = deploymentDiagram(p);
    expect(d.svg).toContain("Deployment Node");
    expect(d.svg).toContain("Production");
    expect(d.svg).toContain("Staging");
  });

  it("renders a UML-style code diagram with attributes, operations and a package boundary", () => {
    const d = codeDiagram(p, "cmp_reserve");
    expect(d.svg).toContain("StockSystemAdapter");
    expect(d.svg).toContain("reserve(lines: Line[])");
    expect(d.svg).toContain("+ sku: string");
    expect(d.svg).toContain("marker-end=\"url(#open)\"");
  });

  it("shows a multiplicity on code relationships", () => {
    const d = codeDiagram(p, "cmp_reserve");
    expect(d.svg).toContain("1..*");
  });

  it("returns an explicit empty state for a code diagram with no code elements", () => {
    const d = codeDiagram(p, "cmp_validate");
    expect(d.svg).toContain("Optional level");
  });

  it("renders a dynamic diagram with numbered steps and lifelines", () => {
    const d = dynamicDiagram(p, "scn_order");
    expect(d.svg).toContain("Dynamic diagram");
    expect(d.svg).toContain("1. submit order");
    expect(d.svg).toContain("stroke-dasharray=\"5 4\"");
  });

  it("renders an empty state for an unknown scenario rather than throwing", () => {
    const d = dynamicDiagram(p, "nope");
    expect(d.svg).toContain("Add steps with participants");
  });

  it("keeps every diagram inside its canvas", () => {
    const all = [
      landscapeDiagram(p),
      deploymentDiagram(p),
      codeDiagram(p, "cmp_reserve"),
      dynamicDiagram(p, "scn_order"),
    ];
    for (const d of all) {
      const m = d.svg.match(/width="(\d+)" height="(\d+)"/);
      const w = Number(m![1]);
      const h = Number(m![2]);
      for (const r of boxes(d.svg)) {
        expect(r.x + r.w).toBeLessThanOrEqual(w);
        expect(r.y + r.h).toBeLessThanOrEqual(h);
      }
    }
  });

  it("does not overlap deployment containers", () => {
    const rects = boxes(deploymentDiagram(p).svg);
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) expect(overlapsIn([rects[i]], rects[j]), `${i} vs ${j}`).toBe(false);
    }
  });
});
