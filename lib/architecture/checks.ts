import type { ArchitectureProject } from "./model";
import { adrRules } from "./validation";

export type CheckSeverity = "error" | "warning" | "heuristic";

export interface QualityCheck {
  id: string;
  severity: CheckSeverity;
  message: string;
  /** Where the finding came from: a c4model.com checklist item, or a local heuristic. */
  basis: "c4model" | "heuristic" | "policy";
}

const NOT_RECORDED = "not recorded";

/**
 * Deterministic checks shown on the review step. These warn; they never block
 * export, and a clean result never means "this design is correct or secure".
 */
export function runChecks(p: ArchitectureProject): QualityCheck[] {
  const out: QualityCheck[] = [];
  const push = (id: string, severity: CheckSeverity, message: string, basis: QualityCheck["basis"]) => out.push({ id, severity, message, basis });

  if (!p.name.trim()) push("name", "error", "Project name is missing.", "policy");

  // C4 checklist: elements need a name, a type and a short description.
  for (const e of p.elements) {
    if (!e.description.trim()) push(`desc-${e.id}`, "warning", `"${e.name}" has no description. The C4 notation expects a short description on every element.`, "c4model");
    if ((e.kind === "container" || e.kind === "component" || e.kind === "code") && !e.technology?.trim()) {
      push(`tech-${e.id}`, "warning", `Container "${e.name}" has no technology. The C4 notation shows technology on containers and components.`, "c4model");
    }
  }

  // C4 checklist: every relationship carries a label; containers/components also a protocol.
  for (const r of p.relationships) {
    const nameOf = (id: string) => p.elements.find((e) => e.id === id)?.name ?? id;
    if (!r.label.trim()) push(`label-${r.id}`, "warning", `The relationship from "${nameOf(r.sourceId)}" to "${nameOf(r.targetId)}" has no label. Relationships should read as a verb phrase.`, "c4model");
    const touchesCode = [r.sourceId, r.targetId].some((id) => {
      const e = p.elements.find((x) => x.id === id);
      return e && (e.kind === "container" || e.kind === "component" || e.kind === "code");
    });
    if (touchesCode && !r.technology?.trim()) {
      push(`proto-${r.id}`, "warning", `The relationship between "${nameOf(r.sourceId)}" and "${nameOf(r.targetId)}" has no protocol or technology.`, "c4model");
    }
  }

  // C4 checklist: people and external systems should be connected to the system.
  const connected = new Set<string>();
  for (const r of p.relationships) { connected.add(r.sourceId); connected.add(r.targetId); }
  for (const e of p.elements) {
    if ((e.kind === "person" || e.kind === "external-system") && !connected.has(e.id)) {
      push(`orphan-${e.id}`, "warning", `"${e.name}" is not connected to anything.`, "c4model");
    }
    if ((e.kind === "container" || e.kind === "component") && !connected.has(e.id)) {
      push(`orphan-${e.id}`, "heuristic", `"${e.name}" has no relationships. Check that it is genuinely used.`, "heuristic");
    }
  }

  for (const a of p.adrs) {
    for (const issue of adrRules(a)) {
      push(issue.field, issue.severity === "error" ? "error" : "warning", `ADR ${a.number}: ${issue.message}`, "policy");
    }
  }

  for (const r of p.requirements) {
    if (r.linkedElementIds.length === 0) {
      push(`req-${r.id}`, "warning", `Requirement "${r.title}" is not linked to any element, so there is no traceability.`, "heuristic");
    }
    for (const id of r.linkedElementIds) {
      if (!p.elements.some((e) => e.id === id)) push(`req-link-${r.id}-${id}`, "error", `Requirement "${r.title}" links to an element that no longer exists.`, "policy");
    }
  }

  for (const r of p.risks) {
    if (!r.mitigation.trim()) push(`risk-${r.id}`, "warning", `Risk "${r.title}" has no mitigation.`, "heuristic");
  }

  // Deployment: containers marked as deployed should sit in a node.
  const nodeIds = new Set(p.elements.filter((e) => e.kind === "deployment-node" || e.kind === "infrastructure-node").map((e) => e.id));
  if (p.includeDeployment) {
    if (nodeIds.size === 0) {
      push("deployment", "warning", `Deployment diagram is included but no deployment nodes are recorded (${NOT_RECORDED}).`, "heuristic");
    }
    for (const e of p.elements) {
      if ((e.kind === "container" || e.kind === "data-store") && !e.parentId) {
        push(`deploy-${e.id}`, "heuristic", `"${e.name}" is not assigned to a deployment node, so it will not appear in the deployment view.`, "heuristic");
      }
      if (e.parentId && !nodeIds.has(e.parentId) && (e.kind === "container" || e.kind === "data-store")) {
        push(`deploy-${e.id}`, "error", `"${e.name}" is assigned to a parent that is not a deployment node.`, "policy");
      }
    }
  }

  // Code level: a class box with neither attributes nor operations says little.
  for (const id of p.codeDiagramComponentIds) {
    const parts = p.elements.filter((e) => e.kind === "code" && e.parentId === id);
    if (parts.length === 0) {
      push(`code-${id}`, "warning", "A level 4 diagram is selected but has no code elements.", "policy");
    }
    for (const c of parts) {
      if ((c.attributes?.length ?? 0) === 0 && (c.methods?.length ?? 0) === 0) {
        push(`code-detail-${c.id}`, "heuristic", `Code element "${c.name}" has no attributes or operations.`, "heuristic");
      }
    }
  }

  // Dynamic scenarios need at least two participants to be a conversation.
  for (const s of p.dynamicScenarioIds) {
    const sc = p.scenarios.find((x) => x.id === s);
    if (!sc) continue;
    if (sc.steps.length === 0) push(`scenario-${sc.id}`, "warning", `Scenario "${sc.name}" is in the report but has no steps.`, "policy");
    for (const st of sc.steps) {
      if (st.actorIds.length < 2) push(`step-${st.id}`, "heuristic", `A step in "${sc.name}" names fewer than two participants, so it will render without an arrow.`, "heuristic");
    }
  }

  // Landscape needs more than one system to be worth the extra view.
  if (p.includeLandscape && p.elements.filter((e) => e.kind === "software-system").length < 2) {
    push("landscape", "heuristic", `System landscape is included with fewer than two software systems. Landscape only adds value for a portfolio of systems.`, "heuristic");
  }

  if (p.adrs.length === 0) push("adrs", "warning", `No architecture decisions recorded (${NOT_RECORDED}).`, "policy");

  return out;
}

export function summariseChecks(checks: QualityCheck[]) {
  return {
    total: checks.length,
    errors: checks.filter((c) => c.severity === "error").length,
    warnings: checks.filter((c) => c.severity === "warning").length,
    heuristics: checks.filter((c) => c.severity === "heuristic").length,
  };
}
