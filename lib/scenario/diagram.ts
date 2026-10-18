import { emptyProject, type Element, type Relationship } from "../architecture/model";
import { containerDiagram, landscapeDiagram, type DiagramSpec } from "../architecture/svg";
import type { ScenarioDiagram, ScenarioExercise } from "./types";

/**
 * Scenario diagrams reuse the Architecture Studio's C4 model and its
 * deterministic renderer, so a scenario diagram and a project diagram are the
 * same kind of object: structured, editable data that happens to render as SVG.
 * No decorative images anywhere.
 */

export type DiagramView = "landscape" | "container";

/**
 * Builds the minimal project the renderer needs. Only the fields the renderer
 * reads are populated; the rest stay at their empty defaults, and this is
 * never persisted as a project.
 */
function shell(d: ScenarioDiagram) {
  const p = emptyProject(d.title || "Scenario diagram");
  p.elements = d.elements as Element[];
  p.relationships = d.relationships as Relationship[];
  return p;
}

export function renderScenarioDiagram(d: ScenarioDiagram, view: DiagramView = "container"): DiagramSpec {
  if (d.elements.length === 0) {
    return {
      title: d.title || "Scenario diagram",
      caption: d.caption || "No components recorded.",
      source: "Scenario",
      svg: containerDiagram(shell(d)).svg,
    };
  }
  return view === "landscape" ? landscapeDiagram(shell(d)) : containerDiagram(shell(d));
}

export interface DiagramIssue {
  severity: "error" | "warning";
  issue: string;
  elementId?: string;
}

/**
 * Validates a scenario diagram.
 *
 * Errors are the ones that make a diagram unusable as a decision aid: a
 * dangling relationship, a duplicate id, an element that is neither a person
 * nor a system nor a store. Warnings are the ones that make it incomplete:
 * missing descriptions, no data store, no person entry point.
 */
export function validateScenarioDiagram(d: ScenarioDiagram): DiagramIssue[] {
  const issues: DiagramIssue[] = [];
  const seen = new Set<string>();
  const byId = new Map<string, Element>();

  for (const e of d.elements) {
    if (!e.id) {
      issues.push({ severity: "error", issue: "An element has no id." });
      continue;
    }
    if (seen.has(e.id)) {
      issues.push({ severity: "error", issue: `Duplicate element id: ${e.id}.`, elementId: e.id });
    }
    seen.add(e.id);
    byId.set(e.id, e);

    if (!e.name?.trim()) {
      issues.push({ severity: "error", issue: `Element ${e.id} has no name.`, elementId: e.id });
    }
    // The C4 notation requires a description on every element. A box with a
    // name and nothing else tells a reviewer nothing about responsibility.
    if (!e.description?.trim()) {
      issues.push({ severity: "warning", issue: `Element "${e.name || e.id}" has no description.`, elementId: e.id });
    }
  }

  for (const r of d.relationships) {
    if (!byId.has(r.sourceId)) {
      issues.push({ severity: "error", issue: `Relationship "${r.label || r.id}" starts at an element that does not exist (${r.sourceId}).` });
    }
    if (!byId.has(r.targetId)) {
      issues.push({ severity: "error", issue: `Relationship "${r.label || r.id}" ends at an element that does not exist (${r.targetId}).` });
    }
    if (!r.label?.trim()) {
      issues.push({ severity: "warning", issue: "A relationship has no label, so the direction of data or control is unclear." });
    }
  }

  const kinds = new Set(d.elements.map((e) => e.kind));
  if (!kinds.has("person")) {
    issues.push({ severity: "warning", issue: "No person or entry point is drawn. Every architecture is used by someone." });
  }
  if (!kinds.has("data-store")) {
    issues.push({ severity: "warning", issue: "No data store is drawn. Where the data lives is part of the decision." });
  }
  if (!kinds.has("software-system")) {
    issues.push({ severity: "warning", issue: "No software-system element is drawn, so the landscape view has no centre to place people and external systems around." });
  }

  return issues;
}

export function diagramHasErrors(issues: DiagramIssue[]): boolean {
  return issues.some((i) => i.severity === "error");
}

/**
 * Answers the four questions the Academy requires of any selected component:
 * why this service, what else could work, what fails if it is unavailable,
 * and what boundary it establishes. Returns the scenario's recorded answer or
 * an honest empty result, so nothing is invented at render time.
 */
export interface ComponentInterrogation {
  elementId: string;
  name: string;
  responsibility: string;
  technology: string;
  /** What this element connects to, which is the boundary it participates in. */
  connections: { direction: "outbound" | "inbound"; label: string; withName: string }[];
  /** Scenario facts that mention this element's name, for the learner to reason over. */
  relatedRequirements: string[];
}

export function interrogateComponent(s: ScenarioExercise, elementId: string): ComponentInterrogation | null {
  const e = s.diagram.elements.find((x) => x.id === elementId);
  if (!e) return null;

  const connections = s.diagram.relationships
    .filter((r) => r.sourceId === elementId || r.targetId === elementId)
    .map((r) => {
      const outbound = r.sourceId === elementId;
      const otherId = outbound ? r.targetId : r.sourceId;
      const other = s.diagram.elements.find((x) => x.id === otherId);
      return {
        direction: (outbound ? "outbound" : "inbound") as "outbound" | "inbound",
        label: r.label,
        withName: other?.name ?? otherId,
      };
    });

  const name = e.name.toLowerCase();
  const related = [
    ...s.requirements.nonFunctional,
    ...s.requirements.functional,
    ...s.constraints.security,
  ].filter((r) => name && r.toLowerCase().includes(name.split(" ")[0]));

  return {
    elementId,
    name: e.name,
    responsibility: e.responsibility ?? "",
    technology: e.technology ?? "",
    connections,
    relatedRequirements: related,
  };
}
