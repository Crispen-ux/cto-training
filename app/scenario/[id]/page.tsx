import Link from "next/link";
import { notFound } from "next/navigation";
import { getScenario } from "@/lib/scenario/bank";
import { getAttempt, latestAttempt, type ScenarioAttempt } from "@/lib/scenario/store";
import { renderScenarioDiagram, validateScenarioDiagram, interrogateComponent } from "@/lib/scenario/diagram";
import { unlockedQuestions, isClosed } from "@/lib/scenario/scoring";
import { STAGE_LABELS, STAGE_INSTRUCTIONS, SCENARIO_STAGES, type ScenarioStage } from "@/lib/scenario/types";
import {
  saveConstraints,
  saveDecisions,
  saveAlternatives,
  saveTwist,
  submitScenario,
} from "@/app/scenario-actions";

export const dynamic = "force-dynamic";

const THEME_LABELS: Record<string, string> = {
  "application-architecture": "Application architecture",
  "serverless-event-driven": "Serverless and event-driven",
  "streaming-analytics": "Streaming and analytics",
  "security-identity": "Security and identity",
  "data-architecture": "Data architecture",
  "ai-data": "AI and data",
  "resilience-recovery": "Resilience and recovery",
  "migration-modernisation": "Migration and modernisation",
  "cost-performance": "Cost and performance",
  "hybrid-networking": "Hybrid, APIs and networking",
  "governance-observability": "Governance and observability",
  "executive-risk": "Executive risk decisions",
};

function stageIndex(s: ScenarioStage): number {
  return SCENARIO_STAGES.indexOf(s);
}

