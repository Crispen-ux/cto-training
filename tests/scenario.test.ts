import { describe, it, expect } from "vitest";
import { validateBank, validateScenario, competencyCoverage, getScenario, usableScenarios } from "@/lib/scenario/bank";
import { scoreClosed, analyseOpen, scoreScenario, wordCount, isClosed } from "@/lib/scenario/scoring";
import { challengeRationale, rationaleIsSubstantive, engagesWithChange } from "@/lib/scenario/challenge";
import { validateScenarioDiagram, renderScenarioDiagram, interrogateComponent, diagramHasErrors } from "@/lib/scenario/diagram";
import { DECISION_FRAMES, DECISION_STEPS, SCENARIO_STAGES } from "@/lib/scenario/types";

const scenario = getScenario("invoicing-platform-resilience")!;

function q(id: string) {
  return scenario.questions.find((x) => x.id === id)!;
}

describe("scenario bank integrity", () => {
  it("loads at least one scenario", () => {
    expect(scenario).toBeDefined();
    expect(scenario.title.length).toBeGreaterThan(0);
  });

  it("has no structural errors", () => {
    const report = validateBank();
    const errors = report.issues.filter((i) => i.severity === "error");
    expect(errors.map((e) => e.issue)).toEqual([]);
  });

  it("declares only competency ids that exist in the competency model", () => {
    const coverage = competencyCoverage();
    for (const c of coverage) {
      expect(c.missing, `${c.scenarioId} references unknown competencies`).toEqual([]);
    }
  });

  it("references only sources that were verified, with no future review date", () => {
    const now = Date.now();
    for (const s of scenario.sources) {
      expect(s.url.startsWith("https://"), `${s.url} is not https`).toBe(true);
      const reviewed = new Date(s.reviewed).getTime();
      expect(Number.isNaN(reviewed)).toBe(false);
      expect(reviewed, `${s.url} claims a review date in the future`).toBeLessThanOrEqual(now);
      expect(s.supports.length, `${s.url} does not say what it supports`).toBeGreaterThan(20);
    }
  });

  it("cites only verified official URLs, not invented paths", () => {
    const urls = scenario.sources.map((s) => s.url);
    // These two failed verification during authoring and were replaced.
    expect(urls).not.toContain("https://docs.aws.amazon.com/AmazonSQS/latest/API/Welcome.html");
    expect(urls).not.toContain("https://learn.microsoft.com/en-us/azure/security/fundamentals/azure-operations");
    expect(urls).toContain("https://docs.aws.amazon.com/AWSSimpleQueueService/latest/APIReference/Welcome.html");
  });

  it("maps to a real lesson so its evidence reaches the competency model", () => {
    expect(scenario.evidenceLessonId).toBe("aws-solutions-architect-material");
    const issues = validateScenario(scenario).filter((i) => i.issue.includes("is not a real lesson"));
    expect(issues).toEqual([]);
  });

  it("declares the twelve decision steps and the staged assessment sequence", () => {
    expect(DECISION_STEPS).toHaveLength(12);
    expect(SCENARIO_STAGES).toContain("model-answer");
    expect(DECISION_FRAMES.length).toBeGreaterThanOrEqual(5);
  });

  it("does not present missing information as though it were known", () => {
    expect(scenario.ambiguity.missingInformation.length).toBeGreaterThan(0);
    expect(scenario.ambiguity.ambiguities.length).toBeGreaterThan(0);
    expect(scenario.ambiguity.assumptions.length).toBeGreaterThan(0);
  });

  it("exposes every required question kind across the bank", () => {
    const kinds = new Set(usableScenarios().flatMap((s) => s.questions.map((x) => x.kind)));
    for (const k of [
      "single-best",
      "multiple-select",
      "choose-architecture",
      "diagram-interpretation",
      "troubleshooting",
      "trade-off",
      "open-design",
      "defence",
      "lab",
    ]) {
      expect(kinds.has(k as never), `bank is missing question kind ${k}`).toBe(true);
    }
  });

  it("makes difficulty come from competing requirements, not obscurity", () => {
    // Every distractor must explain why it is wrong here, in this scenario.
    for (const question of scenario.questions) {
      for (const d of question.distractors ?? []) {
        expect(d.whyWrong.length, `${question.id}/${d.optionId}`).toBeGreaterThan(30);
      }
    }
    // A defensible alternative must state its conditions, not just exist.
    for (const question of scenario.questions) {
      for (const alt of question.defensibleAlternatives ?? []) {
        expect(alt.conditions.length, `${question.id} alternative`).toBeGreaterThan(20);
      }
    }
  });
});

