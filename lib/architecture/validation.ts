import { SCHEMA_VERSION, type ArchitectureProject, emptyProject } from "./model";

/** Validation errors are returned, not thrown, so the wizard can show them inline. */
export interface ValidationIssue {
  field: string;
  message: string;
  severity: "error" | "warning";
}

const KINDS = new Set(["person", "software-system", "container", "component", "code", "external-system", "data-store", "deployment-node", "infrastructure-node"]);
const CONTAINER_TYPES = new Set(["web-app", "api", "service", "worker", "queue", "database", "cache", "object-store", "file-share", "gateway", "other"]);
const ADR_STATUSES = new Set(["proposed", "accepted", "rejected", "deprecated", "superseded"]);

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function arr(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
}

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function bool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/**
 * Migrate a stored project to the current schema. Unknown or missing fields take
 * safe defaults so older exports keep loading instead of crashing.
 */
export function migrateProject(raw: unknown): ArchitectureProject {
  const base = emptyProject();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;

  const elements = Array.isArray(p.elements)
    ? p.elements.filter((e): e is Record<string, unknown> => !!e && typeof e === "object").map((e) => ({
        id: str(e.id) || base.id,
        kind: (KINDS.has(str(e.kind)) ? str(e.kind) : "container") as never,
        name: str(e.name),
        description: str(e.description),
        technology: str(e.technology) || undefined,
        responsibility: str(e.responsibility) || undefined,
        parentId: str(e.parentId) || undefined,
        attributes: Array.isArray(e.attributes) ? e.attributes.filter((x): x is string => typeof x === "string") : undefined,
        methods: Array.isArray(e.methods) ? e.methods.filter((x): x is string => typeof x === "string") : undefined,
        multiplicity: str(e.multiplicity) || undefined,
        instance: bool(e.instance),
        unverified: bool(e.unverified),
      }))
    : [];

  const relationships = Array.isArray(p.relationships)
    ? p.relationships.filter((r): r is Record<string, unknown> => !!r && typeof r === "object").map((r) => ({
        id: str(r.id),
        sourceId: str(r.sourceId),
        targetId: str(r.targetId),
        label: str(r.label),
        technology: str(r.technology) || undefined,
        description: str(r.description) || undefined,
      }))
    : [];

  const requirements = Array.isArray(p.requirements)
    ? p.requirements.filter((r): r is Record<string, unknown> => !!r && typeof r === "object").map((r) => ({
        id: str(r.id),
        title: str(r.title),
        category: str(r.category),
        description: str(r.description),
        linkedElementIds: arr(r.linkedElementIds),
        adrIds: arr(r.adrIds),
      }))
    : [];

  const risks = Array.isArray(p.risks)
    ? p.risks.filter((r): r is Record<string, unknown> => !!r && typeof r === "object").map((r) => ({
        id: str(r.id),
        title: str(r.title),
        category: str(r.category),
        severity: (["low", "medium", "high"].includes(str(r.severity)) ? str(r.severity) : "medium") as never,
        likelihood: (["low", "medium", "high"].includes(str(r.likelihood)) ? str(r.likelihood) : "medium") as never,
        mitigation: str(r.mitigation),
        owner: str(r.owner) || undefined,
      }))
    : [];

  const adrs = Array.isArray(p.adrs)
    ? p.adrs.filter((a): a is Record<string, unknown> => !!a && typeof a === "object").map((a, i) => {
        const options = Array.isArray(a.options)
          ? a.options.filter((o): o is Record<string, unknown> => !!o && typeof o === "object").map((o) => ({
              id: str(o.id),
              title: str(o.title),
              pros: str(o.pros),
              cons: str(o.cons),
            }))
          : [];
        return {
          id: str(a.id),
          number: num(a.number, i + 1),
          title: str(a.title),
          status: (ADR_STATUSES.has(str(a.status)) ? str(a.status) : "proposed") as never,
          date: str(a.date),
          author: str(a.author),
          context: str(a.context),
          problemStatement: str(a.problemStatement),
          decisionDrivers: arr(a.decisionDrivers),
          options,
          chosenOptionId: str(a.chosenOptionId) || undefined,
          rationale: str(a.rationale),
          positiveConsequences: arr(a.positiveConsequences),
          negativeConsequences: arr(a.negativeConsequences),
          risksAndMitigations: arr(a.risksAndMitigations),
          securityAndCompliance: str(a.securityAndCompliance),
          costAndOperations: str(a.costAndOperations),
          linkedElementIds: arr(a.linkedElementIds),
          linkedRequirementIds: arr(a.linkedRequirementIds),
          supersedesId: str(a.supersedesId) || undefined,
          aiDrafted: bool(a.aiDrafted),
        };
      })
    : [];

  const scenarios = Array.isArray(p.scenarios)
    ? p.scenarios.filter((s): s is Record<string, unknown> => !!s && typeof s === "object").map((s) => ({
        id: str(s.id),
        name: str(s.name),
        description: str(s.description) || undefined,
        steps: Array.isArray(s.steps)
          ? s.steps.filter((x): x is Record<string, unknown> => !!x && typeof x === "object").map((x) => ({
              id: str(x.id),
              actorIds: arr(x.actorIds),
              message: str(x.message),
              note: str(x.note) || undefined,
            }))
          : [],
      }))
    : [];

  return {
    schemaVersion: SCHEMA_VERSION,
    id: str(p.id),
    name: str(p.name),
    purpose: str(p.purpose),
    businessContext: str(p.businessContext),
    stakeholders: arr(p.stakeholders),
    scope: str(p.scope),
    assumptions: arr(p.assumptions),
    constraints: arr(p.constraints),
    elements,
    relationships,
    requirements,
    risks,
    adrs,
    componentDiagramContainerIds: arr(p.componentDiagramContainerIds),
    codeDiagramComponentIds: arr(p.codeDiagramComponentIds),
    includeLandscape: bool(p.includeLandscape) ?? true,
    includeDeployment: bool(p.includeDeployment) ?? true,
    dynamicScenarioIds: arr(p.dynamicScenarioIds),
    scenarios,
    securityNotes: str(p.securityNotes),
    operationalNotes: str(p.operationalNotes),
    costNotes: str(p.costNotes),
    openQuestions: arr(p.openQuestions),
    evidenceLessonIds: arr(p.evidenceLessonIds),
    createdAt: str(p.createdAt) || new Date().toISOString(),
    updatedAt: str(p.updatedAt) || new Date().toISOString(),
  };
}

