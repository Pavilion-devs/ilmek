import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-opus-5-5";

/** The model to call: ANTHROPIC_MODEL if set (e.g. in .env), otherwise Claude Opus 5.5. */
export function modelId(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/** Models that accept the server-side refusal fallback ("default" routing). */
const FALLBACK_MODELS = new Set(["claude-fable-5-1", "claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5"]);

/**
 * Server-side refusal fallback: if a safety classifier declines a request, the API re-runs it on a
 * suitable model inside the same call. Sent only to models that support it.
 */
export function fallbackParams(model: string): { betas?: Anthropic.Beta.AnthropicBeta[]; fallbacks?: "default" } {
  return FALLBACK_MODELS.has(model) ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" } : {};
}

let client: Anthropic | undefined;

/** Credentials come from ANTHROPIC_API_KEY, ANTHROPIC_AUTH_TOKEN or an `ant auth login` profile. */
export function anthropic(): Anthropic {
  client ??= new Anthropic();
  return client;
}

/** Loads the repo's .env (git-ignored) into process.env without overriding variables already set. */
export function loadDotEnv(path: string) {
  try {
    process.loadEnvFile(path);
  } catch {
    // no .env: fine
  }
}

export class RefusedError extends Error {
  constructor(public category: string | null | undefined) {
    super(`The model declined this request (${category ?? "no category"}).`);
  }
}