describe("closed question scoring", () => {
  it("scores a correct single-best answer", () => {
    const r = scoreClosed(q("q4-db-resilience"), ["B"], true);
    expect(r.correct).toBe(true);
    expect(r.score).toBe(1);
  });

  it("scores a wrong single-best answer as zero", () => {
    const r = scoreClosed(q("q4-db-resilience"), ["C"], true);
    expect(r.correct).toBe(false);
    expect(r.score).toBe(0);
  });

  it("treats option ids case-insensitively and ignores formatting", () => {
    const r = scoreClosed(q("q4-db-resilience"), [" b. "], true);
    expect(r.correct).toBe(true);
  });

  it("is all-or-nothing on multiple-select, as professional exams are", () => {
    const partial = scoreClosed(q("q3-gate-requirements"), ["A", "B", "C"], true);
    expect(partial.correct).toBe(false);
    expect(partial.missing).toEqual(["E"]);

    const withExtra = scoreClosed(q("q3-gate-requirements"), ["A", "B", "C", "E", "D"], true);
    expect(withExtra.correct).toBe(false);
    expect(withExtra.wrong).toEqual(["D"]);

    const full = scoreClosed(q("q3-gate-requirements"), ["E", "A", "C", "B"], true);
    expect(full.correct).toBe(true);
  });

  it("does not reveal the key before the learner has committed", () => {
    const r = scoreClosed(q("q1-pci-scope"), ["B"], false);
    expect(r.revealed).toBe(false);
    expect(r.correct).toBe(true);
  });

  it("opens case-study questions only after their dependency is answered", () => {
    const depends = scenario.questions.filter((x) => x.dependsOn);
    expect(depends.length).toBeGreaterThan(5);
    for (const d of depends) {
      expect(scenario.questions.some((x) => x.id === d.dependsOn), `${d.id} depends on a missing question`).toBe(true);
    }
    expect(isClosed(q("q7-tenant-isolation"))).toBe(false);
  });
});

describe("open design scoring cannot self-certify", () => {
  it("always sets needsHumanReview, however strong the answer looks", () => {
    const strong = analyseOpen(
      q("q7-tenant-isolation"),
      "I enforce tenant isolation in the data layer with row-level security on a tenant_id column. A cross-tenant query is rejected and logged rather than returning rows. Provisioning creates the tenant record and grants a scoped database role. The isolation test runs in the pipeline and fails the build if it regresses. Keys are handled with envelope encryption per tenant.",
      ["Tenant isolation must be provable", "One tenant must not read another"],
    );
    expect(strong.needsHumanReview).toBe(true);
  });

  it("caps the provisional score so a heuristic cannot imply mastery", () => {
    const perfect = analyseOpen(q("q7-tenant-isolation"), `row-level security rls tenant_id constraint separate schema policy throws rejects denies logged provision onboard tenant record migration test automated suite assert pipeline ci kms envelope per-tenant key grant. ${"word ".repeat(140)}`);
    expect(perfect.provisionalScore).toBeLessThanOrEqual(0.7);
  });

  it("flags an answer too short to carry a trade-off", () => {
    const r = analyseOpen(q("q7-tenant-isolation"), "Use RLS.", []);
    expect(r.tooShort).toBe(true);
    expect(r.wordCount).toBeLessThan(120);
    expect(r.findings.join(" ")).toMatch(/words/);
  });

  it("flags an answer that is not anchored to a requirement", () => {
    const text =
      "Postgres is better because joins are supported and the month-end reporting needs referential integrity across invoices and line items with transactions. " +
      "word ".repeat(120);
    const r = analyseOpen(q("q8-defend-relational"), text, [
      "RPO of 15 minutes and RTO of 4 hours for the ledger database",
      "All data, including backups, remains in UK or EU regions",
    ]);
    expect(r.citedRequirements).toBe(false);
    expect(r.findings.join(" ")).toMatch(/anchor/i);
  });

  it("recognises an answer that does engage with a requirement", () => {
    const text =
      "The recovery target is the deciding constraint here. An RTO of four hours and an RPO of fifteen minutes for the ledger database rules out nightly snapshots, " +
      "because a restore would exceed both, so the standby must be automatic rather than a documented runbook. " +
      "word ".repeat(120);
    const r = analyseOpen(q("q4-db-resilience"), text, [
      "RPO of 15 minutes and RTO of 4 hours for the ledger database",
    ]);
    expect(r.citedRequirements).toBe(true);
  });
});

