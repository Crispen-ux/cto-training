/**
 * Architecture project model.
 *
 * This model is the single source of truth. Diagrams, the report, Markdown and
 * SVG exports are all derived from it; nothing is hand-drawn separately.
 *
 * Element vocabulary follows the C4 model (https://c4model.com/abstractions):
 * software system, container, component and code are the four abstraction levels.
 * "Person", "external system" and "data store" are used as element kinds so the
 * notation can distinguish shapes for people and databases on diagrams.
 */

export const SCHEMA_VERSION = 2;

export type ElementKind =
  | "person"
  | "software-system"
  | "container"
  | "component"
  | "code"
  | "external-system"
  | "data-store"
  | "deployment-node"
  | "infrastructure-node";

export type ContainerType =
  | "web-app"
  | "api"
  | "service"
  | "worker"
  | "queue"
  | "database"
  | "cache"
  | "object-store"
  | "file-share"
  | "gateway"
  | "other";

export interface Element {
  id: string;
  kind: ElementKind;
  name: string;
  /** Short description shown under the name on diagrams. Required by C4 notation. */
  description: string;
  /** Technology for containers and components (e.g. "Node.js 22", "PostgreSQL 16"). */
  technology?: string;
  /** Responsibility: what this element does and why. */
  responsibility?: string;
  /** Component- or code-level parent (container, component) or group/node parent (landscape, deployment). */
  parentId?: string;
  /** Class-style attribute lines, shown on code (level 4) diagrams. */
  attributes?: string[];
  /** Class-style operation lines, shown on code (level 4) diagrams. */
  methods?: string[];
  /** Multiplicity or role shown at the end of a code-level relationship, e.g. "1..*". */
  multiplicity?: string;
  /** True when this element is an instance running inside a deployment node. */
  instance?: boolean;
  /** Unverified items are labelled on the report and never presented as facts. */
  unverified?: boolean;
}

export interface Relationship {
  id: string;
  sourceId: string;
  targetId: string;
  /** Verb phrase: "reads from", "publishes to", "calls". */
  label: string;
  /** Protocol or technology for container/component relationships (HTTPS/JSON, gRPC...). */
  technology?: string;
  /** Multiplicity or role shown at the end of a code-level relationship, e.g. "1..*". */
  multiplicity?: string;
  description?: string;
}

export interface Requirement {
  id: string;
  title: string;
  /** e.g. "security", "performance", "availability", "operability". */
  category: string;
  description: string;
  /** Element ids this requirement is satisfied by. Empty means unlinked. */
  linkedElementIds: string[];
  adrIds: string[];
}

export interface Risk {
  id: string;
  title: string;
  category: string;
  severity: "low" | "medium" | "high";
  likelihood: "low" | "medium" | "high";
  mitigation: string;
  owner?: string;
}

export interface AdrOption {
  id: string;
  title: string;
  pros: string;
  cons: string;
}

export type AdrStatus = "proposed" | "accepted" | "rejected" | "deprecated" | "superseded";

export interface Adr {
  id: string;
  number: number;
  title: string;
  status: AdrStatus;
  date: string;
  author: string;
  context: string;
  problemStatement: string;
  decisionDrivers: string[];
  options: AdrOption[];
  chosenOptionId?: string;
  rationale: string;
  positiveConsequences: string[];
  negativeConsequences: string[];
  risksAndMitigations: string[];
  securityAndCompliance: string;
  costAndOperations: string;
  /** Element ids affected by this decision. */
  linkedElementIds: string[];
  linkedRequirementIds: string[];
  /** ADR id this one supersedes. Superseded ADRs are kept, never deleted. */
  supersedesId?: string;
  /** Set when AI drafted the content and a human has not yet reviewed it. */
  aiDrafted?: boolean;
}

export interface DynamicStep {
  id: string;
  /** Participant element ids involved in this step. */
  actorIds: string[];
  message: string;
  note?: string;
}

export interface DynamicScenario {
  id: string;
  name: string;
  description?: string;
  steps: DynamicStep[];
}

export interface ArchitectureProject {
  schemaVersion: number;
  id: string;
  name: string;
  purpose: string;
  businessContext: string;
  stakeholders: string[];
  scope: string;
  assumptions: string[];
  constraints: string[];
  elements: Element[];
  relationships: Relationship[];
  requirements: Requirement[];
  risks: Risk[];
  adrs: Adr[];
  /** Container ids the user asked to render at level 3. */
  componentDiagramContainerIds: string[];
  /** Component ids the user asked to render at level 4 (code). */
  codeDiagramComponentIds: string[];
  /** False hides the system landscape diagram from the report. */
  includeLandscape: boolean;
  /** False hides the deployment diagram from the report. */
  includeDeployment: boolean;
  /** Scenario ids the user asked to render as dynamic diagrams. */
  dynamicScenarioIds: string[];
  scenarios: DynamicScenario[];
  securityNotes: string;
  operationalNotes: string;
  costNotes: string;
  openQuestions: string[];
  createdAt: string;
  updatedAt: string;
}

export function emptyProject(name = ""): ArchitectureProject {
  const now = new Date().toISOString();
  return {
    schemaVersion: SCHEMA_VERSION,
    id: "",
    name,
    purpose: "",
    businessContext: "",
    stakeholders: [],
    scope: "",
    assumptions: [],
    constraints: [],
    elements: [],
    relationships: [],
    requirements: [],
    risks: [],
    adrs: [],
    componentDiagramContainerIds: [],
    codeDiagramComponentIds: [],
    includeLandscape: true,
    includeDeployment: true,
    dynamicScenarioIds: [],
    scenarios: [],
    securityNotes: "",
    operationalNotes: "",
    costNotes: "",
    openQuestions: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function cloneProject(p: ArchitectureProject): ArchitectureProject {
  return JSON.parse(JSON.stringify(p)) as ArchitectureProject;
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}
