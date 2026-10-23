import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { CarbonLabel } from "@ilmek/core";
import { anthropic, fallbackParams, modelId, RefusedError } from "./client";
import { normalizeText, numbersIn } from "./verify";

/** What the passport can prove, already formatted the way it may appear on a label. */
export interface PassportFacts {
  /** What the claim is about, e.g. "Shell fabric" */
  scope: string;
  recycledPercent: number; // whole percent, rounded down
  recycledMaterial: string; // e.g. "recycled polyester"
  fiberCo2eKgPerKg: number; // one decimal
  virginFiberCo2eKgPerKg: number; // one decimal
  fiberSavingPercent: number; // whole percent
  carbonLabel: CarbonLabel;
  passportUrl?: string;
}

const fmt1 = (x: number) => x.toFixed(1);

/** The only numbers a label may contain, exactly as they may be written. */
export function allowedNumbers(f: PassportFacts): string[] {
  return [String(f.recycledPercent), fmt1(f.fiberCo2eKgPerKg), fmt1(f.virginFiberCo2eKgPerKg), String(f.fiberSavingPercent)];
}

export const ClaimReviewSchema = z.object({
  phrases: z.array(
    z.object({
      text: z.string().describe("A phrase from the draft, copied exactly"),
      verdict: z.enum(["banned-generic", "unsupported", "supported"]),
      reason: z.string().describe("One plain sentence a marketing person would understand"),
    }),
  ),
  rewrite: z.string().describe("The label text to use instead. One or two short sentences."),
});
export type ClaimReview = z.infer<typeof ClaimReviewSchema>;

const SYSTEM = `You check environmental claims on clothing labels against the EU rules that have applied since 27 September 2026 (Directive (EU) 2024/825, which amends the Unfair Commercial Practices Directive), and rewrite them so every word can be proven.

How the rules apply here:
- Generic environmental claims such as "eco-friendly", "green", "kind to the planet", "environmentally friendly", "sustainable", "conscious" or "climate friendly" are banned unless the trader can show recognised excellent environmental performance. A recycled-content figure is not that, so treat these as banned.
- A claim about the whole product is misleading when the evidence covers only part of it. Say which part.
- Claims that a product is climate neutral, carbon neutral or has reduced impact because of offsetting are banned.
- Specific claims are fine when the evidence supports them exactly.

You get the brand's draft and the facts the product passport proves. Sort each phrase of the draft as banned-generic, unsupported (specific, but the facts do not back it) or supported. Then write a replacement label that:
- uses only the facts given, with numbers written exactly as given (no other numbers, no rounding changes),
- names the part of the product the facts cover,
- says "verified" only about the recycled share,
- stays factual and short, without superlatives or generic green words.`;

function factsBlock(f: PassportFacts): string {
  const lines = [
    `Scope: ${f.scope}`,
    `Recycled share: ${f.recycledPercent}% ${f.recycledMaterial} (verified on the FiberLedger mass-balance ledger)`,
    `Fiber footprint: ${fmt1(f.fiberCo2eKgPerKg)} kg CO2e per kg of fiber`,
    `Virgin polyester fiber for comparison: ${fmt1(f.virginFiberCo2eKgPerKg)} kg CO2e per kg`,
    `Saving against virgin fiber: ${f.fiberSavingPercent}%`,
    `Carbon assessment: ${f.carbonLabel}`,
  ];
  if (f.passportUrl) lines.push(`Passport link: ${f.passportUrl}`);
  return lines.join("\n");
}

/** Live call to Claude. */
export async function reviewClaim(draft: string, facts: PassportFacts): Promise<{ review: ClaimReview; model: string; usage: unknown }> {
  const model = modelId();
  const res = await anthropic().beta.messages.parse({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: "medium", format: betaZodOutputFormat(ClaimReviewSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Draft label:\n${draft}\n\nFacts the passport proves:\n${factsBlock(facts)}` }],
  });
  if (res.stop_reason === "refusal") throw new RefusedError(res.stop_details?.category);
  if (!res.parsed_output) throw new Error(`No structured output for the claim review (stop reason: ${res.stop_reason})`);
  return { review: res.parsed_output, model: res.model, usage: res.usage };
}

// ------------------------------------------------------------------ deterministic guards

/** Words that make a claim generic under the Directive. Checked on the rewrite, case-insensitive. */
export const BANNED_TERMS = [
  "eco-friendly",
  "eco friendly",
  "environmentally friendly",
  "planet friendly",
  "kind to the planet",
  "good for the planet",
  "climate friendly",
  "climate neutral",
  "carbon neutral",
  "co2 neutral",
  "net zero",
  "green",
  "sustainable",
  "conscious",
  "earth friendly",
  "biodegradable",
  "natural",
];

export interface LockResult {
  ok: boolean;
  problems: string[];
}

/**
 * The number lock: every number in the rewrite must be one of the passport's numbers, written the
 * same way, and no banned term may remain. If this fails, the AI's text is not used.
 */
export function lockClaim(text: string, facts: PassportFacts): LockResult {
  const problems: string[] = [];
  const allowed = new Set(allowedNumbers(facts).map(Number));
  // "CO2" / "CO₂e" are units, not figures.
  const scrubbed = text.replace(/CO[2₂]e?/gi, "CO").replace(/https?:\/\/\S+/g, "");
  for (const n of numbersIn(scrubbed)) {
    if (!allowed.has(n)) problems.push(`"${n}" is not a number the passport proves.`);
  }
  const t = ` ${normalizeText(text).replace(/[^a-z0-9\- ]/g, " ")} `;
  for (const term of BANNED_TERMS) {
    if (t.includes(` ${term} `)) problems.push(`"${term}" is a generic environmental claim.`);
  }
  if (facts.recycledPercent < 100 && !t.includes(` ${normalizeText(facts.scope).split(" ")[0]}`)) {
    problems.push(`The claim must say which part of the product it covers (${facts.scope}).`);
  }
  return { ok: problems.length === 0, problems };
}

/** Safe label built only from the facts; used whenever the AI's rewrite fails the lock. */
export function templateClaim(f: PassportFacts): string {
  const carbon =
    f.carbonLabel === "recycled-but-not-low-carbon"
      ? `Fiber: ${fmt1(f.fiberCo2eKgPerKg)} kg CO₂e per kg (virgin polyester ${fmt1(f.virginFiberCo2eKgPerKg)}).`
      : `Fiber: ${fmt1(f.fiberCo2eKgPerKg)} kg CO₂e per kg, ${f.fiberSavingPercent}% below virgin polyester (${fmt1(f.virginFiberCo2eKgPerKg)}).`;
  return `${f.scope}: ${f.recycledPercent}% ${f.recycledMaterial}, verified. ${carbon}`;
}

export interface FinalClaim {
  text: string;
  source: "ai-rewrite" | "template";
  lock: LockResult;
  /** null when no AI review was available (no key and no recording) */
  review: ClaimReview | null;
}

/** Picks the label: the AI rewrite if it passes the lock, otherwise the template. */
export function finalizeClaim(review: ClaimReview | null, facts: PassportFacts): FinalClaim {
  if (!review) return { text: templateClaim(facts), source: "template", lock: { ok: false, problems: ["No AI review available."] }, review };
  const lock = lockClaim(review.rewrite, facts);
  return lock.ok
    ? { text: review.rewrite.trim(), source: "ai-rewrite", lock, review }
    : { text: templateClaim(facts), source: "template", lock, review };
}
