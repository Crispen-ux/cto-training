"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addArticulationAttempt } from "@/lib/store";
import { analyseLanguage, wordCount, type ArticulationLevel } from "@/lib/articulation";

export async function submitArticulation(formData: FormData) {
  const level = String(formData.get("level") ?? "recommendation") as ArticulationLevel;
  const text = String(formData.get("text") ?? "").trim();
  if (!text) redirect("/articulation?error=Write+an+answer+first");

  const findings = analyseLanguage(text, level);
  addArticulationAttempt({
    id: "",
    level,
    text,
    wordCount: wordCount(text),
    findings,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/articulation");
  redirect("/articulation?ok=Saved.+These+are+findings+to+act+on,+not+a+score.");
}
