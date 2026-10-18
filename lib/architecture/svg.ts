import type { ArchitectureProject, Element, Relationship } from "./model";

/**
 * Deterministic SVG C4 diagram renderer.
 *
 * Choices:
 * - SVG is generated on the server so diagrams stay crisp vectors in print/PDF
 *   and work with no network and no client JavaScript.
 * - Notation follows https://c4model.com/diagrams/notation: name, [type] and a
 *   short description per element, technology on containers and components, and
 *   a label (plus protocol where it applies) on every relationship.
 * - Layout is deterministic, so the same model always renders identically and
 *   boxes cannot drift between renders.
 * - All user text is XML-escaped; the output is safe to embed in HTML.
 */

export const C4_SOURCES = [
  { page: "https://c4model.com/diagrams", note: "System context, container, component and code diagrams." },
  { page: "https://c4model.com/diagrams/notation", note: "Element notation: name, type, description, technology." },
  { page: "https://c4model.com/diagrams/checklist", note: "Diagram checklist used by the quality checks." },
  { page: "https://c4model.com/abstractions", note: "Software system, container, component and code abstractions." },
] as const;

export function escapeXml(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function typeLabel(e: Element): string {
  switch (e.kind) {
    case "person": return "Person";
    case "software-system": return "Software System";
    case "external-system": return "External System";
    case "container": return "Container";
    case "component": return "Component";
    case "code": return "Code Element";
    case "data-store": return "Data Store";
    case "deployment-node": return "Deployment Node";
    case "infrastructure-node": return "Infrastructure Node";
    default: return "Element";
  }
}

/**
 * Text is fitted by measured width, not by character count.
 *
 * The previous helper wrapped on a character count and then silently dropped
 * whatever did not fit (`slice(0, 3)`), which is what cut text off mid-word.
 * These helpers wrap on real width and end with an ellipsis, so a label is
 * either fully readable or visibly shortened, never silently missing.
 */
const CHAR_W = 0.56; // mean glyph width as a fraction of font size (Segoe UI / Helvetica)

export function textWidth(text: string, fontSize: number): number {
  return String(text ?? "").length * fontSize * CHAR_W;
}

/** Truncate to fit, adding an ellipsis when characters are dropped. */
export function fitText(text: string, maxWidth: number, fontSize: number): string {
  const s = String(text ?? "");
  if (textWidth(s, fontSize) <= maxWidth) return s;
  let out = s;
  while (out.length > 1 && textWidth(`${out}...`, fontSize) > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out.trimEnd()}...`;
}

/** Wrap into at most `maxLines` lines measured in pixels. Never silently drops text. */
export function wrapToWidth(text: string, maxWidth: number, fontSize: number, maxLines = 3): string[] {
  const words = String(text ?? "").split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (textWidth(next, fontSize) <= maxWidth) {
      line = next;
      continue;
    }
    if (line) lines.push(line);
    // a single word wider than the box must be broken, not dropped
    let word = w;
    while (textWidth(word, fontSize) > maxWidth && word.length > 1) {
      let cut = word.length - 1;
      while (cut > 1 && textWidth(word.slice(0, cut), fontSize) > maxWidth) cut--;
      lines.push(word.slice(0, cut));
      word = word.slice(cut);
    }
    line = word;
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  kept[maxLines - 1] = fitText(`${kept[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`, maxWidth, fontSize);
  return kept;
}

/** Vertical space an element's text needs inside a box of `boxWidth`. */
export function contentHeight(e: Element, boxWidth: number, minLines = 2): number {
  const inner = boxWidth - 24;
  const nameLines = wrapToWidth(e.name || " ", inner, 13, 2);
  const descLines = wrapToWidth(e.description || e.responsibility || "No description recorded", inner, 11, 3);
  let h = 8 + nameLines.length * 16 + 15 + descLines.length * 14;
  if (e.technology) h += 20;
  return Math.max(96, h);
}

const C = {
  bg: "#ffffff",
  border: "#334155",
  text: "#0f172a",
  muted: "#475569",
  accent: "#0f766e",
  fillPerson: "#fef3c7",
  fillSystem: "#e0f2fe",
  fillContainer: "#dcfce7",
  fillStore: "#f3e8ff",
  edge: "#64748b",
  unverified: "#b45309",
  fillExternal: "#e2e8f0",
};

const PALETTE = [C.fillSystem, C.fillContainer, C.fillStore, "#fee2e2", C.fillPerson, "#ecfccb"];

/**
 * Fill is chosen by element kind, not by draw order, so the key always matches
 * the boxes. Index-based colouring made the legend lie about the diagram.
 */
function fillFor(kind: Element["kind"]): string {
  switch (kind) {
    case "person": return C.fillPerson;
    case "software-system": return C.fillSystem;
    case "external-system": return C.fillExternal;
    case "container": return C.fillContainer;
    case "data-store": return C.fillStore;
    case "component": return "#ecfccb";
    case "code": return "#fce7f3";
    case "deployment-node": return "#f8fafc";
    case "infrastructure-node": return "#eef2f7";
    default: return C.fillSystem;
  }
}

interface Box {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  element: Element;
}

export interface DiagramSpec {
  title: string;
  caption: string;
  source: string;
  svg: string;
}

export interface RenderOptions {
  title: string;
  caption: string;
  source: string;
  edges?: Relationship[];
  emptyMessage?: string;
  /** Nested boundaries drawn behind their contents (deployment nodes, system groups). */
  groupBoxes?: Box[];
  /** Extra edges drawn for scope only, not from the model. */
  extraEdges?: Relationship[];
}

function emptySvg(p: ArchitectureProject, title: string, message: string, desc: string): string {
  const width = 700;
  const height = 300;
  const lines = wrapToWidth(message, width - 120, 14, 3);
  const boxH = Math.max(110, lines.length * 18 + 50);
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`,
    `<title>${escapeXml(title)}</title><desc>${escapeXml(desc)}</desc>`,
    `<rect width="${width}" height="${height}" fill="${C.bg}"/>`,
    `<text x="40" y="44" font-size="22" font-weight="700" fill="${C.text}">${escapeXml(fitText(title, width - 80, 22))}</text>`,
    `<text x="40" y="68" font-size="13" fill="${C.muted}">${escapeXml(fitText(p.name || "Untitled project", width - 80, 13))}</text>`,
    `<rect x="40" y="110" width="${width - 80}" height="${boxH}" fill="none" stroke="${C.border}" stroke-dasharray="6 4"/>`,
    ...lines.map((l, i) => `<text x="${width / 2}" y="${140 + i * 18}" font-size="14" fill="${C.muted}" text-anchor="middle">${escapeXml(l)}</text>`),
    `</svg>`,
  ].join("\n");
}

/**
 * System landscape: a system context diagram without a single focus.
 * Every software system in scope is drawn as a peer inside its own dashed
 * boundary, with the shared people and external systems around them.
 */
export function landscapeDiagram(p: ArchitectureProject): DiagramSpec {
  const systems = p.elements.filter((e) => e.kind === "software-system");
  const people = p.elements.filter((e) => e.kind === "person" || e.kind === "external-system");
  const boxes: Box[] = [];

  const perRow = Math.max(1, Math.min(3, systems.length));
  const boxW = 300;
  const boxH = 150;
  const groupBoxes: Box[] = [];
  const peopleY = 110 + Math.ceil(systems.length / perRow) * (boxH + 90) + 40;

  systems.forEach((s, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const groupX = 70 + col * (boxW + 70);
    const groupY = 110 + row * (boxH + 90);
    groupBoxes.push({
      id: `group_${s.id}`,
      x: groupX,
      y: groupY,
      w: boxW,
      h: boxH,
      element: { ...s, kind: "deployment-node", description: "Software system" },
    });
    boxes.push({
      id: s.id,
      x: groupX + 20,
      y: groupY + 34,
      w: boxW - 40,
      h: boxH - 58,
      element: s,
    });
  });

  people.forEach((e, i) => {
    boxes.push({ id: e.id, x: 70 + i * (280 + 50), y: peopleY, w: 280, h: 110, element: e });
  });

  return render(p, boxes, {
    title: "System landscape diagram",
    caption: "All software systems in scope at the same zoom level, showing how they relate and which people and external systems they share.",
    source: "System landscape",
    emptyMessage: "Add at least one software system to draw the landscape.",
    groupBoxes,
  });
}

/**
 * Deployment: nested deployment nodes (environments) containing instances of
 * containers, data stores and infrastructure, per the UML deployment view that
 * the C4 deployment diagram is based on.
 */
export function deploymentDiagram(p: ArchitectureProject): DiagramSpec {
  const nodes = p.elements.filter((e) => e.kind === "deployment-node" || e.kind === "infrastructure-node");
  const runnable = p.elements.filter((e) => (e.kind === "container" || e.kind === "data-store") && e.parentId && nodes.some((n) => n.id === e.parentId));

  const boxes: Box[] = [];
  const groupBoxes: Box[] = [];
  let cursorX = 60;
  let cursorY = 120;

  for (const n of nodes) {
    const children = runnable.filter((r) => r.parentId === n.id);
    const childW = 250;
    const childH = 120;
    const nodeW = Math.max(460, children.length * (childW + 40) + 60);
    const nodeH = children.length ? 230 : 150;

    if (cursorX + nodeW > 1600) {
      cursorX = 60;
      cursorY += 290;
    }

    const envBox: Box = { id: `env_${n.id}`, x: cursorX, y: cursorY, w: nodeW, h: nodeH, element: { ...n, description: n.description || "Deployment node" } };
    groupBoxes.push(envBox);
    boxes.push(envBox);

    children.forEach((c, i) => {
      boxes.push({
        id: c.id,
        x: cursorX + 30 + i * (childW + 40),
        y: cursorY + 64,
        w: childW,
        h: childH,
        element: { ...c, instance: true },
      });
    });

    cursorX += nodeW + 60;
  }

  const ids = new Set(boxes.map((b) => b.id));
  const edges = p.relationships.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId));

  return render(p, boxes, {
    title: "Deployment diagram",
    caption: "Where each instance runs: environments drawn as deployment nodes, with the containers, data stores and infrastructure inside them.",
    source: "Deployment",
    emptyMessage: "Add deployment nodes and assign containers to them to draw the deployment view.",
    edges,
    groupBoxes,
  });
}

