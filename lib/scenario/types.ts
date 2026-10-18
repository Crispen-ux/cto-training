import type { Element, Relationship } from "../architecture/model";

/**
 * Scenario engine: the advanced, decision-focused assessment domain.
 *
 * This is deliberately a separate domain from three older uses of the word
 * "scenario" already in the codebase, so nothing collides:
 *   - `DynamicScenario` in `lib/architecture/model.ts` is a sequence diagram.
 *   - `lesson.defend.scenario` is a prose defence prompt string.
 *   - `DecisionAttempt.scenarioId` is a self-supplied label.
 *
 * A `ScenarioExercise` is a whole enterprise design problem: context,
 * requirements, constraints, ambiguity, a diagram, questions, a mid-exercise
 * change, a model answer and its sources.
 *
 * Design position, stated up front so the code cannot drift from it:
 *   Difficulty comes from competing requirements, incomplete information and
 *   consequences - never from obscurity. Nothing here is a memorisation test.
 *   A correct service name with weak reasoning does not pass. A technically
 *   defensible alternative does pass when the learner states the conditions
 *   that make it appropriate.
 */

export const SCENARIO_BANK_VERSION = "scenario-bank-v1";
export const SCENARIO_RUBRIC_VERSION = "scenario-rubric-v1";

export type ScenarioTheme =
  | "application-architecture"
  | "serverless-event-driven"
  | "streaming-analytics"
  | "security-identity"
  | "data-architecture"
  | "ai-data"
  | "resilience-recovery"
  | "migration-modernisation"
  | "cost-performance"
  | "hybrid-networking"
  | "governance-observability"
  | "executive-risk";

export const SCENARIO_THEMES: ScenarioTheme[] = [
  "application-architecture",
  "serverless-event-driven",
  "streaming-analytics",
  "security-identity",
  "data-architecture",
  "ai-data",
  "resilience-recovery",
  "migration-modernisation",
  "cost-performance",
  "hybrid-networking",
  "governance-observability",
  "executive-risk",
];

/** Which technology the scenario is anchored in. Some are deliberately none of them. */
export type CloudScope = "aws" | "azure" | "cross-cloud" | "technology-neutral";

/**
 * Difficulty is about reasoning load, not obscurity.
 * associate: one decisive requirement, few distractors.
 * professional: competing requirements and a real cost of being wrong.
 * expert: incomplete information, a mid-exercise change, several defensible answers.
 */
export type ScenarioDifficulty = "associate" | "professional" | "expert";

export interface ScenarioStakeholder {
  name: string;
  role: string;
  /** What this person will push for, and what they will reject. */
  concern: string;
}

export interface ScenarioContext {
  businessContext: string;
  objectives: string[];
  stakeholders: ScenarioStakeholder[];
  /** What is running today: systems, data volumes, traffic shape. */
  existingInfrastructure: string;
  /** Access patterns, consistency needs, volume and growth. */
  dataCharacteristics: string[];
  /** Regulatory or contractual obligations that constrain the design. */
  compliance: string[];
}

export interface ScenarioRequirements {
  functional: string[];
  /** Non-functional requirements with a measurable target where one exists. */
  nonFunctional: string[];
  /** RTO, RPO, latency, throughput, availability. Named targets, not adjectives. */
  performanceAvailability: string[];
  budget: string;
  teamSkills: string;
  deadline: string;
}

export interface ScenarioConstraints {
  security: string[];
  identityNetworking: string[];
  /** Operational constraints: on-call depth, existing tooling, migration windows. */
  operational: string[];
}

/**
 * The four information states a real engagement starts in. Naming these
 * explicitly is what stops a scenario from being a disguised multiple-choice
 * question: the learner has to say which facts they are missing.
 */
export interface ScenarioAmbiguity {
  /** Stated by the client. Treated as true. */
  explicitFacts: string[];
  /** Not stated. The learner must decide what to assume and flag it. */
  assumptions: string[];
  /** Information the design genuinely cannot proceed without. */
  missingInformation: string[];
  /** Statements that can be read more than one way. Each is a decision point. */
  ambiguities: string[];
}

/**
 * A scenario diagram is the same structured C4 data the Architecture Studio
 * uses, so it is editable, versionable and rendered by the same deterministic
 * renderer. It is never a decorative image.
 */
export interface ScenarioDiagram {
  title: string;
  caption: string;
  elements: Element[];
  relationships: Relationship[];
  /** For interpretation questions: what the diagram deliberately omits. */
  omissions?: string[];
}

export type QuestionKind =
  | "single-best"
  | "multiple-select"
  | "choose-architecture"
  | "diagram-interpretation"
  | "troubleshooting"
  | "trade-off"
  | "open-design"
  | "defence"
  | "lab";

export interface QuestionOption {
  id: string;
  text: string;
}

export interface Distractor {
  optionId: string;
  /** Why this option is wrong for THIS scenario, not in general. */
  whyWrong: string;
  /** The common architectural mistake this option represents. */
  mistake: string;
}

export interface DefensibleAlternative {
  answer: string;
  /** The conditions under which this answer is also correct. */
  conditions: string;
}

