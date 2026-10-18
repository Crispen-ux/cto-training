export type Role = "user" | "assistant";
export interface ChatMessage {
  role: Role;
  content: string;
}
export interface CompletionRequest {
  system: string;
  messages: ChatMessage[];
  maxTokens: number;
}
export interface Completion {
  text: string;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string;
}

export type AiErrorCode = "not_configured" | "budget_exhausted" | "rate_limited" | "provider_error" | "bad_response";
export class AiError extends Error {
  constructor(
    public code: AiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface AiProvider {
  id: string;
  model: string;
  /**
   * Whether this provider's scores may become learner evidence. The mock provider never counts:
   * its output exists to exercise the interface, not to assess anyone.
   */
  countsAsEvidence: boolean;
  complete(req: CompletionRequest): Promise<Completion>;
}

export interface AnthropicOptions {
  apiKey: string;
  model?: string;
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retryDelayMs?: number;
}

/** Default model string from Anthropic's models list; override with ACADEMY_AI_MODEL. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";
const API_VERSION = "2023-06-01";

/**
 * Minimal Messages API client. Notes from the API reference:
 * - no `temperature`, `top_p` or `top_k`: models released after Opus 4.6 accept only default values;
 * - the system prompt is the top-level `system` field, not a message role;
 * - the key is sent only in the x-api-key header and never appears in errors or logs.
 */
export function createAnthropicProvider(opts: AnthropicOptions): AiProvider {
  const model = opts.model || DEFAULT_MODEL;
  const base = (opts.baseUrl ?? "https://api.anthropic.com").replace(/\/$/, "");
  const doFetch = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const retryDelayMs = opts.retryDelayMs ?? 1500;

  async function once(req: CompletionRequest): Promise<Completion> {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    let res: Response;
    try {
      res = await doFetch(`${base}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "anthropic-version": API_VERSION,
          "x-api-key": opts.apiKey,
        },
        body: JSON.stringify({
          model,
          max_tokens: req.maxTokens,
          system: req.system,
          messages: req.messages,
        }),
        signal: ctl.signal,
      });
    } catch (e) {
      const aborted = (e as Error).name === "AbortError";
      throw new AiError("provider_error", aborted ? "The AI provider timed out." : "Could not reach the AI provider.");
    } finally {
      clearTimeout(timer);
    }

    const raw = await res.text();
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      body = undefined;
    }
    if (!res.ok) {
      const detail =
        (body as { error?: { message?: string } } | undefined)?.error?.message?.slice(0, 200) ?? "no detail";
      if (res.status === 429 || res.status === 529) throw new AiError("rate_limited", `The AI provider is busy (HTTP ${res.status}).`);
      if (res.status === 401 || res.status === 403) throw new AiError("provider_error", `The AI provider rejected the credentials (HTTP ${res.status}).`);
      throw new AiError("provider_error", `The AI provider returned HTTP ${res.status}: ${detail}`);
    }
    const b = body as
      | { content?: { type: string; text?: string }[]; stop_reason?: string; usage?: { input_tokens?: number; output_tokens?: number } }
      | undefined;
    const text = (b?.content ?? [])
      .filter((c) => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("");
    if (!text.trim()) {
      throw new AiError("bad_response", `The AI provider returned no text (stop reason: ${b?.stop_reason ?? "unknown"}).`);
    }
    return {
      text,
      stopReason: b?.stop_reason,
      inputTokens: b?.usage?.input_tokens,
      outputTokens: b?.usage?.output_tokens,
    };
  }

  return {
    id: "anthropic",
    model,
    countsAsEvidence: true,
    async complete(req) {
      try {
        return await once(req);
      } catch (e) {
        if (e instanceof AiError && (e.code === "rate_limited" || (e.code === "provider_error" && /HTTP 5\d\d|timed out|reach/.test(e.message)))) {
          await new Promise((r) => setTimeout(r, retryDelayMs));
          return once(req);
        }
        throw e;
      }
    },
  };
}

/**
 * Deterministic stand-in for development and smoke tests. It does not read or understand anything:
 * it returns canned, clearly labelled text. Its assessments never become evidence.
 */
export function createMockProvider(): AiProvider {
  return {
    id: "mock",
    model: "mock-1",
    countsAsEvidence: false,
    async complete(req) {
      if (req.system.includes("ASSESSOR_JSON")) {
        const m = /<learner_transcript>([\s\S]*?)<\/learner_transcript>/.exec(req.messages.at(-1)?.content ?? "");
        const learner = (m?.[1] ?? "").replace(/^\s*\[(assessor|learner)\]\s*/gim, "").trim();
        const quote = learner.slice(0, 60).replace(/\s+/g, " ").trim();
        const n = Number((/CRITERIA_COUNT=(\d+)/.exec(req.system) ?? [])[1] ?? 1);
        return {
          text: JSON.stringify({
            criteria: Array.from({ length: n }, (_, i) => ({ index: i, level: 2, quotes: quote ? [quote] : [], reason: "[MOCK] placeholder" })),
            summary: "[MOCK] Not a real assessment. No AI provider is configured.",
            strengths: [],
            gaps: [],
            confidence: 0.5,
            manipulation_attempt: false,
            unsure_about: ["mock provider"],
          }),
        };
      }
      return { text: "[MOCK] No AI provider is configured, so this is placeholder text, not an answer." };
    },
  };
}

export interface AiStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  mock: boolean;
}

export type Env = Record<string, string | undefined>;

export function getProvider(env: Env = process.env): AiProvider | null {
  const kind = env.ACADEMY_AI_PROVIDER?.toLowerCase();
  if (kind === "none" || kind === "off") return null;
  if (kind === "mock") return createMockProvider();
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) return null;
  return createAnthropicProvider({
    apiKey: key,
    model: env.ACADEMY_AI_MODEL?.trim() || undefined,
    baseUrl: env.ACADEMY_AI_BASE_URL?.trim() || undefined, // operator-set gateway or test server; never user input
  });
}

export function aiStatus(env: Env = process.env): AiStatus {
  const p = getProvider(env);
  return { configured: !!p, provider: p?.id ?? null, model: p?.model ?? null, mock: p?.id === "mock" };
}