/** Everything shown before the learner commits. Deliberately free of the key. */
function ContextBlock({ scenario }: { scenario: NonNullable<ReturnType<typeof getScenario>> }) {
  const diagram = renderScenarioDiagram(scenario.diagram, "container");
  const landscape = renderScenarioDiagram(scenario.diagram, "landscape");
  const issues = validateScenarioDiagram(scenario.diagram);

  return (
    <>
      <h2>Context</h2>
      <p>{scenario.context.businessContext}</p>

      <h3>Objectives</h3>
      <ul className="tight">
        {scenario.context.objectives.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>

      <h3>Stakeholders</h3>
      <ul className="tight">
        {scenario.context.stakeholders.map((s) => (
          <li key={s.name}>
            <strong>{s.name}</strong>, {s.role}: {s.concern}
          </li>
        ))}
      </ul>

      <h3>What is running today</h3>
      <p>{scenario.context.existingInfrastructure}</p>

      <h3>Data characteristics</h3>
      <ul className="tight">
        {scenario.context.dataCharacteristics.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>

      <h3>Compliance obligations</h3>
      <ul className="tight">
        {scenario.context.compliance.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>

      <h2>Requirements</h2>
      <h3>Functional</h3>
      <ul className="tight">
        {scenario.requirements.functional.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h3>Non-functional</h3>
      <ul className="tight">
        {scenario.requirements.nonFunctional.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <h3>Performance and availability targets</h3>
      <ul className="tight">
        {scenario.requirements.performanceAvailability.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>

      <div className="grid cols3">
        <div className="card">
          <h3>Budget</h3>
          <p style={{ fontSize: 13 }}>{scenario.requirements.budget}</p>
        </div>
        <div className="card">
          <h3>Team skills</h3>
          <p style={{ fontSize: 13 }}>{scenario.requirements.teamSkills}</p>
        </div>
        <div className="card">
          <h3>Deadline</h3>
          <p style={{ fontSize: 13 }}>{scenario.requirements.deadline}</p>
        </div>
      </div>

      <h2>Constraints</h2>
      <div className="grid cols3">
        <div>
          <h3>Security</h3>
          <ul className="tight">
            {scenario.constraints.security.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Identity and networking</h3>
          <ul className="tight">
            {scenario.constraints.identityNetworking.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Operational</h3>
          <ul className="tight">
            {scenario.constraints.operational.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2>Architecture as it stands</h2>
      <figure className="diagram">
        <div className="preview-frame" dangerouslySetInnerHTML={{ __html: diagram.svg }} />
        <figcaption className="muted">{diagram.caption}</figcaption>
      </figure>
      <details>
        <summary>Landscape view, showing people and external systems</summary>
        <figure className="diagram">
          <div className="preview-frame" dangerouslySetInnerHTML={{ __html: landscape.svg }} />
          <figcaption className="muted">{landscape.caption}</figcaption>
        </figure>
      </details>

      {issues.length > 0 && (
        <p className="notice warn">
          The diagram carries {issues.length} note(s): {issues.map((i) => i.issue).join(" ")}
        </p>
      )}

      {scenario.diagram.omissions && scenario.diagram.omissions.length > 0 && (
        <>
          <h3>What the diagram deliberately leaves out</h3>
          <ul className="tight">
            {scenario.diagram.omissions.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </>
      )}

      <h2>Select a component and interrogate it</h2>
      <div className="grid cols3">
        {scenario.diagram.elements
          .filter((e) => e.kind === "container" || e.kind === "data-store" || e.kind === "external-system")
          .map((e) => {
            const i = interrogateComponent(scenario, e.id)!;
            return (
              <div className="card" key={e.id}>
                <span className="badge">{e.kind}</span>
                <h3>{e.name}</h3>
                <p style={{ fontSize: 13 }}>{e.description}</p>
                {e.technology && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    {e.technology}
                  </p>
                )}
                <p className="muted" style={{ fontSize: 13 }}>
                  Connects:{" "}
                  {i.connections.map((c, n) => (
                    <span key={n}>
                      {n > 0 && ", "}
                      {c.direction} {c.label} → {c.withName}
                    </span>
                  ))}
                </p>
                <p className="muted" style={{ fontSize: 13 }}>
                  What fails if this is unavailable, and what boundary it establishes, is yours to state.
                </p>
              </div>
            );
          })}
      </div>

      <h2>What is not known</h2>
      <p className="muted">
        A real engagement starts here. Name what you would ask for before you design, because a design built
        on an unexamined assumption fails in a way that is expensive to unwind.
      </p>
      <div className="grid cols3">
        <div>
          <h3>Stated as fact</h3>
          <ul className="tight">
            {scenario.ambiguity.explicitFacts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Not stated — assume at your peril</h3>
          <ul className="tight">
            {scenario.ambiguity.assumptions.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
        <div>
          <h3>Genuinely missing</h3>
          <ul className="tight">
            {scenario.ambiguity.missingInformation.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </div>
      </div>

      <h3>Ambiguous on purpose</h3>
      <ul className="tight">
        {scenario.ambiguity.ambiguities.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </>
  );
}

function ClosedQuestion({
  q,
  attempt,
  revealed,
}: {
  q: NonNullable<ReturnType<typeof getScenario>>["questions"][number];
  attempt: ScenarioAttempt | undefined;
  revealed: boolean;
}) {
  const result = attempt?.closedResults.find((r) => r.questionId === q.id);
  return (
    <div className="card">
      <span className="badge">{q.kind.replace("-", " ")}</span>
      <p className="q">{q.prompt}</p>
      <fieldset style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className="muted" style={{ fontSize: 13 }}>
          {q.kind === "multiple-select" ? "Select every that applies. Partial credit is not given." : "Select one."}
        </legend>
        {q.options?.map((o) => {
          const chosen = attempt?.answers[q.id]?.includes(o.id) ?? false;
          const state = revealed
            ? q.answers?.includes(o.id)
              ? "correct"
              : result?.selected.includes(o.id)
                ? "wrong"
                : ""
            : "";
          return (
            <label key={o.id} style={{ display: "block", fontSize: 14 }}>
              <input
                type={q.kind === "multiple-select" ? "checkbox" : "radio"}
                name={`q_${q.id}`}
                value={o.id}
                defaultChecked={chosen}
                disabled={revealed}
              />{" "}
              <strong>{o.id}</strong>. {o.text}{" "}
              {state && <span className={state}>{state === "correct" ? "✓ correct" : "✗ you chose this"}</span>}
            </label>
          );
        })}
      </fieldset>
      {revealed && q.rationale && (
        <p className={result?.correct ? "notice ok" : "notice warn"}>
          {q.rationale}
          {result && !result.correct && result.wrong.length > 0 && (
            <> You chose {result.wrong.join(", ")}.</>
          )}
        </p>
      )}
      {revealed && (q.distractors?.length ?? 0) > 0 && (
        <details>
          <summary>Why the other options are wrong here</summary>
          <ul className="tight">
            {q.distractors?.map((d) => (
              <li key={d.optionId}>
                <strong>{d.optionId}</strong>: {d.whyWrong} <em>({d.mistake})</em>
              </li>
            ))}
          </ul>
        </details>
      )}
      {revealed && (q.defensibleAlternatives?.length ?? 0) > 0 && (
        <details>
          <summary>Answers that would also have passed</summary>
          <ul className="tight">
            {q.defensibleAlternatives?.map((a, i) => (
              <li key={i}>
                {a.answer} <em>— correct when: {a.conditions}</em>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

export default async function ScenarioExercise({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ attempt?: string; ok?: string; error?: string; submitted?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const scenario = getScenario(id);
  if (!scenario) notFound();

  const attempt = sp.attempt ? getAttempt(sp.attempt) : latestAttempt(scenario.id);
  const stage: ScenarioStage = attempt?.stage ?? "read";
  const revealed = stage === "model-answer";
  const idx = stageIndex(stage);

  const answered = new Set(Object.keys(attempt?.answers ?? {}));
  const open = unlockedQuestions(scenario.questions, answered);
  const closedOpen = open.filter(isClosed);
  const textOpen = open.filter((x) => !isClosed(x) && x.kind !== "defence");
  const defenceQ = scenario.questions.find((x) => x.kind === "defence");

  return (
    <>
      <p>
        <Link href="/scenario">← Scenario lab</Link>
      </p>
      <h1>{scenario.title}</h1>
      <p>
        <span className="badge">{THEME_LABELS[scenario.theme] ?? scenario.theme}</span>{" "}
        <span className="badge">{scenario.difficulty}</span>{" "}
        <span className="badge">{scenario.cloudScope}</span>{" "}
        <span className="badge">{scenario.timeEstimateMinutes} min</span>
      </p>

      {sp.ok && <p className="notice ok">{sp.ok}</p>}
      {sp.error && <p className="notice err">{sp.error}</p>}

      <h2>The sequence</h2>
      <ol>
        {SCENARIO_STAGES.map((s, i) => (
          <li key={s} className={i === idx ? "q" : i < idx ? "correct" : "muted"}>
            {STAGE_LABELS[s]} — <span className="muted">{STAGE_INSTRUCTIONS[s]}</span>
          </li>
        ))}
      </ol>

      {stage === "read" && (
        <>
          <ContextBlock scenario={scenario} />
          <h2>Stage 2 — the decisive constraints</h2>
          <p className="muted">
            Before you choose anything, state which requirements actually decide the design, and what you
            would need to ask the client. This is recorded with your attempt, so answer it as you would in a
            real review.
          </p>
          <form action={saveConstraints}>
            <input type="hidden" name="attemptId" value={attempt?.id ?? ""} />
            <input type="hidden" name="scenarioId" value={scenario.id} />
            <p>
              <label>
                Requirements that decide this design, one per line
                <br />
                <textarea name="decisive" rows={5} style={{ width: "100%" }} />
              </label>
            </p>
            <p>
              <label>
                What you still need to confirm before designing, one per line
                <br />
                <textarea name="questionsToAsk" rows={4} style={{ width: "100%" }} />
              </label>
            </p>
            <button className="btn" type="submit">
              Commit to the decisive constraints
            </button>
          </form>
        </>
      )}

      {stage === "decide" && (
        <>
          <h2>Your stated decisive constraints</h2>
          <ul className="tight">
            {attempt?.decisiveRequirements.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>

          <h2>Stage 3 — choose and justify</h2>
          <p className="muted">
            Answer what is open to you. Case-study questions unlock as you answer the ones before them. The
            answer key stays hidden until you submit.
          </p>
          <form action={saveDecisions}>
            <input type="hidden" name="attemptId" value={attempt?.id ?? ""} />
            <input type="hidden" name="scenarioId" value={scenario.id} />

            {closedOpen.map((q) => (
              <ClosedQuestion key={q.id} q={q} attempt={attempt} revealed={false} />
            ))}

            {textOpen.map((q) => (
              <div className="card" key={q.id}>
                <span className="badge">{q.kind.replace("-", " ")}</span>
                <p className="q">{q.prompt}</p>
                {q.rubric && (
                  <p className="muted" style={{ fontSize: 13 }}>
                    Judged on: {q.rubric.map((r) => r.criterion).join("; ")}. Minimum {q.minWords} words.
                  </p>
                )}
                <textarea
                  name={`text_${q.id}`}
                  rows={10}
                  style={{ width: "100%" }}
                  defaultValue={attempt?.openAnswers[q.id] ?? ""}
                />
              </div>
            ))}

            <div className="card">
              <h3>Your rationale for the choice</h3>
              <p className="muted" style={{ fontSize: 13 }}>
                State the mechanism and the requirement it satisfies. Claims such as &ldquo;more secure&rdquo;,
                &ldquo;scales better&rdquo; or &ldquo;cheaper&rdquo; will be challenged for the threat, the
                bottleneck or the workload you mean.
              </p>
              <textarea
                name="rationale"
                rows={8}
                style={{ width: "100%" }}
                defaultValue={attempt?.rationale ?? ""}
              />
            </div>
            <button className="btn" type="submit">
              Commit to the decision
            </button>
          </form>
        </>
      )}

      {stage === "alternatives" && (
        <>
          <h2>Stage 4 — alternatives and trade-offs</h2>
          <p className="muted">
            Your rationale, and the challenges it raised. A challenge is not a mark against you: it names what
            you have to answer to keep the claim.
          </p>
          <p className="card">{attempt?.rationale}</p>

          {(attempt?.challenges.length ?? 0) > 0 && (
            <div className="notice warn">
              <strong>Answer these to keep your claim:</strong>
              <ul className="tight">
                {attempt?.challenges.map((c, i) => (
                  <li key={i}>
                    {c.excerpt && <em>&ldquo;{c.excerpt}&rdquo; </em>}
                    {c.finding} <strong>{c.challenge}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form action={saveAlternatives}>
            <input type="hidden" name="attemptId" value={attempt?.id ?? ""} />
            <input type="hidden" name="scenarioId" value={scenario.id} />
            <p>
              <label>
                Alternatives you rejected, and the condition under which each would win
                <br />
                <textarea name="alternatives" rows={8} style={{ width: "100%" }} defaultValue={attempt?.alternatives ?? ""} />
              </label>
            </p>
            {defenceQ && (
              <p>
                <label>
                  {defenceQ.prompt}
                  <br />
                  <textarea
                    name="defence"
                    rows={10}
                    style={{ width: "100%" }}
                    defaultValue={attempt?.openAnswers[defenceQ.id] ?? ""}
                  />
                </label>
              </p>
            )}
            <button className="btn" type="submit">
              Commit to the alternatives
            </button>
          </form>
        </>
      )}

      {stage === "twist" && (
        <>
          <h2>Stage 5 — the requirement changes</h2>
          <p className="notice warn">{scenario.twist.change}</p>
          <p className="muted">{scenario.twist.revisePrompt}</p>
          <form action={saveTwist}>
            <input type="hidden" name="attemptId" value={attempt?.id ?? ""} />
            <input type="hidden" name="scenarioId" value={scenario.id} />
            <textarea
              name="twistAnswer"
              rows={12}
              style={{ width: "100%" }}
              defaultValue={attempt?.twistAnswer ?? ""}
            />
            <button className="btn" type="submit">
              Commit the revision
            </button>
          </form>
        </>
      )}

      {stage === "deliverable" && (
        <>
          <h2>Stage 6 — the deliverable</h2>
          <p className="q">{scenario.deliverable.prompt}</p>
          <h3>Acceptance criteria</h3>
          <ul className="tight">
            {scenario.deliverable.acceptance.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <form action={submitScenario}>
            <input type="hidden" name="attemptId" value={attempt?.id ?? ""} />
            <input type="hidden" name="scenarioId" value={scenario.id} />
            <p>
              <label>
                Kind of artefact
                <br />
                <input name="deliverableKind" defaultValue={scenario.deliverable.kind} style={{ width: "100%" }} />
              </label>
            </p>
            <textarea
              name="deliverable"
              rows={20}
              style={{ width: "100%" }}
              defaultValue={attempt?.deliverable ?? ""}
            />
            <button className="btn" type="submit">
              Submit the attempt
            </button>
          </form>
        </>
      )}

      {revealed && attempt && (
        <>
          <h2>Stage 7 — results and model answer</h2>

          {attempt.score && (
            <>
              <div className="grid cols5">
                <div className="card">
                  <div className="big">
                    {attempt.score.objectiveCorrect}/{attempt.score.objectiveTotal}
                  </div>
                  <p className="muted">Objective questions</p>
                </div>
                <div className="card">
                  <div className="big">{Math.round(attempt.score.objectiveScore * 100)}%</div>
                  <p className="muted">Objective score</p>
                </div>
                {attempt.score.stages.map((s) => (
                  <div className="card" key={s.stage}>
                    <div className="big">{Math.round(s.earned * 100)}</div>
                    <p className="muted">{s.stage}</p>
                  </div>
                ))}
              </div>
              {attempt.score.needsHumanReview && (
                <p className="notice warn">
                  <strong>This is not yet evidence.</strong> Design quality is not something a heuristic can
                  certify. {attempt.score.blockers.join(" ")}
                </p>
              )}
            </>
          )}

          <h2>Your answers</h2>
          {scenario.questions.map((q) =>
            isClosed(q) ? (
              <ClosedQuestion key={q.id} q={q} attempt={attempt} revealed />
            ) : (
              <div className="card" key={q.id}>
                <span className="badge">{q.kind.replace("-", " ")}</span>
                <p className="q">{q.prompt}</p>
                <p className="muted" style={{ fontSize: 13 }}>
                  You wrote:
                </p>
                <p>{attempt.openAnswers[q.id] || <em>not answered</em>}</p>
                {(() => {
                  const r = attempt.openResults.find((x) => x.questionId === q.id);
                  if (!r) return null;
                  return (
                    <div className="notice warn">
                      <p>
                        Provisional coverage {Math.round(r.provisionalScore * 100)}% · {r.wordCount} words
                        {r.citedRequirements ? " · anchored to a requirement" : " · not anchored to a requirement"}
                      </p>
                      {r.findings.map((f, i) => (
                        <p key={i}>{f}</p>
                      ))}
                      {q.rationale && <p>{q.rationale}</p>}
                    </div>
                  );
                })()}
              </div>
            ),
          )}

          <h2>Your revision after the change</h2>
          <p className="card">{attempt.twistAnswer || <em>not answered</em>}</p>
          {!attempt.twistApplied && (
            <p className="notice warn">
              The revision did not visibly engage with the changed requirement. Restating the original answer
              is not adapting.
            </p>
          )}

          <h2>Model answer</h2>
          <p className="muted">
            A benchmark for reasoning, not a single privileged answer. Where your design differs and you can
            state the conditions, yours is defensible too.
          </p>

          <div className="card">
            <h3>The business problem</h3>
            <p>{scenario.modelAnswer.businessProblem}</p>
            <h3>Decisive requirements</h3>
            <ul className="tight">
              {scenario.modelAnswer.decisiveRequirements.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <h3>Important constraints</h3>
            <ul className="tight">
              {scenario.modelAnswer.importantConstraints.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
            <h3>Pattern</h3>
            <p>{scenario.modelAnswer.pattern}</p>
          </div>

          <div className="card">
            <h3>Recommended, and why</h3>
            <ul className="tight">
              {scenario.modelAnswer.recommendedServices.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong> ({r.cloud}): {r.why}
                </li>
              ))}
            </ul>
            <h3>Rejected, and when each would win</h3>
            <ul className="tight">
              {scenario.modelAnswer.rejectedAlternatives.map((r) => (
                <li key={r.name}>
                  <strong>{r.name}</strong>: {r.whyNot} <em>Correct instead when: {r.whenRight}</em>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Trade-offs accepted</h3>
            <ul className="tight">
              {scenario.modelAnswer.tradeOffs.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h3>Security controls</h3>
            <ul className="tight">
              {scenario.modelAnswer.securityControls.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h3>Scaling, recovery and monitoring</h3>
            <ul className="tight">
              {scenario.modelAnswer.scalingRecoveryMonitoring.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>Assumptions to confirm</h3>
            <ul className="tight">
              {scenario.modelAnswer.assumptionsToConfirm.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <h3>Evidence that would change the recommendation</h3>
            <ul className="tight">
              {scenario.modelAnswer.evidenceThatWouldChangeRecommendation.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>

          <h3>The change, and what it tests</h3>
          <p className="card">{scenario.twist.modelAnswer}</p>

          <h2>Sources</h2>
          <p className="muted">
            Official guidance is cited as official. Nothing below is presented as current unless it was
            checked on the date shown.
          </p>
          <ul className="tight">
            {scenario.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} rel="noreferrer noopener" target="_blank">
                  {s.title}
                </a>{" "}
                <span className="badge">{s.authority}</span>{" "}
                <span className="muted">checked {s.reviewed}</span>
                <br />
                <span className="muted" style={{ fontSize: 13 }}>
                  Supports: {s.supports}
                </span>
              </li>
            ))}
          </ul>

          <h2>Submit for review</h2>
          <p className="muted">
            Submitting turns this attempt into a submission someone else can judge. Until a reviewer scores
            it, it is practice, not evidence.
          </p>
          <p>
            <Link className="btn" href="/review">
              Go to the review queue
            </Link>{" "}
            <Link className="btn ghost" href="/scenario">
              Back to the scenario lab
            </Link>
          </p>
        </>
      )}
    </>
  );
}
