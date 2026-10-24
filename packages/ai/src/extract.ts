import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { ExtractionSchema, type Extraction } from "./schemas";
import { anthropic, fallbackParams, modelId, RefusedError } from "./client";

export { ExtractionSchema, FIELD_NAMES, NUMERIC_FIELDS, type Extraction, type FieldName } from "./schemas";

const SYSTEM = `You read supply-chain documents for recycled textile fiber (transaction certificates, invoices, weighbridge tickets, electricity bills) and pull out the fields a certifier needs to check a recycled-content claim.

Every field you return is checked by software against the document text, so:
- Only return a field if the document states it. Never infer, calculate or fill in a value.
- The quote must be copied exactly from the document (same spelling, punctuation and number formatting) and must contain the value.
- For "date", use the main date of the document (issue date, invoice date, or weighing date).
- For weights, use kilograms of product; for "netWeightKg" on a weighbridge ticket, use the net product weight after packaging.

If something inside the document is inconsistent (for example recycled weight above net weight, or weights that do not add up), say so in concerns.`;

export type DocumentInput =
  | { kind: "pdf"; name: string; bytes: Uint8Array }
  | { kind: "image"; name: string; bytes: Uint8Array; mediaType: "image/jpeg" | "image/png" };

/** Live call to Claude. Returns the structured extraction; verification happens separately in verify.ts. */
export async function extractDocument(doc: DocumentInput): Promise<{ extraction: Extraction; model: string; usage: unknown }> {
  const data = Buffer.from(doc.bytes).toString("base64");
  const source =
    doc.kind === "pdf"
      ? ({ type: "document", source: { type: "base64", media_type: "application/pdf", data } } as const)
      : ({ type: "image", source: { type: "base64", media_type: doc.mediaType, data } } as const);

  const model = modelId();
  const res = await anthropic().beta.messages.parse({
    model,
    max_tokens: 16000,
    ...fallbackParams(model),
    output_config: { effort: "low", format: betaZodOutputFormat(ExtractionSchema) },
    system: SYSTEM,
    messages: [{ role: "user", content: [source, { type: "text", text: `Extract the fields from "${doc.name}".` }] }],
  });

  if (res.stop_reason === "refusal") throw new RefusedError(res.stop_details?.category);
  if (!res.parsed_output) throw new Error(`No structured output for ${doc.name} (stop reason: ${res.stop_reason})`);
  return { extraction: res.parsed_output, model: res.model, usage: res.usage };
}
