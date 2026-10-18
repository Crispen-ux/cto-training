import Link from "next/link";
import { getProject } from "@/lib/architecture/store";
import { contextDiagram, containerDiagram, componentDiagram, codeDiagram, landscapeDiagram, deploymentDiagram, dynamicDiagram, type DiagramSpec } from "@/lib/architecture/svg";
import { runChecks, summariseChecks } from "@/lib/architecture/checks";
import PrintButton from "@/components/PrintButton";
import { WIZARD_STEPS, type WizardStepId } from "@/lib/architecture/sample";
import {
  saveProjectStep,
  addElementAction,
  deleteElementAction,
  addRelationshipAction,
  deleteRelationshipAction,
  saveAdrAction,
  saveRequirementAction,
  saveRiskAction,
  toggleComponentDiagramAction,
  toggleDiagramAction,
  saveScenarioAction,
  assignDeploymentAction,
} from "../../architecture-actions";

export const dynamic = "force-dynamic";

function Preview({ diagram }: { diagram: DiagramSpec }) {
  return (
    <div className="preview">
      <h3>{diagram.title}</h3>
      <div className="preview-frame" dangerouslySetInnerHTML={{ __html: diagram.svg }} />
      <p className="muted">{diagram.caption}</p>
    </div>
  );
}

function Nav({ step, id }: { step: WizardStepId; id: string }) {
  const i = WIZARD_STEPS.findIndex((s) => s.id === step);
  return (
    <div className="wizard-steps">
      {WIZARD_STEPS.map((s, n) => (
        <a key={s.id} href={`/architecture/wizard?step=${s.id}&id=${id}`} className={n === i ? "active" : n < i ? "done" : ""}>
          {n + 1}. {s.label}
        </a>
      ))}
    </div>
  );
}

