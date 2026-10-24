import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { anthropic, fallbackParams, modelId, RefusedError } from "./client";
import { ClaimReviewSchema, type ClaimReview } from "./schemas";
import type { PassportFacts } from "./guards";

export * from "./guards";
export { ClaimReviewSchema, type ClaimReview } from "./schemas";

const fmt1 = (x: number) => x.toFixed(1);

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
