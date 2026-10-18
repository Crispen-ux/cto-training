"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addCapabilityAssessment } from "@/lib/store";
import type { CapabilityTrack } from "@/lib/capability";

export async function submitCapabilityAssessment(formData: FormData) {
  const track = String(formData.get("track") ?? "") as CapabilityTrack;
  const competencyId = String(formData.get("competencyId") ?? "").trim();
  const knowledge = Number(formData.get("knowledge") ?? 0);
  const execution = Number(formData.get("execution") ?? 0);
  const judgement = Number(formData.get("judgement") ?? 0);
  const communication = Number(formData.get("communication") ?? 0);
  const evidenceRef = String(formData.get("evidenceRef") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const assessedBy = String(formData.get("assessedBy") ?? "self");

  if (!competencyId) redirect("/capability?error=Missing+competency");
  const dims = [knowledge, execution, judgement, communication];
  if (dims.some((n) => !Number.isInteger(n) || n < 0 || n > 5)) redirect("/capability?error=Scores+must+be+0-5");
  if (dims.every((n) => n === 0)) redirect("/capability?error=At+least+one+dimension+must+be+scored");

  addCapabilityAssessment({
    competencyId,
    track,
    dimensions: { knowledge, execution, judgement, communication },
    evidenceRef: evidenceRef || undefined,
    notes: notes || undefined,
    assessedBy: assessedBy === "reviewer" || assessedBy === "ai" ? assessedBy : "self",
    status: "baseline",
  });
  revalidatePath("/capability");
  redirect("/capability?ok=Assessment+recorded");
}
