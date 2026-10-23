import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { anthropic, fallbackParams, modelId, RefusedError } from "./client";

export const FIELD_NAMES = [
  "documentNumber",
  "issuer",
  "seller",
  "buyer",
  "product",
  "date",
  "grossWeightKg",
  "netWeightKg",
  "recycledContentPercent",
  "recycledWeightKg",
  "certificateReference",
  "invoiceReference",
  "electricityKwh",
  "meterNumber",
] as const;
export type FieldName = (typeof FIELD_NAMES)[number];

/** Fields whose value is a number; the verifier compares these numerically against the quote. */
export const NUMERIC_FIELDS: ReadonlySet<FieldName> = new Set([
  "grossWeightKg",
  "netWeightKg",
  "recycledContentPercent",
  "recycledWeightKg",
  "electricityKwh",
]);

export const ExtractionSchema = z.object({
  documentType: z.enum(["transaction-certificate", "invoice", "weighbridge-ticket", "electricity-bill", "other"]),
  fields: z.array(
    z.object({
      name: z.enum(FIELD_NAMES),
      value: z.string().describe("Normalised value: plain digits for numbers (30000), YYYY-MM-DD for dates, text as written otherwise"),
      quote: z.string().describe("The exact words from the document that show this value, copied character for character"),
      page: z.number().int().describe("1-based page number the quote is on"),
    }),
  ),
  concerns: z.array(z.string()).describe("Anything inside the document that does not add up, in one sentence each. Empty if none."),
});
export type Extraction = z.infer<typeof ExtractionSchema>;

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