/** Schema-level validation. Field-level rules for ADRs live in adrRules(). */
export function validateProject(p: ArchitectureProject): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!p.name.trim()) issues.push({ field: "name", message: "Project name is required.", severity: "error" });

  const ids = new Set<string>();
  for (const e of p.elements) {
    if (!e.id) issues.push({ field: `element:${e.name}`, message: "Element is missing an id.", severity: "error" });
    if (ids.has(e.id)) issues.push({ field: `element:${e.id}`, message: `Duplicate element id "${e.id}".`, severity: "error" });
    ids.add(e.id);
    if (!e.name.trim()) issues.push({ field: `element:${e.id}`, message: "Element name is required.", severity: "error" });
    if (e.parentId && !p.elements.some((x) => x.id === e.parentId)) {
      issues.push({ field: `element:${e.id}`, message: `Parent container "${e.parentId}" does not exist.`, severity: "error" });
    }
  }

  for (const r of p.relationships) {
    if (!p.elements.some((e) => e.id === r.sourceId)) {
      issues.push({ field: `relationship:${r.id}`, message: "Relationship source does not exist.", severity: "error" });
    }
    if (!p.elements.some((e) => e.id === r.targetId)) {
      issues.push({ field: `relationship:${r.id}`, message: "Relationship target does not exist.", severity: "error" });
    }
    if (r.sourceId === r.targetId) {
      issues.push({ field: `relationship:${r.id}`, message: "A relationship cannot point at itself.", severity: "error" });
    }
  }

  for (const a of p.adrs) issues.push(...adrRules(a));

  for (const s of p.scenarios) {
    if (!s.name.trim()) issues.push({ field: `scenario:${s.id}`, message: "Dynamic scenario name is required.", severity: "warning" });
    s.steps.forEach((step, i) => {
      if (!step.message.trim()) issues.push({ field: `step:${step.id}`, message: `Step ${i + 1} of "${s.name}" has no message.`, severity: "warning" });
      for (const id of step.actorIds) {
        if (!p.elements.some((e) => e.id === id)) {
          issues.push({ field: `step:${step.id}`, message: `Step ${i + 1} of "${s.name}" references an element that does not exist.`, severity: "error" });
        }
      }
    });
  }

  for (const id of p.codeDiagramComponentIds) {
    if (!p.elements.some((e) => e.id === id)) {
      issues.push({ field: `code-diagram:${id}`, message: "A level 4 diagram is selected for an element that does not exist.", severity: "error" });
    }
  }

  for (const id of p.componentDiagramContainerIds) {
    if (!p.elements.some((e) => e.id === id)) {
      issues.push({ field: `component-diagram:${id}`, message: "A level 3 diagram is selected for a container that does not exist.", severity: "error" });
    }
  }

  return issues;
}

/**
 * Rules that gate "accepted". A decision may be drafted freely but cannot be
 * marked accepted without context, at least two options, a chosen option,
 * rationale and the trade-off consequences.
 */
export function adrRules(a: ArchitectureProject["adrs"][number]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const field = `adr:${a.id}`;
  if (!a.title.trim()) issues.push({ field, message: "ADR title is required.", severity: "error" });
  if (!a.context.trim()) issues.push({ field, message: "Context is required before an ADR can be accepted.", severity: a.status === "accepted" ? "error" : "warning" });
  if (a.options.length < 2) issues.push({ field, message: "At least two options are required before an ADR can be accepted.", severity: a.status === "accepted" ? "error" : "warning" });
  if (!a.chosenOptionId) issues.push({ field, message: "A chosen option is required before an ADR can be accepted.", severity: a.status === "accepted" ? "error" : "warning" });
  if (!a.rationale.trim()) issues.push({ field, message: "Rationale is required before an ADR can be accepted.", severity: a.status === "accepted" ? "error" : "warning" });
  if (a.positiveConsequences.length === 0 || a.negativeConsequences.length === 0) {
    issues.push({ field, message: "Both positive and negative consequences are required before an ADR can be accepted.", severity: a.status === "accepted" ? "error" : "warning" });
  }
  if (a.chosenOptionId && a.options.length > 0 && !a.options.some((o) => o.id === a.chosenOptionId)) {
    issues.push({ field, message: "The chosen option is not one of the options considered.", severity: "error" });
  }
  if (a.aiDrafted && a.status === "accepted") {
    issues.push({ field, message: "An AI-drafted ADR cannot be accepted until it has been reviewed and cleared by a human.", severity: "error" });
  }
  return issues;
}

export function canAccept(a: ArchitectureProject["adrs"][number]): boolean {
  return adrRules(a).every((i) => i.severity !== "error");
}

export function assertValid(p: ArchitectureProject): void {
  const errors = validateProject(p).filter((i) => i.severity === "error");
  if (errors.length) throw new Error(errors.map((e) => e.message).join(" "));
}
