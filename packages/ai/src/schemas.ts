import { z } from "zod";

/** Shapes of the AI's structured output. No SDK import, so this file is safe in the browser. */

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