describe("scenario aggregation", () => {
  it("cannot reach the pass mark on objective questions alone", () => {
    const closed = scenario.questions.filter(isClosed).map((x) => scoreClosed(x, x.answers ?? [], true));
    const score = scoreScenario(scenario, closed, []);
    // A perfect objective score is still blocked: the deliverable is unreviewed.
    expect(score.objectiveScore).toBe(1);
    expect(score.needsHumanReview).toBe(true);
    expect(score.blockers.join(" ")).toMatch(/reviewed/);
  });

  it("reports the objective denominator as the number of closed questions", () => {
    const closed = scenario.questions.filter(isClosed).map((x) => scoreClosed(x, x.answers ?? [], true));
    const score = scoreScenario(scenario, closed, []);
    expect(score.objectiveTotal).toBe(scenario.questions.filter(isClosed).length);
    expect(score.objectiveCorrect).toBe(score.objectiveTotal);
  });
});

describe("vague claim challenge", () => {
  it("challenges an unqualified security claim", () => {
    const found = challengeRationale("This design is more secure because we use a private subnet.", ["NFR5 tenant isolation"]);
    expect(found.some((c) => c.challenge.toLowerCase().includes("threat"))).toBe(true);
  });

  it("challenges an unqualified scaling claim", () => {
    const found = challengeRationale("It scales because we can always add more instances later.", []);
    expect(found.some((c) => c.challenge.toLowerCase().includes("bottleneck"))).toBe(true);
  });

  it("challenges an unqualified cost claim", () => {
    const found = challengeRationale("This option is cheaper for the business.", []);
    expect(found.some((c) => c.challenge.toLowerCase().includes("call volume"))).toBe(true);
  });

  it("challenges a pattern named without a reason", () => {
    const found = challengeRationale("We should go microservices for this.", []);
    expect(found.some((c) => c.finding.includes("pattern named"))).toBe(true);
  });

  it("challenges authority substituted for reasoning", () => {
    const found = challengeRationale("This follows industry-standard best practice.", []);
    expect(found.some((c) => c.finding.includes("Authority"))).toBe(true);
  });

  it("rejects a rationale too short to carry a trade-off", () => {
    const short = rationaleIsSubstantive("Use RDS.");
    expect(short.ok).toBe(false);
    expect(short.words).toBe(2);
    const long = rationaleIsSubstantive(
      "I recommend a queue-backed worker because the render path currently blocks the response, which violates the latency requirement, and the cost is a not-yet-ready state in the portal.",
    );
    expect(long.ok).toBe(true);
  });
});

describe("twist adaptation", () => {
  it("detects an answer that engages with the change", () => {
    const original = "Deploy on AWS with RDS Multi-AZ.";
    const revised =
      "The pattern survives: the same queue-backed worker, the same isolation model. What must be re-selected is the relational service, object storage, the queue, identity and key management, each verified against current Azure documentation rather than assumed. Microsoft Entra ID B2B replaces the federation.";
    expect(engagesWithChange(original, revised, ["Azure", "relational", "storage", "queue", "federation"])).toBe(true);
  });

  it("rejects an answer that merely restates the original", () => {
    const original = "Deploy on AWS with RDS Multi-AZ.";
    expect(engagesWithChange(original, original, ["Azure"])).toBe(false);
  });

  it("rejects an answer that does not mention the changed requirement", () => {
    const original = "Deploy on AWS with RDS Multi-AZ.";
    expect(engagesWithChange(original, "Keep everything as it is, it is fine.", ["Azure"])).toBe(false);
  });
});