export function dynamicDiagram(p: ArchitectureProject, scenarioId: string): DiagramSpec {
  const scenario = p.scenarios.find((s) => s.id === scenarioId);
  const name = scenario?.name ?? "Scenario";
  const steps = scenario?.steps ?? [];
  const actorIds = [...new Set(steps.flatMap((s) => s.actorIds))];
  const actors = p.elements.filter((e) => actorIds.includes(e.id));

  if (actors.length === 0) {
    return {
      title: `Dynamic diagram - ${name}`,
      caption: "No participants recorded for this scenario.",
      source: "Dynamic",
      svg: emptySvg(p, `Dynamic diagram - ${name}`, "Add steps with participants to draw this scenario.", "Dynamic diagram - no data"),
    };
  }

  const actorH = 46;
  const laneW = 210;
  const left = 210;
  const top = 120;
  const rowH = 54;
  const width = left + actors.length * laneW + 60;
  const height = top + steps.length * rowH + 120;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(`Dynamic diagram - ${name}`)}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
  parts.push(`<title>${escapeXml(`Dynamic diagram - ${name}`)}</title>`);
  parts.push(`<desc>${escapeXml("Numbered interactions between participants over time.")}</desc>`);
  parts.push(`<rect width="${width}" height="${height}" fill="${C.bg}"/>`);
  parts.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${C.edge}"/></marker></defs>`);
  parts.push(`<text x="40" y="44" font-size="22" font-weight="700" fill="${C.text}">Dynamic diagram</text>`);
  parts.push(`<text x="40" y="68" font-size="13" fill="${C.muted}">${escapeXml(`${p.name || "Untitled project"} - ${name}`)}</text>`);

  // lifelines
  actors.forEach((a, i) => {
    const x = left + i * laneW + laneW / 2;
    parts.push(`<rect x="${x - 90}" y="${top - actorH}" width="180" height="${actorH}" rx="6" fill="${fillFor(a.kind)}" stroke="${C.border}" stroke-width="1.6"/>`);
    parts.push(`<text x="${x}" y="${top - actorH + 19}" font-size="13" font-weight="700" fill="${C.text}" text-anchor="middle">${escapeXml(a.name)}</text>`);
    parts.push(`<text x="${x}" y="${top - actorH + 34}" font-size="10" fill="${C.muted}" text-anchor="middle">[${escapeXml(typeLabel(a))}]</text>`);
    parts.push(`<line x1="${x}" y1="${top}" x2="${x}" y2="${height - 90}" stroke="${C.border}" stroke-width="1" stroke-dasharray="5 4"/>`);
  });

  const xOf = (id: string) => left + actors.findIndex((a) => a.id === id) * laneW + laneW / 2;
  steps.forEach((s, i) => {
    const y = top + 30 + i * rowH;
    const first = s.actorIds[0];
    const second = s.actorIds[1] ?? s.actorIds[0];
    const x1 = xOf(first);
    const x2 = xOf(second);
    parts.push(`<text x="46" y="${y + 4}" font-size="11" font-weight="700" fill="${C.accent}">${i + 1}. ${escapeXml(s.message)}</text>`);
    parts.push(`<line x1="${Math.min(x1, x2)}" y1="${y - 14}" x2="${Math.max(x1, x2)}" y2="${y - 14}" stroke="${C.edge}" stroke-width="1.6" marker-end="url(#arrow)"/>`);
    if (s.note) parts.push(`<text x="${(x1 + x2) / 2}" y="${y - 20}" font-size="10" fill="${C.muted}" text-anchor="middle">${escapeXml(s.note)}</text>`);
  });

  parts.push(legend(width, height - 52));
  parts.push(`<text x="40" y="${height - 14}" font-size="11" fill="${C.muted}">${escapeXml(fitText("One scenario over time, numbered in order. Fills show what is verified and what is a hypothesis.", width - 80, 11))}</text>`);
  parts.push("</svg>");
  return {
    svg: parts.join("\n"),
    title: `Dynamic diagram - ${name}`,
    caption: "One scenario over time, with numbered interactions between participants.",
    source: "Dynamic",
  };
}