export interface RubricCriterion {
  criterion: string;
  weight: number;
  /** Concrete signal that the criterion is met. Used by the heuristic check. */
  lookFor: string[];
}

export interface Question {
  id: string;
  kind: QuestionKind;
  prompt: string;
  /** Ids of the requirements or constraints this question is actually testing. */
  tests: string[];
  /** Closed question options. Absent for open-design and defence. */
  options?: QuestionOption[];
  /** Correct option ids. Exactly one for single-best, several for multiple-select. */
  answers?: string[];
  /** Why the key is right. Written only for the correct option(s). */
  rationale: string;
  /** Why each plausible wrong answer is wrong here. */
  distractors?: Distractor[];
  /** Alternative answers that also pass, with the conditions that make them pass. */
  defensibleAlternatives?: DefensibleAlternative[];
  /** Open questions: how the answer is judged. */
  rubric?: RubricCriterion[];
  minWords?: number;
  /** Case-study dependency: this question only opens after that one is answered. */
  dependsOn?: string;
}

/** A changed requirement or failure condition introduced after the first answer. */
export interface ScenarioTwist {
  id: string;
  change: string;
  /** What the learner must now revise or defend. */
  revisePrompt: string;
  modelAnswer: string;
}

export interface ScenarioDeliverable {
  /** written-recommendation | diagram | decision-matrix | adr | threat-model | cost-estimate | recovery-plan | lab | executive-brief */
  kind: string;
  prompt: string;
  /** Verification steps. Conceptual work is never claimed as implemented. */
  acceptance: string[];
}

export interface RecommendedService {
  name: string;
  why: string;
  cloud: CloudScope;
}

export interface RejectedAlternative {
  name: string;
  whyNot: string;
  /** Stated honestly: when this would be the right answer instead. */
  whenRight: string;
}

/**
 * The model answer answers the twelve questions the Academy requires of every
 * architecture decision. It is a benchmark for reasoning, not a single
 * privileged answer.
 */
export interface ScenarioModelAnswer {
  businessProblem: string;
  decisiveRequirements: string[];
  importantConstraints: string[];
  pattern: string;
  recommendedServices: RecommendedService[];
  rejectedAlternatives: RejectedAlternative[];
  tradeOffs: string[];
  securityControls: string[];
  scalingRecoveryMonitoring: string[];
  assumptionsToConfirm: string[];
  evidenceThatWouldChangeRecommendation: string[];
}

export type SourceAuthority = "official" | "derived" | "academy-analysis";

export interface ScenarioSource {
  title: string;
  url: string;
  /** ISO date the content was last checked against this source. */
  reviewed: string;
  authority: SourceAuthority;
  /** What this source actually supports, so it is not cited for more than it says. */
  supports: string;
}

export interface ScenarioExercise {
  id: string;
  bankVersion: string;
  title: string;
  theme: ScenarioTheme;
  cloudScope: CloudScope;
  difficulty: ScenarioDifficulty;
  /** Roadmap module this sits under. */
  moduleId: string;
  /**
   * A real lesson id from content/lessons. Evidence from completing this
   * scenario maps to competencies through the existing lesson map, so the
   * scenario extends the curriculum instead of creating a parallel one.
   */
  evidenceLessonId: string;
  competencies: string[];
  timeEstimateMinutes: number;
  context: ScenarioContext;
  requirements: ScenarioRequirements;
  constraints: ScenarioConstraints;
  ambiguity: ScenarioAmbiguity;
  diagram: ScenarioDiagram;
  questions: Question[];
  twist: ScenarioTwist;
  deliverable: ScenarioDeliverable;
  modelAnswer: ScenarioModelAnswer;
  sources: ScenarioSource[];
}

/**
 * The assessment sequence. The model answer is not shown until the learner has
 * committed to a decision and to a defence of it.
 */
export const SCENARIO_STAGES = [
  "read",
  "constraints",
  "decide",
  "alternatives",
  "twist",
  "deliverable",
  "model-answer",
] as const;

export type ScenarioStage = (typeof SCENARIO_STAGES)[number];

export const STAGE_LABELS: Record<ScenarioStage, string> = {
  read: "1. Read the scenario",
  constraints: "2. Identify the decisive constraints",
  decide: "3. Choose and justify",
  alternatives: "4. Alternatives and trade-offs",
  twist: "5. The requirement changes",
  deliverable: "6. Produce the deliverable",
  "model-answer": "7. Model answer and assessment",
};

export const STAGE_INSTRUCTIONS: Record<ScenarioStage, string> = {
  read: "Read the context, requirements, constraints and diagram. Nothing is hidden at this stage.",
  constraints: "Before choosing anything, state which requirements actually decide the design. A design that satisfies all requirements equally is not a design.",
  decide: "Commit to a choice and justify it by mechanism, not adjective. Name what fails if this component is unavailable.",
  alternatives: "Name the credible alternatives you rejected and the conditions under which each would win.",
  twist: "A requirement has changed. Revise or defend your decision against it.",
  deliverable: "Produce the artefact the scenario asks for.",
  "model-answer": "Compare your reasoning against the model answer and its sources.",
};

