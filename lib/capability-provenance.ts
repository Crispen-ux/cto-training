import type { Competency } from "./capability";

/**
 * Per-competency provenance and source classification.
 *
 * §3 of the mission requires that the Academy distinguish formal requirements,
 * established industry practice, informed recommendation and its own exercises,
 * and that it record source URLs and dates. The 53 shipped competencies carry a
 * single generic rubric and no provenance, so this file adds both without
 * rewriting the existing competency records.
 *
 * A competency with no entry here is reported honestly as having no declared
 * provenance. Nothing is invented to fill the gap.
 */

export type SourceKind =
  | "formal-requirement"
  | "industry-practice"
  | "informed-recommendation"
  | "academy-exercise";

export interface SourceRef {
  title: string;
  url: string;
  /** ISO date of the revision or publication we actually checked. */
  reviewed: string;
  kind: SourceKind;
  note?: string;
}

export interface CompetencyProvenance {
  competencyId: string;
  /** Competency-specific descriptors for levels 1-5. Falls back to the generic scale. */
  rubric?: [string, string, string, string, string];
  sources: SourceRef[];
}

const P = (
  competencyId: string,
  sources: SourceRef[],
  rubric?: [string, string, string, string, string],
): CompetencyProvenance => ({ competencyId, sources, rubric });

/**
 * Provenance for the competencies that map to reviewed evidence.
 * `reviewed` dates are the dates these sources were last checked by the Academy.
 */