function grid(elements: Element[], perRow: number, w: number, h: number): Box[] {
  // Row height follows the tallest box so a long name or description grows the
  // box instead of spilling out of it.
  const heights = elements.map((e) => Math.max(h, contentHeight(e, w)));
  const rowHeights: number[] = [];
  for (let i = 0; i < elements.length; i += perRow) {
    rowHeights.push(Math.max(...heights.slice(i, i + perRow)));
  }
  const boxByIndex: Box[] = [];
  let y = 110;
  for (let i = 0; i < elements.length; i += perRow) {
    const rowH = rowHeights[Math.floor(i / perRow)];
    elements.slice(i, i + perRow).forEach((e, j) => {
      boxByIndex.push({ id: e.id, x: 80 + j * (w + 70), y, w, h: heights[i + j], element: e });
    });
    y += rowH + 90;
  }
  return boxByIndex;
}

export function contextDiagram(p: ArchitectureProject): DiagramSpec {
  const center = p.elements.filter((e) => e.kind === "software-system");
  const around = p.elements.filter((e) => e.kind === "person" || e.kind === "external-system");
  const midX = 620;
  const midY = 400;
  const boxes: Box[] = center.map((e, i) => ({ id: e.id, x: midX - 210 + i * 20, y: midY - 70, w: 420, h: 140, element: e }));
  around.forEach((e, i) => {
    const angle = (i / Math.max(1, around.length)) * Math.PI * 2 - Math.PI / 2;
    boxes.push({
      id: e.id,
      x: Math.round(midX + Math.cos(angle) * 460 - 140),
      y: Math.round(midY + Math.sin(angle) * 270 - 55),
      w: 280,
      h: 110,
      element: e,
    });
  });
  return render(p, boxes, {
    title: "System context diagram",
    caption: "The system, the people who use it, and the external systems it depends on. No technology detail at this level.",
    source: "Level 1 - System context",
    emptyMessage: "Add a software system, people or external systems to draw this diagram.",
  });
}

