"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addDecisionAttempt } from "@/lib/store";
import { validateFraming, validateRapidDecision, scoreTradeOff, explainTradeOff, DECISION_RULES, type DecisionAttempt } from "@/lib/decision-loop";

const lines = (v: FormDataEntryValue | null): string[] =>
  String(v ?? "").split("\n").map((s) => s.trim()).filter(Boolean);

export async function submitDecision(formData: FormData) {
  const scenarioTitle = String(formData.get("scenarioTitle") ?? "Untitled scenario").trim();

  const assumptions = lines(formData.get("assumptions")).map((text) => ({
    assumption: text,
    howToValidate: String(formData.get("howToValidate") ?? "").trim(),
  }));

  const framing = {
    decision: String(formData.get("decision") ?? "").trim(),
    desiredOutcome: String(formData.get("desiredOutcome") ?? "").trim(),
    constraints: lines(formData.get("constraints")),
    stakeholders: lines(formData.get("stakeholders")),
    unknowns: lines(formData.get("unknowns")),
    assumptions,
  };

  const initialDecision = {
    recommendation: String(formData.get("recommendation") ?? "").trim(),
    rationale: String(formData.get("rationale") ?? "").trim(),
    risks: lines(formData.get("risks")),
    wouldChangeMyMind: String(formData.get("wouldChangeMyMind") ?? "").trim(),
    minutesTaken: Number(formData.get("minutesTaken") ?? 0),
  };

  const problems = [...validateFraming(framing), ...validateRapidDecision(initialDecision)];
  if (problems.length) redirect(`/decision?error=${encodeURIComponent(problems.join(" "))}`);

  const criteriaRaw = lines(formData.get("criteria"));
  const criteria = criteriaRaw.map((id) => ({ id, weight: Number(formData.get(`weight_${id}`) ?? 1) || 0 }));
  const optionTitles = lines(formData.get("optionTitles"));
  const options = optionTitles.map((title, i) => ({
    id: `opt_${i}`,
    title,
    criteria: Object.fromEntries(criteria.map((c) => [c.id, Number(formData.get(`score_${i}_${c.id}`) ?? 0)])),
  }));

  const analysis = {
    criteria,
    options,
    preferred: String(formData.get("preferred") ?? options[0]?.id ?? ""),
    compromiseAccepted: String(formData.get("compromiseAccepted") ?? "").trim(),
  };

  const attempt: Omit<DecisionAttempt, "id"> = {
    createdAt: new Date().toISOString(),
    scenarioId: "self-supplied",
    scenarioTitle,
    levelAtAttempt: Number(formData.get("levelAtAttempt") ?? 0),
    framing,
    initialDecision,
    tradeOff: options.length > 0 ? analysis : undefined,
    challenges: [],
    secondOrder: {
      downstream: lines(formData.get("downstream")),
      failureModes: lines(formData.get("failureModes")),
      organisationalImpact: lines(formData.get("organisationalImpact")),
      operationalCost: lines(formData.get("operationalCost")),
      futureConstraints: lines(formData.get("futureConstraints")),
    },
  };

  addDecisionAttempt(attempt);
  void scoreTradeOff;
  void explainTradeOff;
  void DECISION_RULES;
  revalidatePath("/decision");
  redirect("/decision?ok=Attempt+recorded.+Your+first+call+is+kept+for+calibration.");
}
