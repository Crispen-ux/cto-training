import { readState, aiUsageToday } from "@/lib/store";
import { aiStatus, AI_RULES } from "@/lib/ai";
import { saveScheduleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function Settings({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  const s = readState().settings.schedule;
  const ai = aiStatus();
  const field = (name: keyof typeof s, label: string) => (
    <>
      <label htmlFor={name}>{label} (minutes)</label>
      <input id={name} name={name} type="number" min={0} max={480} defaultValue={s[name]} />
    </>
  );
  return (
    <>
      <h1>AI tutor and assessor</h1>
      <div className="card">
        {ai.configured ? (
          <p>
            <strong>On.</strong> Provider: {ai.provider}, model: {ai.model}. Calls today: {aiUsageToday()} of {AI_RULES.dailyCallCap}.
            {ai.mock && " This is the mock provider: its scores never count."}
          </p>
        ) : (
          <p><strong>Off.</strong> Set <code>ANTHROPIC_API_KEY</code> in the server environment and restart. Optionally set <code>ACADEMY_AI_MODEL</code>. The key is read from the environment only and is never stored or shown.</p>
        )}
        <p className="muted">Your messages and the lesson text are sent to the provider when you use the tutor or the assessor. See docs/AI.md.</p>
      </div>
      <h1>Daily schedule</h1>
      <p className="muted">Default is two hours: 15 + 25 + 60 + 20. Missions are sized to these blocks.</p>
      {sp.ok && <div className="notice ok">{sp.ok}</div>}
      <form action={saveScheduleAction} className="card">
        {field("framework", "Official CTO Framework study")}
        {field("fundamentals", "Technical or business fundamentals")}
        {field("project", "Hands-on project")}
        {field("assessment", "Assessment, defence and reflection")}
        <p><button type="submit">Save</button></p>
      </form>
    </>
  );
}