export function containerDiagram(p: ArchitectureProject): DiagramSpec {
  const containers = p.elements.filter((e) => e.kind === "container" || e.kind === "data-store");
  const ids = new Set(containers.map((c) => c.id));
  const edges = p.relationships.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId));
  return render(p, grid(containers, 3, 300, 140), {
    title: "Container diagram",
    caption: "Applications and data stores inside the system boundary, with the technology and the communication between them.",
    source: "Level 2 - Container",
    edges,
    emptyMessage: "Add containers to draw this diagram.",
  });
}

export function componentDiagram(p: ArchitectureProject, containerId: string): DiagramSpec {
  const container = p.elements.find((e) => e.id === containerId);
  const components = p.elements.filter((e) => e.kind === "component" && e.parentId === containerId);
  const ids = new Set([containerId, ...components.map((c) => c.id)]);
  const edges = p.relationships.filter((r) => ids.has(r.sourceId) && ids.has(r.targetId));
  return render(p, grid(components, 2, 330, 140), {
    title: `Component diagram - ${container?.name ?? "container"}`,
    caption: `Components inside ${container?.name ?? "the chosen container"}, with their responsibilities and protocols.`,
    source: "Level 3 - Component",
    edges,
    emptyMessage: "Add components inside this container to draw this diagram.",
  });
}

/**
 * Level 4 (code): UML-style class boxes inside a package boundary, showing
 * only the attributes and operations that tell the story.
 */
export function codeDiagram(p: ArchitectureProject, parentId: string): DiagramSpec {
  const parent = p.elements.find((e) => e.id === parentId);
  const parts = p.elements.filter((e) => e.kind === "code" && e.parentId === parentId);
  const title = `Code diagram - ${parent?.name ?? "component"}`;

  if (parts.length === 0) {
    return {
      title,
      caption: "Optional level. Add code elements to show how this component is implemented.",
      source: "Level 4 - Code",
      svg: emptySvg(p, title, "Optional level: no code elements recorded for this component.", "Code diagram with no elements"),
    };
  }

  const pkg = parent?.technology || parent?.name || "package";
  const boxW = 300;
  const boxH = 60 + (p.elements.find((e) => e.id === parts[0].id)?.attributes?.length ?? 0) * 14
    + (p.elements.find((e) => e.id === parts[0].id)?.methods?.length ?? 0) * 14 + 30;

  const boxes: Box[] = (() => {
    const heights = parts.map((c) => Math.max(110, 62 + (c.attributes?.length ?? 0) * 15 + (c.methods?.length ?? 0) * 15));
    const rowHeights: number[] = [];
    for (let i = 0; i < parts.length; i += 2) rowHeights.push(Math.max(...heights.slice(i, i + 2)));
    const out: Box[] = [];
    for (let i = 0; i < parts.length; i += 2) {
      const y = 150 + rowHeights.slice(0, Math.floor(i / 2)).reduce((s, v) => s + v + 70, 0);
      parts.slice(i, i + 2).forEach((c, j) => {
        out.push({ id: c.id, x: 90 + j * (boxW + 90), y, w: boxW, h: heights[i + j], element: c });
      });
    }
    return out;
  })();

  const maxX = Math.max(400, ...boxes.map((b) => b.x + b.w));
  const maxY = Math.max(260, ...boxes.map((b) => b.y + b.h));
  const width = maxX + 110;
  const height = maxY + 120;

  const parts_ = 1;
  void parts_;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(title)}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
  out.push(`<title>${escapeXml(title)}</title>`);
  out.push(`<desc>${escapeXml("Code-level view of a component, as a package containing class boxes.")}</desc>`);
  out.push(`<rect width="${width}" height="${height}" fill="${C.bg}"/>`);
  out.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${C.edge}"/></marker>
