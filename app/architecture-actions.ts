"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { listProjects, getProject, saveProject, importProject, deleteProject } from "@/lib/architecture/store";
import { validateProject } from "@/lib/architecture/validation";
import { emptyProject, newId, type ArchitectureProject, type AdrStatus, type ElementKind, type ContainerType } from "@/lib/architecture/model";

function projectOrRedirect(id: string): ArchitectureProject {
  const p = getProject(id);
  if (!p) redirect("/architecture");
  return p;
}

function backTo(step: string, id: string, issues: string[] = []): never {
  const q = new URLSearchParams({ step, id });
  if (issues.length) q.set("issues", issues.join(" | "));
  revalidatePath("/architecture");
  redirect(`/architecture/wizard?${q.toString()}`);
}

function list(value: FormDataEntryValue | null): string[] {
  return String(value ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
}

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/architecture?error=Project+name+required");
  const p = saveProject({ ...emptyProject(name), name });
  redirect(`/architecture/wizard?step=project&id=${p.id}`);
}

export async function saveProjectStep(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "project");
  const p = projectOrRedirect(id);
  const action = String(formData.get("action") ?? "next");

  p.name = String(formData.get("name") ?? p.name).trim();
  p.purpose = String(formData.get("purpose") ?? p.purpose).trim();
  p.businessContext = String(formData.get("businessContext") ?? p.businessContext).trim();
  p.stakeholders = list(formData.get("stakeholders"));
  p.scope = String(formData.get("scope") ?? p.scope).trim();
  p.assumptions = list(formData.get("assumptions"));
  p.constraints = list(formData.get("constraints"));
  p.securityNotes = String(formData.get("securityNotes") ?? p.securityNotes).trim();
  p.operationalNotes = String(formData.get("operationalNotes") ?? p.operationalNotes).trim();
  p.costNotes = String(formData.get("costNotes") ?? p.costNotes).trim();
  p.openQuestions = list(formData.get("openQuestions"));

  const errors = validateProject(p).filter((i) => i.severity === "error" && i.field === "name");
  if (errors.length) backTo(step, id, errors.map((e) => e.message));

  saveProject(p);
  if (action === "save") backTo(step, id);
  const next = String(formData.get("next") ?? "");
  backTo(next || step, id);
}

export async function addElementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "context");
  const p = projectOrRedirect(id);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) backTo(step, id, ["Element name is required"]);
  const kind = String(formData.get("kind") ?? "container") as ElementKind;
  const containerType = String(formData.get("containerType") ?? "service") as ContainerType;
  const description = String(formData.get("description") ?? "").trim();
  const technology = String(formData.get("technology") ?? "").trim();
  const parentId = String(formData.get("parentId") ?? "").trim();

  const stored: ArchitectureProject["elements"][number] = {
    id: newId("el"),
    kind: kind === "data-store" ? "data-store" : kind,
    name,
    description,
    technology: technology || undefined,
    responsibility: description || undefined,
    attributes: list(formData.get("attributes")),
    methods: list(formData.get("methods")),
    parentId: kind === "component" || kind === "code" || kind === "container" || kind === "data-store"
      ? parentId || undefined
      : undefined,
    unverified: formData.get("unverified") === "on",
  };
  if (containerType && (kind === "container" || kind === "data-store")) {
    stored.technology = stored.technology || containerType;
  }
  p.elements.push(stored);
  saveProject(p);
  backTo(step, id);
}

export async function deleteElementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "context");
  const elementId = String(formData.get("elementId") ?? "");
  const p = projectOrRedirect(id);
  p.elements = p.elements.filter((e) => e.id !== elementId);
  p.relationships = p.relationships.filter((r) => r.sourceId !== elementId && r.targetId !== elementId);
  p.componentDiagramContainerIds = p.componentDiagramContainerIds.filter((x) => x !== elementId);
  p.codeDiagramComponentIds = p.codeDiagramComponentIds.filter((x) => x !== elementId);
  p.scenarios = p.scenarios.map((s) => ({ ...s, steps: s.steps.filter((st) => !st.actorIds.includes(elementId)) }));
  saveProject(p);
  backTo(step, id);
}

export async function addRelationshipAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "context");
  const p = projectOrRedirect(id);
  const sourceId = String(formData.get("sourceId") ?? "");
  const targetId = String(formData.get("targetId") ?? "");
  if (!p.elements.some((e) => e.id === sourceId) || !p.elements.some((e) => e.id === targetId)) {
    backTo(step, id, ["Both relationship ends must be existing elements"]);
  }
  if (sourceId === targetId) backTo(step, id, ["A relationship cannot point at itself"]);
  p.relationships.push({
    id: newId("rel"),
    sourceId,
    targetId,
    label: String(formData.get("label") ?? "").trim(),
    technology: String(formData.get("technology") ?? "").trim() || undefined,
    multiplicity: String(formData.get("multiplicity") ?? "").trim() || undefined,
    description: String(formData.get("description") ?? "").trim() || undefined,
  });
  saveProject(p);
  backTo(step, id);
}