export const COMPETENCY_PROVENANCE: CompetencyProvenance[] = [
  P(
    "reliability",
    [
      { title: "Service Level Objective", url: "https://sre.google/sre-book/service-level-objectives/", reviewed: "2026-10-18", kind: "industry-practice", note: "Canonical treatment of SLIs, SLOs and error budgets." },
      { title: "Implementing SLOs", url: "https://sre.google/workbook/implementing-slos/", reviewed: "2026-10-18", kind: "industry-practice" },
      { title: "Google SRE Workbook: Monitoring Distributed Systems", url: "https://sre.google/workbook/monitoring-distributed-systems/", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
    [
      "Names SLI, SLO, SLA and error budget, and states the difference between them.",
      "Defines an SLI with numerator, denominator, eligibility and window, and writes an SLO for a simple service.",
      "Defines and measures SLIs for a real service, and derives the error budget with correct arithmetic.",
      "Chooses SLIs that reflect customer experience rather than internals, and handles multi-window and burn-rate alerting.",
      "Sets service objectives that balance customer expectations, cost and delivery risk, and defends them to an executive.",
    ],
  ),
  P(
    "sa-nfr",
    [
      { title: "Non-functional requirements", url: "https://www.ctoframework.com/product/requirements/non-functional-requirements", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "ISO/IEC 25010:2011", url: "https://www.iso.org/standard/35733.html", reviewed: "2026-10-18", kind: "formal-requirement", note: "Quality model referenced for attribute categories; full text is paywalled." },
    ],
  ),
  P(
    "sa-requirements",
    [
      { title: "Requirements discovery", url: "https://www.ctoframework.com/product/requirements/non-functional-requirements", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "INCOSE Systems Engineering Handbook", url: "https://www.incose.org/systems-engineering-resources", reviewed: "2026-10-18", kind: "industry-practice", note: "Referenced at summary level only." },
    ],
  ),
  P(
    "arch-docs",
    [
      { title: "C4 model", url: "https://c4model.com/", reviewed: "2026-10-18", kind: "industry-practice", note: "Simon Brown; notation and diagram set." },
      { title: "Documenting architecture: ADRs and the C4 model", url: "https://www.ctoframework.com/tech/architecture-design/c4-diagrams", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Architectural Decision Records", url: "https://adr.github.io/", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
    [
      "Knows what a C4 level and an ADR are and can name the four abstraction levels.",
      "Produces a single C4 diagram and an ADR with the required sections.",
      "Produces a consistent multi-level C4 set where element identities match across levels, plus a usable ADR set.",
      "Maintains a model across levels over time, links ADRs to elements, and detects and repairs inconsistency.",
      "Establishes documentation standards for a team, reviews others' ADRs, and keeps a model correct as the system changes.",
    ],
  ),
  P(
    "arch-tradeoffs",
    [
      { title: "Choosing patterns and trade-offs", url: "https://www.ctoframework.com/tech/architecture-design/patterns", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Architecture trade-off analysis", url: "https://en.wikipedia.org/wiki/Trade-off_analysis", reviewed: "2026-10-18", kind: "informed-recommendation" },
    ],
    [
      "Names a trade-off when one is pointed out.",
      "Lists credible alternatives against stated criteria with scores and a rationale.",
      "Runs a weighted comparison and explains why the preferred option wins and what it sacrifices.",
      "Handles contested criteria and incomplete information, and runs sensitivity analysis to test whether the winner is stable.",
      "Establishes decision standards for an organisation and reviews others' trade-off analyses under challenge.",
    ],
  ),
  P(
    "tech-debt",
    [
      { title: "Technical Debt & Risk Management", url: "https://www.ctoframework.com/tech/architecture-design/technical-debt", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Technical Debt Quadrant", url: "https://martinfowler.com/bliki/TechnicalDebtQuadrant.html", reviewed: "2026-10-18", kind: "industry-practice", note: "Martin Fowler; deliberate/prudent/reckless classification." },
    ],
  ),
  P(
    "cloud-security",
    [
      { title: "Threat modelling and shifting security left", url: "https://www.ctoframework.com/tech/security-compliance/threat-modelling", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "OWASP Top 10", url: "https://owasp.org/www-project-top-ten/", reviewed: "2026-10-18", kind: "industry-practice" },
      { title: "NIST SP 800-53", url: "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final", reviewed: "2026-10-18", kind: "formal-requirement" },
    ],
  ),
  P(
    "sa-identity",
    [
      { title: "Least privilege and access control models", url: "https://www.ctoframework.com/tech/security-compliance/least-privilege", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "NIST SP 800-63", url: "https://pages.nist.gov/800-63-3/", reviewed: "2026-10-18", kind: "formal-requirement" },
      { title: "OWASP Authorization Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
  ),
  P(
    "cicd",
    [
      { title: "Infrastructure as code and the golden path", url: "https://www.ctoframework.com/tech/devops-operations/infrastructure-as-code", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "DORA research", url: "https://dora.dev/research/", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
  ),
  P(
    "cto-delivery",
    [
      { title: "DORA Metrics", url: "https://www.ctoframework.com/delivery/metrics/dora-metrics", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Accelerate: State of DevOps", url: "https://dora.dev/research/", reviewed: "2026-10-18", kind: "industry-practice", note: "Source of the four delivery metrics." },
    ],
    [
      "Names the four DORA metrics and reports them from given data.",
      "Measures all four metrics for one service with correct definitions, units and window.",
      "Interprets the metrics together, identifies a bottleneck and proposes a targeted improvement.",
      "Diagnoses which metric is constraining delivery and weighs the change against reliability and cost.",
      "Establishes delivery measurement across teams, challenges misuse of the metrics and defends the investment.",
    ],
  ),
  P(
    "sa-dr",
    [
      { title: "RTO and RPO", url: "https://www.ctoframework.com/delivery/metrics/rto-rpo", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Google SRE Workbook: Disaster Recovery", url: "https://sre.google/sre-book/disaster-recovery-testing/", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
  ),
  P(
    "cto-incidents",
    [
      { title: "Root cause analysis and blameless post-mortems", url: "https://www.ctoframework.com/delivery/incident-management/technical-post-mortems", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Google SRE Workbook: Postmortem Culture", url: "https://sre.google/sre-book/postmortem-culture/", reviewed: "2026-10-18", kind: "industry-practice" },
      { title: "Incident Response", url: "https://www.nist.gov/publications/sp-800-61r2", reviewed: "2026-10-18", kind: "formal-requirement", note: "NIST SP 800-61 Rev. 2." },
    ],
  ),
  P(
    "cto-finops",
    [
      { title: "Total cost of ownership and cloud unit economics", url: "https://www.ctoframework.com/economics/costs/total-cost-ownership", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "FinOps Framework", url: "https://www.finops.org/framework/", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
  ),
  P(
    "cto-portfolio",
    [
      { title: "Technology budgets: allocation", url: "https://www.ctoframework.com/economics/budget-breakdown", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "WSJF", url: "https://www.ctoframework.com/delivery/prioritisation/wsjf", reviewed: "2026-10-11", kind: "industry-practice" },
    ],
  ),
  P(
    "cto-exec",
    [
      { title: "Storytelling and the STAR method", url: "https://www.ctoframework.com/people/communication/story-telling", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "Assertive communication", url: "https://www.ctoframework.com/people/communication/assertive-communication", reviewed: "2026-10-11", kind: "academy-exercise" },
    ],
    [
      "Writes a short update containing the facts of a piece of work.",
      "Writes a structured update with a clear recommendation and supporting evidence.",
      "Produces a concise executive summary that leads with the conclusion and quantifies business impact.",
      "Adapts the same substance for board, executive and engineering audiences, and handles objection in the room.",
      "Establishes an executive communication standard, coaches others and defends a position under sustained challenge.",
    ],
  ),
  P(
    "sa-cost",
    [
      { title: "Cloud costs", url: "https://www.ctoframework.com/economics/costs/cloud-costs", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "AWS Cost Optimization", url: "https://docs.aws.amazon.com/wellarchitected/latest/cost-optimization-pillar/welcome.html", reviewed: "2026-10-18", kind: "industry-practice" },
    ],
  ),
  P(
    "cto-governance",
    [
      { title: "Three Lines of Defence", url: "https://www.ctoframework.com/delivery/risk-management/three-lines-of-defence", reviewed: "2026-10-11", kind: "academy-exercise" },
      { title: "IIA Three Lines Model (Statement of Position)", url: "https://www.theiia.org/en/resources/statements-of-position/", reviewed: "2026-10-18", kind: "industry-practice", note: "Replaced the 2020 Position Paper; verified reachable 2026-10-18." },
      { title: "COBIT", url: "https://www.isaca.org/resources/cobit", reviewed: "2026-10-18", kind: "formal-requirement", note: "Referenced at framework level; full text is licensed." },
    ],
  ),
  P("cto-strategy", [
    { title: "Your first 90 days as a CTO", url: "https://www.ctoframework.com/people/performance-growth/first-90-days-cto", reviewed: "2026-10-11", kind: "academy-exercise" },
  ]),
  P("cto-ai", [
    { title: "AI risk, the EU AI Act and model collapse", url: "https://www.ctoframework.com/tech/ai/eu-ai-act", reviewed: "2026-10-11", kind: "academy-exercise" },
    { title: "EU AI Act", url: "https://eur-lex.europa.eu/eli/reg/2024/1689/oj", reviewed: "2026-10-18", kind: "formal-requirement" },
    { title: "NIST AI Risk Management Framework", url: "https://www.nist.gov/itl/ai-risk-management-framework", reviewed: "2026-10-18", kind: "formal-requirement" },
  ]),
];

const BY_ID = new Map(COMPETENCY_PROVENANCE.map((p) => [p.competencyId, p]));

export function provenanceFor(competencyId: string): CompetencyProvenance | undefined {
  return BY_ID.get(competencyId);
}

/** Provenance status is reported honestly; absence is data, not a failure. */
export type ProvenanceStatus = "declared" | "framework-derived" | "none";

export function provenanceStatus(c: Competency): ProvenanceStatus {
  if (BY_ID.has(c.id)) return "declared";
  if (c.evidenceRequirements.length > 0) return "framework-derived";
  return "none";
}