<marker id="open" markerWidth="12" markerHeight="12" refX="11" refY="5" orient="auto"><path d="M0,0 L12,5 L0,10 z" fill="none" stroke="${C.edge}" stroke-width="1.4"/></marker></defs>`);
  out.push(`<text x="40" y="44" font-size="22" font-weight="700" fill="${C.text}">${escapeXml(fitText(title, width - 80, 22))}</text>`);
  out.push(`<text x="40" y="68" font-size="13" fill="${C.muted}">${escapeXml(fitText(p.name || "Untitled project", width - 80, 13))}</text>`);

  // package boundary
  const pkgY = 96;
  out.push(`<path d="M 60 ${pkgY} L 150 ${pkgY} L 160 ${pkgY + 14} L ${maxX + 40} ${pkgY + 14} L ${maxX + 40} ${maxY + 30} L 60 ${maxY + 30} Z" fill="none" stroke="${C.text}" stroke-width="2"/>`);
  out.push(`<rect x="60" y="${pkgY - 14}" width="${Math.min(520, 40 + pkg.length * 7)}" height="20" fill="${C.bg}"/>`);
  out.push(`<text x="66" y="${pkgY + 1}" font-size="12" font-weight="700" fill="${C.text}">${escapeXml(pkg)}</text>`);

  const byId = new Map(boxes.map((b) => [b.id, b]));
  const links: Relationship[] = [];
  for (const r of p.relationships) {
    const a = byId.get(r.sourceId);
    const b = byId.get(r.targetId);
    if (!a || !b) continue;
    out.push(classEdge(a, b));
    links.push(r);
  }

  for (const b of boxes) out.push(classBox(b));

  for (const r of links) {
    out.push(classEdgeLabel(byId.get(r.sourceId)!, byId.get(r.targetId)!, r, width - 20));
  }

  out.push(codeLegend(width, height - 52));
  out.push(`<text x="40" y="${height - 14}" font-size="11" fill="${C.muted}">${escapeXml(fitText("Optional level. Show only the attributes and operations that carry the story.", width - 80, 11))}</text>`);
  out.push("</svg>");

  return {
    svg: out.join("\n"),
    title,
    caption: `Code-level view of ${parent?.name ?? "the component"}, showing only the attributes and operations that matter.`,
    source: "Level 4 - Code",
  };
}

function classBox(b: Box): string {
  const e = b.element;
  const cx = b.x + b.w / 2;
  const parts: string[] = [];
  parts.push(`<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="4" fill="${fillFor(e.kind)}" stroke="${C.border}" stroke-width="1.6"/>`);
  parts.push(`<line x1="${b.x}" y1="${b.y + 28}" x2="${b.x + b.w}" y2="${b.y + 28}" stroke="${C.border}" stroke-width="1.2"/>`);
  parts.push(`<circle cx="${b.x + 18}" cy="${b.y + 14}" r="8" fill="${C.bg}" stroke="${C.border}" stroke-width="1.2"/>`);
  parts.push(`<text x="${b.x + 18}" y="${b.y + 18}" font-size="9" fill="${C.muted}" text-anchor="middle">${e.kind === "code" ? "C" : "I"}</text>`);
  parts.push(`<text x="${b.x + 34}" y="${b.y + 19}" font-size="13" font-weight="700" fill="${C.text}">${escapeXml(e.name)}</text>`);

  let y = b.y + 46;
  const inner = b.w - 24;
  for (const a of e.attributes ?? []) {
    // Accept "+ x" / "- x" or a bare name; do not double the visibility marker.
    const text = /^[+-]/.test(a.trim()) ? a.trim() : `- ${a.trim()}`;
    parts.push(`<text x="${b.x + 12}" y="${y}" font-size="11" fill="${C.muted}">${escapeXml(fitText(text, inner, 11))}</text>`);
    y += 15;
  }
  if ((e.attributes?.length ?? 0) > 0) {
    parts.push(`<line x1="${b.x}" y1="${y - 9}" x2="${b.x + b.w}" y2="${y - 9}" stroke="${C.border}" stroke-width="0.8" opacity="0.5"/>`);
    y += 6;
  }
  for (const m of e.methods ?? []) {
    parts.push(`<text x="${b.x + 12}" y="${y}" font-size="11" fill="${C.text}">${escapeXml(fitText(m, inner, 11))}</text>`);
    y += 15;
  }
  if (e.unverified) {
    parts.push(`<text x="${cx}" y="${b.y + b.h - 4}" font-size="10" fill="${C.unverified}" text-anchor="middle">unverified</text>`);
  }
  return parts.join("\n");
}

function classEdge(a: Box, b: Box): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h / 2;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.edge}" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#open)"/>`;
}