export async function deleteRelationshipAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "context");
  const relId = String(formData.get("relationshipId") ?? "");
  const p = projectOrRedirect(id);
  p.relationships = p.relationships.filter((r) => r.id !== relId);
  saveProject(p);
  backTo(step, id);
}

export async function saveAdrAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const p = projectOrRedirect(id);
  const adrId = String(formData.get("adrId") ?? "");
  const status = String(formData.get("status") ?? "proposed") as AdrStatus;

  const titles = list(formData.get("optionTitles"));
  const pros = list(formData.get("optionPros"));
  const cons = list(formData.get("optionCons"));
  const options = titles.filter(Boolean).map((t, i) => ({ id: newId("opt"), title: t, pros: pros[i] ?? "", cons: cons[i] ?? "" }));

  const linkedElementIds = formData.getAll("linkedElementIds").map(String);
  const linkedRequirementIds = formData.getAll("linkedRequirementIds").map(String);

  if (adrId) {
    const a = p.adrs.find((x) => x.id === adrId);
    if (!a) backTo("decisions", id, ["ADR not found"]);
    Object.assign(a, {
      title: String(formData.get("title") ?? a.title).trim(),
      status,
      date: String(formData.get("date") ?? a.date),
      author: String(formData.get("author") ?? a.author).trim(),
      context: String(formData.get("context") ?? "").trim(),
      problemStatement: String(formData.get("problemStatement") ?? "").trim(),
      decisionDrivers: list(formData.get("decisionDrivers")),
      options,
      chosenOptionId: String(formData.get("chosenOptionId") ?? "").trim() || options[0]?.id,
      rationale: String(formData.get("rationale") ?? "").trim(),
      positiveConsequences: list(formData.get("positiveConsequences")),
      negativeConsequences: list(formData.get("negativeConsequences")),
      risksAndMitigations: list(formData.get("risksAndMitigations")),
      securityAndCompliance: String(formData.get("securityAndCompliance") ?? "").trim(),
      costAndOperations: String(formData.get("costAndOperations") ?? "").trim(),
      linkedElementIds,
      linkedRequirementIds,
      supersedesId: String(formData.get("supersedesId") ?? "").trim() || undefined,
      aiDrafted: false,
    });
  } else {
    const nextNumber = p.adrs.reduce((max, a) => Math.max(max, a.number), 0) + 1;
    p.adrs.push({
      id: newId("adr"),
      number: nextNumber,
      title: String(formData.get("title") ?? "").trim() || "Untitled decision",
      status,
      date: String(formData.get("date") ?? new Date().toISOString().slice(0, 10)),
      author: String(formData.get("author") ?? "").trim(),
      context: String(formData.get("context") ?? "").trim(),
      problemStatement: String(formData.get("problemStatement") ?? "").trim(),
      decisionDrivers: list(formData.get("decisionDrivers")),
      options,
      chosenOptionId: String(formData.get("chosenOptionId") ?? "").trim() || options[0]?.id,
      rationale: String(formData.get("rationale") ?? "").trim(),
      positiveConsequences: list(formData.get("positiveConsequences")),
      negativeConsequences: list(formData.get("negativeConsequences")),
      risksAndMitigations: list(formData.get("risksAndMitigations")),
      securityAndCompliance: String(formData.get("securityAndCompliance") ?? "").trim(),
      costAndOperations: String(formData.get("costAndOperations") ?? "").trim(),
      linkedElementIds,
      linkedRequirementIds,
      supersedesId: String(formData.get("supersedesId") ?? "").trim() || undefined,
      aiDrafted: false,
    });
  }
  saveProject(p);
  backTo("decisions", id);
}

export async function toggleDiagramAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const step = String(formData.get("step") ?? "components");
  const target = String(formData.get("target") ?? "component");
  const ref = String(formData.get("ref") ?? "");
  const p = projectOrRedirect(id);

  if (target === "component") {
    const set = new Set(p.componentDiagramContainerIds);
    if (set.has(ref)) set.delete(ref); else set.add(ref);
    p.componentDiagramContainerIds = [...set];
  } else if (target === "code") {
    const set = new Set(p.codeDiagramComponentIds);
    if (set.has(ref)) set.delete(ref); else set.add(ref);
    p.codeDiagramComponentIds = [...set];
  } else if (target === "landscape") {
    p.includeLandscape = !p.includeLandscape;
  } else if (target === "deployment") {
    p.includeDeployment = !p.includeDeployment;
  } else if (target === "scenario") {
    const set = new Set(p.dynamicScenarioIds);
    if (set.has(ref)) set.delete(ref); else set.add(ref);
    p.dynamicScenarioIds = [...set];
  }
  saveProject(p);
  backTo(step, id);
}