function RelationshipForm({ id, step, elements, excludeId }: { id: string; step: string; elements: { id: string; name: string }[]; excludeId?: string }) {
  return (
    <form action={addRelationshipAction} className="inline-form">
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="step" value={step} />
      <label>From</label>
      <select name="sourceId" defaultValue={excludeId ?? ""}>
        <option value="">Choose…</option>
        {elements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <label>To</label>
      <select name="targetId" defaultValue="">
        <option value="">Choose…</option>
        {elements.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
      </select>
      <label>Label</label>
      <input name="label" placeholder="reads from" />
      <label>Protocol / technology</label>
      <input name="technology" placeholder="HTTPS/JSON" />
      <label>Multiplicity (code level only)</label>
      <input name="multiplicity" placeholder="1..*" />
      <p><button className="btn" type="submit">Add relationship</button></p>
    </form>
  );
}

function RelationshipList({ id, step, relationships, nameOf }: { id: string; step: string; relationships: { id: string; sourceId: string; targetId: string; label: string; technology?: string }[]; nameOf: (x: string) => string }) {
  if (relationships.length === 0) return <p className="muted">No relationships recorded yet.</p>;
  return (
    <ul className="tight">
      {relationships.map((r) => (
        <li key={r.id}>
          {nameOf(r.sourceId)} → {nameOf(r.targetId)}
          {r.label ? `: ${r.label}` : " (no label)"}{r.technology ? ` [${r.technology}]` : ""}
          <form action={deleteRelationshipAction} style={{ display: "inline" }}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="step" value={step} />
            <input type="hidden" name="relationshipId" value={r.id} />
            <button className="btn ghost" type="submit">remove</button>
          </form>
        </li>
      ))}
    </ul>
  );
}

export default async function WizardPage({ searchParams }: { searchParams: Promise<{ step?: string; id?: string; issues?: string }> }) {
  const sp = await searchParams;
  const id = sp.id ?? "";
  const step = (WIZARD_STEPS.find((s) => s.id === sp.step)?.id ?? "project") as WizardStepId;
  const p = getProject(id);
  if (!p) {
    return <div className="card">Project not found. <Link href="/architecture">Back to projects</Link></div>;
  }
  const nameOf = (x: string) => p.elements.find((e) => e.id === x)?.name ?? x;
  const elements = p.elements.map((e) => ({ id: e.id, name: e.name }));
  const contextEls = p.elements.filter((e) => ["person", "external-system", "software-system"].includes(e.kind));
  const containerEls = p.elements.filter((e) => e.kind === "container" || e.kind === "data-store");
  const componentEls = p.elements.filter((e) => e.kind === "component" || e.kind === "code");
  const issues = sp.issues?.split(" | ").filter(Boolean) ?? [];
  const i = WIZARD_STEPS.findIndex((s) => s.id === step);
  const nextStep = WIZARD_STEPS[Math.min(i + 1, WIZARD_STEPS.length - 1)].id;
  const prevStep = WIZARD_STEPS[Math.max(i - 1, 0)].id;

  return (
    <>
      <h1>{p.name || "Untitled project"}</h1>
      <Nav step={step} id={id} />
      {issues.length > 0 && <div className="notice err">{issues.join(" · ")}</div>}

      <div className="wizard">
        <div className="wizard-form">

          {step === "project" && (
            <form action={saveProjectStep} className="card">
              <input type="hidden" name="id" value={id} />
              <input type="hidden" name="step" value={step} />
              <label htmlFor="pname">Project name</label>
              <input id="pname" name="name" defaultValue={p.name} required />
              <label htmlFor="purpose">Purpose (this becomes the executive summary seed)</label>
              <textarea id="purpose" name="purpose" defaultValue={p.purpose} />
              <label htmlFor="biz">Business context and objectives</label>
              <textarea id="biz" name="businessContext" defaultValue={p.businessContext} />
              <label htmlFor="stk">Stakeholders (one per line)</label>
              <textarea id="stk" name="stakeholders" defaultValue={p.stakeholders.join("\n")} />
              <label htmlFor="scope">Scope (in and out)</label>
              <textarea id="scope" name="scope" defaultValue={p.scope} />
              <label htmlFor="assump">Assumptions (one per line; shown as unverified until confirmed)</label>
              <textarea id="assump" name="assumptions" defaultValue={p.assumptions.join("\n")} />
              <label htmlFor="constr">Constraints (one per line)</label>
              <textarea id="constr" name="constraints" defaultValue={p.constraints.join("\n")} />
              <input type="hidden" name="next" value={nextStep} />
              <WizardButtons next={nextStep} prev={prevStep} id={id} inForm />
            </form>
          )}

          {step === "context" && (
            <>
              <div className="card">
                <h2>People, external systems and the system itself</h2>
                <form action={addElementAction} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="step" value={step} />
                  <label>Type</label>
                  <select name="kind">
                    <option value="person">Person</option>
                    <option value="software-system">Software system (this system)</option>
                    <option value="external-system">External system</option>
                  </select>
                  <label>Name</label>
                  <input name="name" required />
                  <label>Description</label>
                  <input name="description" />
                  <p><button className="btn" type="submit">Add</button></p>
                </form>
                <ul className="tight">
                  {contextEls.map((e) => (
                    <li key={e.id}>{e.name} <span className="muted">[{e.kind}]</span>
                      <form action={deleteElementAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="elementId" value={e.id} />
                        <button className="btn ghost" type="submit">remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h2>Relationships</h2>
                <RelationshipForm id={id} step={step} elements={elements} />
                <RelationshipList id={id} step={step} relationships={p.relationships} nameOf={nameOf} />
              </div>
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "containers" && (
            <>
              <div className="card">
                <h2>Containers</h2>
                <form action={addElementAction} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="step" value={step} />
                  <label>Type</label>
                  <select name="kind" defaultValue="container">
                    <option value="container">Container</option>
                    <option value="data-store">Data store</option>
                  </select>
                  <label>Container type</label>
                  <select name="containerType" defaultValue="service">
                    {["web-app", "api", "service", "worker", "queue", "database", "cache", "object-store", "file-share", "gateway", "other"].map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <label>Name</label>
                  <input name="name" required />
                  <label>Responsibility / description</label>
                  <input name="description" />
                  <label>Technology</label>
                  <input name="technology" placeholder="e.g. Node.js 22" />
                  <label><input type="checkbox" name="unverified" /> Mark as unverified</label>
                  <p><button className="btn" type="submit">Add container</button></p>
                </form>
                <ul className="tight">
                  {containerEls.map((e) => (
                    <li key={e.id}>{e.name} <span className="muted">[{e.kind}]{e.technology ? ` ${e.technology}` : " (no technology)"}</span>
                      <form action={deleteElementAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="elementId" value={e.id} />
                        <button className="btn ghost" type="submit">remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h2>Relationships between containers</h2>
                <RelationshipForm id={id} step={step} elements={elements} />
                <RelationshipList id={id} step={step} relationships={p.relationships.filter((r) => containerEls.some((c) => c.id === r.sourceId) || containerEls.some((c) => c.id === r.targetId))} nameOf={nameOf} />
              </div>
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "components" && (
            <>
              <div className="card">
                <h2>Components</h2>
                {containerEls.length === 0 ? <p className="muted">Add containers first, then come back.</p> : (
                  <form action={addElementAction} className="inline-form">
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="step" value={step} />
                    <label>Level</label>
                    <select name="kind" defaultValue="component">
                      <option value="component">Component</option>
                      <option value="code">Code element (optional)</option>
                    </select>
                    <label>Inside container</label>
                    <select name="parentId">
                      {containerEls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <label>Name</label>
                    <input name="name" required />
                    <label>Responsibility</label>
                    <input name="description" />
                    <label>Technology</label>
                    <input name="technology" />
                    <label>Attributes, code level only (one per line, prefix + or -)</label>
                    <textarea name="attributes" placeholder={"+ id: string\n- retries: number"} />
                    <label>Operations, code level only (one per line)</label>
                    <textarea name="methods" placeholder={"+ reserve(lines: Line[]): Promise<Reservation>"} />
                    <p><button className="btn" type="submit">Add</button></p>
                  </form>
                )}
                <ul className="tight">
                  {componentEls.map((e) => (
                    <li key={e.id}>{e.name} <span className="muted">in {nameOf(e.parentId ?? "")}</span>
                      <form action={deleteElementAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="elementId" value={e.id} />
                        <button className="btn ghost" type="submit">remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h2>Generate level 3 diagrams for</h2>
                {containerEls.map((c) => (
                  <form key={c.id} action={toggleComponentDiagramAction} style={{ display: "inline", marginRight: 8 }}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="containerId" value={c.id} />
                    <button className={p.componentDiagramContainerIds.includes(c.id) ? "btn" : "btn ghost"} type="submit">
                      {p.componentDiagramContainerIds.includes(c.id) ? "✓ " : ""}{c.name}
                    </button>
                  </form>
                ))}
              </div>

              <div className="card">
                <h2>Generate level 4 (code) diagrams for</h2>
                <p className="muted">Optional level. Only add code elements where they tell a story worth keeping.</p>
                {componentEls.filter((c) => c.kind === "component").map((c) => (
                  <form key={c.id} action={toggleDiagramAction} style={{ display: "inline", marginRight: 8 }}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="step" value={step} />
                    <input type="hidden" name="target" value="code" />
                    <input type="hidden" name="ref" value={c.id} />
                    <button className={p.codeDiagramComponentIds.includes(c.id) ? "btn" : "btn ghost"} type="submit">
                      {p.codeDiagramComponentIds.includes(c.id) ? "✓ " : ""}{c.name}
                    </button>
                  </form>
                ))}
              </div>

              {p.componentDiagramContainerIds.map((cid) => (
                <Preview key={`c3-${cid}`} diagram={componentDiagram(p, cid)} />
              ))}
              {p.codeDiagramComponentIds.map((cid) => (
                <Preview key={`c4-${cid}`} diagram={codeDiagram(p, cid)} />
              ))}
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "deployment" && (
            <>
              <div className="card">
                <h2>Deployment nodes</h2>
                <p className="muted">Environments and infrastructure that containers run inside. Nodes can be nested.</p>
                <form action={addElementAction} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="step" value={step} />
                  <label>Kind</label>
                  <select name="kind" defaultValue="deployment-node">
                    <option value="deployment-node">Deployment node (environment)</option>
                    <option value="infrastructure-node">Infrastructure node (DNS, load balancer, database service)</option>
                  </select>
                  <label>Inside (leave empty for top level)</label>
                  <select name="parentId" defaultValue="">
                    <option value="">Top level</option>
                    {p.elements.filter((e) => e.kind === "deployment-node" || e.kind === "infrastructure-node").map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                  </select>
                  <label>Name</label>
                  <input name="name" required />
                  <label>Description</label>
                  <input name="description" />
                  <p><button className="btn" type="submit">Add node</button></p>
                </form>
                <ul className="tight">
                  {p.elements.filter((e) => e.kind === "deployment-node" || e.kind === "infrastructure-node").map((n) => (
                    <li key={n.id}>{n.parentId ? `${nameOf(n.parentId)} / ` : ""}{n.name} <span className="muted">[{n.kind}]</span>
                      <form action={deleteElementAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="step" value={step} />
                        <input type="hidden" name="elementId" value={n.id} />
                        <button className="btn ghost" type="submit">remove</button>
                      </form>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="card">
                <h2>Assign containers to a node</h2>
                {containerEls.length === 0 ? <p className="muted">Add containers first.</p> : (
                  <form action={assignDeploymentAction} className="inline-form">
                    <input type="hidden" name="id" value={id} />
                    <label>Container or data store</label>
                    <select name="elementId" defaultValue={containerEls[0]?.id}>
                      {containerEls.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <label>Deploy into</label>
                    <select name="nodeId" defaultValue="">
                      <option value="">Not deployed (unassigned)</option>
                      {p.elements.filter((e) => e.kind === "deployment-node" || e.kind === "infrastructure-node").map((n) => <option key={n.id} value={n.id}>{n.name}</option>)}
                    </select>
                    <p><button className="btn" type="submit">Assign</button></p>
                  </form>
                )}
                <ul className="tight">
                  {containerEls.map((c) => <li key={c.id}>{c.name}: {c.parentId ? nameOf(c.parentId) : "unassigned"}</li>)}
                </ul>
              </div>

              <Preview diagram={deploymentDiagram(p)} />
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "scenarios" && (
            <>
              <div className="card">
                <h2>New dynamic scenario</h2>
                <p className="muted">
                  One line per step: <code>Actor, Actor -&gt; message | note</code>. Use the exact element names, separated by commas.
                </p>
                <form action={saveScenarioAction}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="step" value={step} />
                  <label htmlFor="sn">Name</label>
                  <input id="sn" name="name" required />
                  <label htmlFor="sd">Description</label>
                  <textarea id="sd" name="description" />
                  <label htmlFor="ss">Steps</label>
                  <textarea id="ss" name="steps" placeholder={"Web app -> Order API -> POST /orders | HTTPS/JSON\nOrder API -> Order database -> writes reservation | SQL"} />
                  <p><button className="btn" type="submit">Save scenario</button></p>
                </form>
              </div>

              <div className="card">
                <h2>Scenarios</h2>
                {p.scenarios.length === 0 ? <p className="muted">No scenarios yet.</p> : p.scenarios.map((s) => (
                  <div key={s.id} style={{ marginBottom: 10 }}>
                    <strong>{s.name}</strong> ({s.steps.length} steps)
                    <form action={toggleDiagramAction} style={{ display: "inline", marginLeft: 8 }}>
                      <input type="hidden" name="id" value={id} />
                      <input type="hidden" name="step" value={step} />
                      <input type="hidden" name="target" value="scenario" />
                      <input type="hidden" name="ref" value={s.id} />
                      <button className={p.dynamicScenarioIds.includes(s.id) ? "btn" : "btn ghost"} type="submit">
                        {p.dynamicScenarioIds.includes(s.id) ? "✓ in report" : "add to report"}
                      </button>
                    </form>
                    {p.dynamicScenarioIds.includes(s.id) && <Preview diagram={dynamicDiagram(p, s.id)} />}
                  </div>
                ))}
              </div>

              <div className="card">
                <h2>Other diagrams in the report</h2>
                {[
                  { target: "landscape", label: "System landscape diagram", on: p.includeLandscape },
                  { target: "deployment", label: "Deployment diagram", on: p.includeDeployment },
                ].map((t) => (
                  <form key={t.target} action={toggleDiagramAction} style={{ display: "inline", marginRight: 8 }}>
                    <input type="hidden" name="id" value={id} />
                    <input type="hidden" name="step" value={step} />
                    <input type="hidden" name="target" value={t.target} />
                    <button className={t.on ? "btn" : "btn ghost"} type="submit">{t.on ? "✓ " : ""}{t.label}</button>
                  </form>
                ))}
              </div>

              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "decisions" && (
            <>
              {p.adrs.map((a) => (
                <div className="card" key={a.id}>
                  <h2>ADR-{String(a.number).padStart(4, "0")}: {a.title}</h2>
                  <p className="muted">{a.status}{a.aiDrafted ? " · AI draft, not human-reviewed" : ""}</p>
                </div>
              ))}
              <div className="card">
                <h2>New decision (MADR)</h2>
                <form action={saveAdrAction}>
                  <input type="hidden" name="id" value={id} />
                  <label htmlFor="t">Title</label>
                  <input id="t" name="title" required />
                  <label htmlFor="d">Date</label>
                  <input id="d" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  <label htmlFor="a">Author</label>
                  <input id="a" name="author" />
                  <label htmlFor="c">Context</label>
                  <textarea id="c" name="context" required />
                  <label htmlFor="ps">Problem statement</label>
                  <textarea id="ps" name="problemStatement" />
                  <label htmlFor="dd">Decision drivers (one per line)</label>
                  <textarea id="dd" name="decisionDrivers" />
                  <label htmlFor="ot">Options — titles (one per line, at least two)</label>
                  <textarea id="ot" name="optionTitles" required />
                  <label htmlFor="op">Options — pros (one per line, matching order)</label>
                  <textarea id="op" name="optionPros" />
                  <label htmlFor="oc">Options — cons (one per line, matching order)</label>
                  <textarea id="oc" name="optionCons" />
                  <label htmlFor="r">Rationale</label>
                  <textarea id="r" name="rationale" required />
                  <label htmlFor="pc">Positive consequences (one per line)</label>
                  <textarea id="pc" name="positiveConsequences" />
                  <label htmlFor="nc">Negative consequences (one per line)</label>
                  <textarea id="nc" name="negativeConsequences" />
                  <label htmlFor="rm">Risks and mitigations (one per line)</label>
                  <textarea id="rm" name="risksAndMitigations" />
                  <label htmlFor="sc">Security and compliance</label>
                  <textarea id="sc" name="securityAndCompliance" />
                  <label htmlFor="co">Cost and operations</label>
                  <textarea id="co" name="costAndOperations" />
                  <label htmlFor="st">Status</label>
                  <select id="st" name="status" defaultValue="proposed">
                    <option value="proposed">Proposed</option>
                    <option value="accepted">Accepted</option>
                    <option value="rejected">Rejected</option>
                    <option value="deprecated">Deprecated</option>
                    <option value="superseded">Superseded</option>
                  </select>
                  <fieldset>
                    <legend>Affected elements</legend>
                    {p.elements.map((e) => (
                      <label key={e.id} className="check">
                        <input type="checkbox" name="linkedElementIds" value={e.id} /> {e.name}
                      </label>
                    ))}
                  </fieldset>
                  <p><button className="btn" type="submit">Save decision</button></p>
                  <p className="muted">Accepted requires context, two options, a chosen option, rationale and both consequence lists.</p>
                </form>
              </div>
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}

          {step === "quality" && (
            <>
              <div className="card">
                <h2>Requirements</h2>
                <form action={saveRequirementAction} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <label>Title</label><input name="title" required />
                  <label>Category</label>
                  <select name="category" defaultValue="functional">
                    {["functional", "security", "performance", "availability", "operability", "maintainability", "usability"].map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <label>Description</label><input name="description" />
                  <p><button className="btn" type="submit">Add requirement</button></p>
                </form>
                <ul className="tight">{p.requirements.map((r) => <li key={r.id}>{r.title} ({r.category}) — {r.linkedElementIds.length ? "linked" : "not linked"}</li>)}</ul>
              </div>

              <div className="card">
                <h2>Risks</h2>
                <form action={saveRiskAction} className="inline-form">
                  <input type="hidden" name="id" value={id} />
                  <label>Title</label><input name="title" required />
                  <label>Category</label><input name="category" defaultValue="technical" />
                  <label>Severity</label>
                  <select name="severity" defaultValue="medium"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                  <label>Likelihood</label>
                  <select name="likelihood" defaultValue="medium"><option value="low">low</option><option value="medium">medium</option><option value="high">high</option></select>
                  <label>Mitigation</label><input name="mitigation" />
                  <p><button className="btn" type="submit">Add risk</button></p>
                </form>
                <ul className="tight">{p.risks.map((r) => <li key={r.id}>{r.title} ({r.severity}/{r.likelihood})</li>)}</ul>
              </div>

              <div className="card">
                <h2>Security, operations, cost and open questions</h2>
                <form action={saveProjectStep}>
                  <input type="hidden" name="id" value={id} />
                  <input type="hidden" name="step" value={step} />
                  <label>Security notes</label><textarea name="securityNotes" defaultValue={p.securityNotes} />
                  <label>Operational and disaster recovery notes</label><textarea name="operationalNotes" defaultValue={p.operationalNotes} />
                  <label>Cost notes</label><textarea name="costNotes" defaultValue={p.costNotes} />
                  <label>Open questions (one per line)</label><textarea name="openQuestions" defaultValue={p.openQuestions.join("\n")} />
                  <p><button className="btn" type="submit">Save notes</button></p>
                </form>
                <WizardButtons next={nextStep} prev={prevStep} id={id} />
              </div>
            </>
          )}

          {step === "review" && (
            <>
              <div className="card">
                <h2>Checks</h2>
                <p className="muted">These warn; they never block export. A clean result does not mean this design is secure or correct.</p>
                <QualityList project={p} />
              </div>
              <div className="card">
                <h2>Export</h2>
                <p className="muted">
                  Everything below is generated from the model above, so a download always matches your latest edits.
                </p>
                <p>
                  <PrintButton id={id} label="Export PDF" />
                </p>
                <ul className="tight">
                  <li><a className="btn" href={`/architecture/report?id=${id}`}>Open print view</a></li>
                  <li><a className="btn" href={`/architecture/export?format=md&id=${id}`}>Download Markdown report</a></li>
                  <li><a className="btn" href={`/architecture/export?format=json&id=${id}`}>Download project JSON</a></li>
                  <li><a className="btn" href={`/architecture/export?format=svg&id=${id}`}>Download all diagrams (SVG)</a></li>
                  <li><a className="btn" href={`/architecture/export?format=adrs&id=${id}`}>Download all ADRs (Markdown)</a></li>
                </ul>
              </div>
              <div className="card"><WizardButtons next={nextStep} prev={prevStep} id={id} /></div>
            </>
          )}
        </div>

        <aside className="wizard-preview">
          <h3>Live preview</h3>
          {step === "context" && <Preview diagram={contextDiagram(p)} />}
          {step === "containers" && <Preview diagram={containerDiagram(p)} />}
          {step === "deployment" && <Preview diagram={deploymentDiagram(p)} />}
          {step === "scenarios" && <Preview diagram={p.dynamicScenarioIds[0] ? dynamicDiagram(p, p.dynamicScenarioIds[0]) : contextDiagram(p)} />}
          {step === "components" && <Preview diagram={landscapeDiagram(p)} />}
          {step === "project" && <p className="muted">Add people and systems on the next step to see the context diagram.</p>}
          {step === "decisions" && <p className="muted">Decisions do not change diagrams. See the report for the decision section.</p>}
          {step === "quality" && <p className="muted">Requirements and risks feed the report, not the diagrams.</p>}
          {step === "review" && <Preview diagram={contextDiagram(p)} />}
        </aside>
      </div>
    </>
  );

  function QualityList({ project }: { project: NonNullable<typeof p> }) {
    const checks = runChecks(project);
    const s = summariseChecks(checks);
    return (
      <>
        <p>{s.total} checks · {s.errors} errors · {s.warnings} warnings · {s.heuristics} heuristics</p>
        {checks.length === 0 ? <p className="muted">No findings.</p> : (
          <ul className="tight">
            {checks.map((c, i) => (
              <li key={i}><strong>{c.severity}</strong> {c.message} <span className="muted">({c.basis})</span></li>
            ))}
          </ul>
        )}
      </>
    );
  }
}

function WizardButtons({ next, prev, id, inForm }: { next: string; prev: string; id: string; inForm?: boolean }) {
  return (
    <div className="row" style={{ marginTop: 10 }}>
      {inForm ? (
        <>
          <button className="btn" type="submit" name="action" value="save">Save</button>
          <button className="btn ghost" type="submit">Save and continue</button>
          <a className="btn ghost" href={`/architecture/wizard?step=${prev}&id=${id}`}>Back</a>
        </>
      ) : (
        <>
          <a className="btn ghost" href={`/architecture/wizard?step=${prev}&id=${id}`}>Back</a>
          <a className="btn" href={`/architecture/wizard?step=${next}&id=${id}`}>Next</a>
        </>
      )}
    </div>
  );
}