function classEdgeLabel(a: Box, b: Box, r: Relationship, maxX: number): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h / 2;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h / 2;
  const lines = wrapToWidth([r.label, r.multiplicity ?? ""].filter(Boolean).join(" "), Math.max(120, a.w / 2 + b.w / 2), 11, 2);
  const w = Math.max(40, Math.max(...lines.map((l) => l.length)) * 6.1) + 12;
  const mx = Math.min(Math.max(Math.round((x1 + x2) / 2), Math.round(w / 2) + 8), maxX - Math.round(w / 2) - 8);
  const my = Math.round((y1 + y2) / 2);
  const h = lines.length * 13 + 6;
  const top = my - Math.round(h / 2);
  return [
    `<rect x="${mx - Math.round(w / 2)}" y="${top}" width="${Math.round(w)}" height="${h}" rx="4" fill="${C.bg}" opacity="0.96"/>`,
    ...lines.map((l, i) => `<text x="${mx}" y="${top + 13 + i * 13}" font-size="11" fill="${C.muted}" text-anchor="middle">${escapeXml(l)}</text>`),
  ].join("\n");
}

function render(p: ArchitectureProject, boxes: Box[], opts: RenderOptions): DiagramSpec {
  const visible = new Set(boxes.map((b) => b.id));
  const edges = (opts.edges ?? p.relationships).filter((r) => visible.has(r.sourceId) || visible.has(r.targetId));
  const content = boxes.filter((b) => !(opts.groupBoxes ?? []).some((g) => g.id === b.id));
  const groups = opts.groupBoxes ?? [];
  const maxX = Math.max(400, ...boxes.map((b) => b.x + b.w), ...groups.map((g) => g.x + g.w + 20));
  const maxY = Math.max(260, ...boxes.map((b) => b.y + b.h), ...groups.map((g) => g.y + g.h + 20));
  const width = maxX + 90;
  const height = maxY + 130;

  const parts: string[] = [];
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(opts.title)}" font-family="Segoe UI, Helvetica, Arial, sans-serif">`);
  parts.push(`<title>${escapeXml(opts.title)}</title>`);
  parts.push(`<desc>${escapeXml(opts.caption)}</desc>`);
  parts.push(`<rect width="${width}" height="${height}" fill="${C.bg}"/>`);
  parts.push(`<defs><marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="${C.edge}"/></marker></defs>`);
  parts.push(`<text x="40" y="44" font-size="22" font-weight="700" fill="${C.text}">${escapeXml(fitText(opts.title, width - 80, 22))}</text>`);
  parts.push(`<text x="40" y="68" font-size="13" fill="${C.muted}">${escapeXml(fitText(p.name || "Untitled project", width - 80, 13))}</text>`);

  if (content.length === 0) {
    const boxW = width - 80;
    const message = opts.emptyMessage ?? "No elements recorded yet.";
    const lines = wrapToWidth(message, boxW - 40, 14, 3);
    const boxH = Math.max(110, lines.length * 18 + 50);
    parts.push(`<rect x="40" y="110" width="${boxW}" height="${boxH}" fill="none" stroke="${C.border}" stroke-dasharray="6 4"/>`);
    lines.forEach((line, i) => {
      parts.push(`<text x="${Math.round(width / 2)}" y="${140 + i * 18}" font-size="14" fill="${C.muted}" text-anchor="middle">${escapeXml(line)}</text>`);
    });
  }

  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const drawn: Relationship[] = [];
  for (const r of [...edges, ...(opts.extraEdges ?? [])]) {
    const a = boxById.get(r.sourceId);
    const b = boxById.get(r.targetId);
    if (!a || !b) continue;
    parts.push(edgeLine(a, b, r));
    drawn.push(r);
  }

  // Nested boundaries sit behind everything they contain.
  for (const g of opts.groupBoxes ?? []) {
    parts.push(`<rect x="${g.x - 14}" y="${g.y - 22}" width="${g.w + 28}" height="${g.h + 36}" rx="10" fill="none" stroke="${C.border}" stroke-width="1.2" stroke-dasharray="7 5"/>`);
    parts.push(`<rect x="${g.x - 14}" y="${g.y - 22}" width="${g.w + 28}" height="22" rx="6" fill="${C.bg}" stroke="${C.border}" stroke-width="1.2"/>`);
    parts.push(`<text x="${g.x - 4}" y="${g.y - 7}" font-size="11" font-weight="700" fill="${C.text}">${escapeXml(g.element.name)}</text>`);
    parts.push(`<text x="${g.x + g.w + 8}" y="${g.y - 7}" font-size="10" fill="${C.muted}" text-anchor="end">${escapeXml(typeLabel(g.element))}</text>`);
  }

  boxes.forEach((b) => {
    if ((opts.groupBoxes ?? []).some((g) => g.id === b.id)) return;
    parts.push(boxShape(b, fillFor(b.element.kind)));
  });

  // Labels last, so a box can never paint over the text that names it.
  for (const r of drawn) {
    const a = boxById.get(r.sourceId)!;
    const b = boxById.get(r.targetId)!;
    parts.push(edgeLabel(a, b, r, width - 20));
  }

  parts.push(legend(width, height - 52));
  parts.push(`<text x="40" y="${height - 14}" font-size="11" fill="${C.muted}">${escapeXml(fitText(opts.caption, width - 80, 11))}</text>`);
  parts.push("</svg>");

  return { svg: parts.join("\n"), title: opts.title, caption: opts.caption, source: opts.source };
}