export async function saveScenarioAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const p = projectOrRedirect(id);
  const scenarioId = String(formData.get("scenarioId") ?? "");
  const step = String(formData.get("step") ?? "components");

  const rawSteps = String(formData.get("steps") ?? "");
  const steps = rawSteps.split("\n").map((line, i) => {
    const [firstPart, ...rest] = line.split("->");
    const message = (rest.length ? rest.join("->") : firstPart).split("|")[0].trim();
    const actorPart = rest.length ? firstPart : "";
    const note = (rest.length ? rest.join("->") : firstPart).split("|")[1]?.trim();
    const actorNames = actorPart.split(",").map((s) => s.trim()).filter(Boolean);
    const actorIds = actorNames.map((n) => p.elements.find((e) => e.name === n || e.id === n)?.id).filter(Boolean) as string[];
    return { id: `step_${i}`, actorIds, message, note: note || undefined };
  }).filter((s) => s.message);

  const name = String(formData.get("name") ?? "").trim();
  if (!name) backTo(step, id, ["Scenario name is required"]);

  if (scenarioId) {
    const s = p.scenarios.find((x) => x.id === scenarioId);
    if (s) { s.name = name; s.description = String(formData.get("description") ?? "").trim() || undefined; s.steps = steps; }
  } else {
    p.scenarios.push({ id: newId("scn"), name, description: String(formData.get("description") ?? "").trim() || undefined, steps });
  }
  saveProject(p);
  backTo(step, id);
}

export async function assignDeploymentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const p = projectOrRedirect(id);
  const elementId = String(formData.get("elementId") ?? "");
  const nodeId = String(formData.get("nodeId") ?? "");
  const e = p.elements.find((x) => x.id === elementId);
  if (!e) backTo("deployment", id, ["Element not found"]);
  e.parentId = nodeId || undefined;
  saveProject(p);
  backTo("deployment", id);
}

export async function saveRequirementAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const p = projectOrRedirect(id);
  p.requirements.push({
    id: newId("req"),
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "functional").trim(),
    description: String(formData.get("description") ?? "").trim(),
    linkedElementIds: formData.getAll("linkedElementIds").map(String),
    adrIds: formData.getAll("adrIds").map(String),
  });
  saveProject(p);
  backTo("quality", id);
}

export async function saveRiskAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const p = projectOrRedirect(id);
  p.risks.push({
    id: newId("risk"),
    title: String(formData.get("title") ?? "").trim(),
    category: String(formData.get("category") ?? "technical").trim(),
    severity: String(formData.get("severity") ?? "medium") as "low" | "medium" | "high",
    likelihood: String(formData.get("likelihood") ?? "medium") as "low" | "medium" | "high",
    mitigation: String(formData.get("mitigation") ?? "").trim(),
    owner: String(formData.get("owner") ?? "").trim() || undefined,
  });
  saveProject(p);
  backTo("quality", id);
}

export async function toggleComponentDiagramAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const containerId = String(formData.get("containerId") ?? "");
  const p = projectOrRedirect(id);
  const set = new Set(p.componentDiagramContainerIds);
  if (set.has(containerId)) set.delete(containerId);
  else set.add(containerId);
  p.componentDiagramContainerIds = [...set];
  saveProject(p);
  backTo("components", id);
}

export async function importProjectAction(formData: FormData) {
  const raw = String(formData.get("json") ?? "");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    redirect("/architecture?error=That+file+is+not+valid+JSON");
  }
  const { project, issues } = importProject(parsed);
  const errors = issues.filter((i) => i.severity === "error");
  if (errors.length) {
    redirect(`/architecture?error=${encodeURIComponent(errors.map((e) => e.message).join("; "))}`);
  }
  redirect(`/architecture/wizard?step=project&id=${project.id}`);
}

export async function loadSampleAction() {
  const { sampleProject } = await import("@/lib/architecture/sample");
  const p = saveProject(sampleProject());
  redirect(`/architecture/wizard?step=project&id=${p.id}`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  void listProjects();
  deleteProject(id);
  revalidatePath("/architecture");
  redirect("/architecture");
}