describe("diagram", () => {
  it("validates the scenario diagram without errors", () => {
    const issues = validateScenarioDiagram(scenario.diagram);
    expect(diagramHasErrors(issues)).toBe(false);
  });

  it("requires every relationship to resolve to a real element", () => {
    const broken = {
      ...scenario.diagram,
      relationships: [
        { id: "bad", sourceId: "api", targetId: "ghost", label: "calls" },
        { id: "bad2", sourceId: "ghost2", targetId: "api", label: "calls" },
      ],
    };
    const issues = validateScenarioDiagram(broken);
    expect(issues.filter((i) => i.severity === "error")).toHaveLength(2);
  });

  it("rejects duplicate element ids", () => {
    const issues = validateScenarioDiagram({
      ...scenario.diagram,
      elements: [...scenario.diagram.elements, scenario.diagram.elements[0]],
    });
    expect(issues.some((i) => i.issue.includes("Duplicate"))).toBe(true);
  });

  it("warns when no data store or no person is drawn", () => {
    const noStore = validateScenarioDiagram({
      ...scenario.diagram,
      elements: scenario.diagram.elements.filter((e) => e.kind !== "data-store"),
    });
    expect(noStore.some((i) => i.issue.includes("data store"))).toBe(true);

    const noPerson = validateScenarioDiagram({
      ...scenario.diagram,
      elements: scenario.diagram.elements.filter((e) => e.kind !== "person"),
    });
    expect(noPerson.some((i) => i.issue.includes("person"))).toBe(true);
  });

  it("renders SVG through the shared C4 renderer, not a decorative image", () => {
    const container = renderScenarioDiagram(scenario.diagram, "container");
    expect(container.svg).toContain("<svg");

    // A container view draws containers and data stores. People and external
    // systems are context, not part of the system boundary, so they belong on
    // the landscape view instead.
    for (const e of scenario.diagram.elements) {
      const inContainerView = e.kind === "container" || e.kind === "data-store";
      if (inContainerView) {
        expect(container.svg, `container view is missing ${e.name}`).toContain(e.name);
      }
    }

    const landscape = renderScenarioDiagram(scenario.diagram, "landscape");
    for (const e of scenario.diagram.elements) {
      const inLandscapeView =
        e.kind === "person" || e.kind === "external-system" || e.kind === "software-system";
      if (inLandscapeView) {
        expect(landscape.svg, `landscape view is missing ${e.name}`).toContain(e.name);
      }
    }
  });

  it("draws every relationship in the container view", () => {
    const svg = renderScenarioDiagram(scenario.diagram, "container").svg;
    for (const r of scenario.diagram.relationships) {
      const source = scenario.diagram.elements.find((e) => e.id === r.sourceId);
      const target = scenario.diagram.elements.find((e) => e.id === r.targetId);
      const bothInContainer =
        (source?.kind === "container" || source?.kind === "data-store") &&
        (target?.kind === "container" || target?.kind === "data-store");
      if (bothInContainer) {
        expect(svg, `relationship "${r.label}" is missing`).toContain(r.label);
      }
    }
  });

  it("answers the four component questions without inventing content", () => {
    const i = interrogateComponent(scenario, "pdf-worker");
    expect(i).not.toBeNull();
    expect(i!.name).toBe("PDF worker");
    expect(i!.connections.length).toBeGreaterThan(0);
    expect(i!.connections.some((c) => c.withName === "Invoicing API")).toBe(true);

    expect(interrogateComponent(scenario, "does-not-exist")).toBeNull();
  });
});

describe("word counting", () => {
  it("counts words", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("")).toBe(0);
  });
});