/**
 * Edges are split from their labels.
 *
 * Lines go under the boxes, but labels go on top. Drawing the label with the
 * line meant every box painted over the label sitting between two boxes, which
 * cut the relationship text in half.
 */
function edgeLine(a: Box, b: Box, _r: Relationship): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h / 2;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h / 2;
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${C.edge}" stroke-width="1.6" marker-end="url(#arrow)"/>`;
}

function edgeLabel(a: Box, b: Box, r: Relationship, maxX: number): string {
  const x1 = a.x + a.w / 2;
  const y1 = a.y + a.h / 2;
  const x2 = b.x + b.w / 2;
  const y2 = b.y + b.h / 2;
  const full = [r.label, r.multiplicity ?? r.technology].filter(Boolean).join(" / ");
  const lines = wrapToWidth(full, 260, 11, 2);
  const w = Math.max(40, Math.max(...lines.map((l) => l.length)) * 6.1) + 12;
  // keep the label fully inside the canvas
  const mx = Math.min(Math.max(Math.round((x1 + x2) / 2), Math.round(w / 2) + 8), maxX - Math.round(w / 2) - 8);
  const my = Math.round((y1 + y2) / 2);
  const h = lines.length * 13 + 6;
  const top = my - Math.round(h / 2);
  return [
    `<rect x="${mx - Math.round(w / 2)}" y="${top}" width="${Math.round(w)}" height="${h}" rx="4" fill="${C.bg}" opacity="0.96"/>`,
    ...lines.map((l, i) => `<text x="${mx}" y="${top + 13 + i * 13}" font-size="11" fill="${C.muted}" text-anchor="middle">${escapeXml(l)}</text>`),
  ].join("\n");
}