/** The twelve questions every architecture decision must answer. */
export const DECISION_STEPS: { id: string; prompt: string }[] = [
  { id: "problem", prompt: "What is the actual business problem?" },
  { id: "decisive", prompt: "Which requirements are decisive?" },
  { id: "constraints", prompt: "What are the most important constraints?" },
  { id: "pattern", prompt: "Which architectural pattern fits the workload?" },
  { id: "services", prompt: "Which services or technologies are suitable?" },
  { id: "why-better", prompt: "Why is the preferred option better for this scenario?" },
  { id: "alternatives", prompt: "Which credible alternatives were considered?" },
  { id: "trade-offs", prompt: "What are the trade-offs, risks and operational consequences?" },
  { id: "security", prompt: "What security controls and data protections are required?" },
  { id: "scale-recover-monitor", prompt: "How will the design scale, recover and be monitored?" },
  { id: "assumptions", prompt: "What assumptions need confirmation?" },
  { id: "reconsider", prompt: "What evidence would cause the recommendation to change?" },
];

/**
 * Decision frameworks. These are comparisons of workload characteristics, not
 * predetermined answers: each frame states the conditions that flip the
 * recommendation.
 */
export interface DecisionFrame {
  id: string;
  title: string;
  /** The comparison being framed. */
  compare: string[];
  /** What to look at to decide. */
  dimensions: string[];
  /** When the first option wins. */
  leanLeftWhen: string[];
  /** When the second option wins. */
  leanRightWhen: string[];
}

export const DECISION_FRAMES: DecisionFrame[] = [
  {
    id: "compute-model",
    title: "Compute model",
    compare: ["serverless functions", "containers", "virtual machines"],
    dimensions: [
      "execution duration",
      "runtime requirements",
      "cold-start tolerance",
      "workload pattern and predictability",
      "operational overhead",
      "concurrency and scaling behaviour",
      "cost at the expected call volume",
      "deployment and rollback constraints",
    ],
    leanLeftWhen: [
      "short, event-driven executions measured in seconds",
      "spiky or unpredictable load with near-zero baseline",
      "the team will not operate a cluster",
    ],
    leanRightWhen: [
      "long-running or stateful work",
      "startup latency is user-visible and unacceptable",
      "a steady predictable baseline makes reserved capacity cheaper",
      "a runtime or dependency the platform does not support is required",
    ],
  },
  {
    id: "storage-model",
    title: "Storage model",
    compare: ["object storage", "block storage", "file storage"],
    dimensions: [
      "object vs block vs file access pattern",
      "shared access requirements",
      "size and count of items",
      "throughput and latency profile",
      "lifecycle and archival needs",
      "cost per GB at the working set size",
    ],
    leanLeftWhen: [
      "large numbers of independently addressable objects",
      "content is served or delivered rather than randomly updated",
      "lifecycle tiering to archival matters",
    ],
    leanRightWhen: [
      "a filesystem view or POSIX semantics are required",
      "many compute instances must share one writable volume",
      "a database engine needs its own block device",
    ],
  },
  {
    id: "data-model",
    title: "Data model",
    compare: ["key-value/document store", "relational database"],
    dimensions: [
      "access patterns known up front",
      "need for joins and ad-hoc queries",
      "transactional requirements",
      "consistency requirements",
      "schema flexibility",
      "throughput shape",
      "operational ownership",
      "cost at the expected scale",
    ],
    leanLeftWhen: [
      "access patterns are simple, known and stable",
      "a single-partition read path dominates",
      "horizontal scale on one hot attribute is required",
    ],
    leanRightWhen: [
      "joins, reporting or ad-hoc queries are real requirements",
      "multi-row transactions with referential integrity are required",
      "the team owns SQL and the dataset fits a relational model",
    ],
  },
  {
    id: "messaging-model",
    title: "Messaging and streaming",
    compare: ["queues", "event buses", "ordered streams"],
    dimensions: [
      "ordering requirements",
      "replay and retention",
      "consumer behaviour and fan-out",
      "routing flexibility",
      "throughput and partitioning",
      "whether analytics reads the same data",
    ],
    leanLeftWhen: [
      "work items are independent and order does not matter",
      "simple fan-out to a small number of consumers",
      "short retention is acceptable",
    ],
    leanRightWhen: [
      "per-key ordering and replay are required",
      "the same data feeds both processing and historical analysis",
      "multiple subscribers need independent cursors",
    ],
  },
  {
    id: "ai-delivery",
    title: "AI delivery model",
    compare: ["managed AI service", "self-hosted model"],
    dimensions: [
      "data privacy and residency",
      "latency requirements",
      "quality and task fit",
      "model control and versioning",
      "integration effort",
      "cost at the expected volume",
      "operational burden on a small team",
    ],
    leanLeftWhen: [
      "data may leave the boundary under existing agreements",
      "the team cannot operate GPU infrastructure",
      "quality at the task is sufficient and measurable",
    ],
    leanRightWhen: [
      "data cannot leave the boundary at all",
      "a specific open-weight model must be pinned",
      "volume makes per-token cost prohibitive",
    ],
  },
];