function boxShape(b: Box, fill: string): string {
  const stroke = `stroke="${C.border}" stroke-width="1.6"`;
  const cx = b.x + b.w / 2;
  let shape: string;
  if (b.element.kind === "person") {
    // C4 draws a person as a rounded rectangle, not a pill: a fully rounded
    // shape with rx = height reads as an oval rather than a person box.
    shape = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="10" fill="${fill}" ${stroke}/>`;
  } else if (b.element.kind === "data-store") {
    // Cylinder built from two ellipses and a body rect. An arc path cannot be
    // used here: SVG silently scales an arc radius up when it is smaller than
    // the chord, which produced a huge blob instead of a cylinder.
    const ry = Math.min(14, Math.round(b.h / 8));
    const cx = b.x + b.w / 2;
    const rx = b.w / 2;
    shape = [
      `<rect x="${b.x}" y="${b.y + ry}" width="${b.w}" height="${b.h - ry * 2}" fill="${fill}"/>`,
      `<ellipse cx="${cx}" cy="${b.y + b.h - ry}" rx="${rx}" ry="${ry}" fill="${fill}" ${stroke}/>`,
      `<ellipse cx="${cx}" cy="${b.y + ry}" rx="${rx}" ry="${ry}" fill="${fill}" ${stroke}/>`,
      `<rect x="${b.x}" y="${b.y + ry}" width="${b.w}" height="${b.h - ry * 2}" fill="none" ${stroke}/>`,
    ].join("");
  } else if (b.element.kind === "software-system") {
    shape = `<rect x="${b.x - 8}" y="${b.y - 8}" width="${b.w + 16}" height="${b.h + 16}" fill="none" stroke="${C.accent}" stroke-width="1.2" stroke-dasharray="8 5"/><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${fill}" ${stroke}/>`;
  } else {
    shape = `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="6" fill="${fill}" ${stroke}/>`;
  }

  const lines: string[] = [shape];
  const cap = b.element.kind === "data-store" ? Math.min(14, Math.round(b.h / 8)) : 0;
  const inner = b.w - 24;
  const nameLines = wrapToWidth(b.element.name || " ", inner, 13, 2);
  const descLines = wrapToWidth(
    b.element.description || b.element.responsibility || "No description recorded",
    inner,
    11,
    3,
  );

  let y = b.y + 26 + cap;
  nameLines.forEach((l, i) => {
    lines.push(`<text x="${cx}" y="${y + i * 16}" font-size="13" font-weight="700" fill="${C.text}" text-anchor="middle">${escapeXml(l)}</text>`);
  });
  y += nameLines.length * 16 + 3;
  lines.push(`<text x="${cx}" y="${y}" font-size="11" fill="${C.muted}" text-anchor="middle">[${escapeXml(fitText(typeLabel(b.element), inner, 11))}]</text>`);
  y += 17;
  descLines.forEach((l, i) => {
    lines.push(`<text x="${cx}" y="${y + i * 14}" font-size="11" fill="${C.muted}" text-anchor="middle">${escapeXml(l)}</text>`);
  });

  if (b.element.technology) {
    lines.push(`<text x="${cx}" y="${b.y + b.h - 16 - cap}" font-size="11" font-style="italic" fill="${C.accent}" text-anchor="middle">[${escapeXml(fitText(b.element.technology, inner, 11))}]</text>`);
  }
  if (b.element.unverified) {
    lines.push(`<text x="${cx}" y="${b.y + b.h - 2}" font-size="10" fill="${C.unverified}" text-anchor="middle">unverified</text>`);
  }
  return lines.join("\n");
}

function codeLegend(width: number, y: number): string {
  return [
    `<text x="40" y="${y}" font-size="11" font-weight="700" fill="${C.text}">Key</text>`,
    `<rect x="80" y="${y - 10}" width="26" height="13" rx="3" fill="#fce7f3" stroke="${C.border}" stroke-width="1"/>`,
    `<text x="114" y="${y}" font-size="11" fill="${C.muted}">class / interface</text>`,
    `<path d="M 260 ${y - 9} L 280 ${y - 9} L 284 ${y - 4} L 320 ${y - 4} L 320 ${y + 9} L 260 ${y + 9} Z" fill="none" stroke="${C.text}" stroke-width="1.4"/>`,
    `<text x="330" y="${y}" font-size="11" fill="${C.muted}">package boundary</text>`,
    `<line x1="480" y1="${y - 4}" x2="510" y2="${y - 4}" stroke="${C.edge}" stroke-width="1.4" stroke-dasharray="6 4" marker-end="url(#open)"/>`,
    `<text x="520" y="${y}" font-size="11" fill="${C.muted}">dependency</text>`,
  ].join("\n");
}

function legend(width: number, y: number): string {
  const items: [string, string][] = [
    ["Person", C.fillPerson],
    ["System", C.fillSystem],
    ["External system", C.fillExternal],
    ["Container", C.fillContainer],
    ["Data store", C.fillStore],
  ];
  const parts = [`<text x="40" y="${y}" font-size="11" font-weight="700" fill="${C.text}">Key</text>`];
  let x = 80;
  for (const [label, fill] of items) {
    if (x + 20 + textWidth(label, 11) > width - 120) break; // stop before running off the canvas
    parts.push(`<rect x="${x}" y="${y - 10}" width="14" height="12" rx="3" fill="${fill}" stroke="${C.border}" stroke-width="1"/>`);
    parts.push(`<text x="${x + 20}" y="${y}" font-size="11" fill="${C.muted}">${escapeXml(label)}</text>`);
    x += 34 + textWidth(label, 11);
  }
  const relLabel = "labelled relationship / protocol";
  if (x + 34 + textWidth(relLabel, 11) < width - 8) {
    parts.push(`<line x1="${x}" y1="${y - 4}" x2="${x + 26}" y2="${y - 4}" stroke="${C.edge}" stroke-width="1.6" marker-end="url(#arrow)"/>`);
    parts.push(`<text x="${x + 34}" y="${y}" font-size="11" fill="${C.muted}">${escapeXml(relLabel)}</text>`);
  }
  return parts.join("\n");
}
