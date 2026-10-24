import { NUMERIC_FIELDS, type Extraction, type FieldName } from "./schemas";

/**
 * Deterministic checks on what the AI extracted. The AI proposes; these checks decide whether a
 * field can be used without a person looking at it.
 */

export type FieldStatus =
  | "verified" // quote found in the document and the value is in the quote
  | "quote-not-found" // the quote is not in the document text: the AI may have made it up
  | "value-not-in-quote" // the quote is real but does not contain the value
  | "needs-person"; // came from a photo, so there is no text layer to check against

export interface CheckedField {
  name: FieldName;
  value: string;
  quote: string;
  page: number;
  status: FieldStatus;
  /** Where the quote was actually found, if not on the page the AI named */
  foundOnPage?: number;
}

export interface CheckedExtraction {
  documentName: string;
  documentType: Extraction["documentType"];
  fields: CheckedField[];
  concerns: string[];
  /** true when every field is verified */
  allVerified: boolean;
}

export const normalizeText = (s: string): string =>
  s
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

/** Numbers in a piece of text. "30,240" and "30.240" (thousands) both become 30240; "1.12" stays 1.12. */
export function numbersIn(text: string): number[] {
  const out: number[] = [];
  for (const m of text.matchAll(/\d[\d.,]*\d|\d/g)) {
    let s = m[0];
    if (/^\d{1,3}([,.]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, "");
    else s = s.replace(/,/g, "");
    const n = Number(s);
    if (Number.isFinite(n)) out.push(n);
  }
  return out;
}

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTHS_TR = ["ocak", "şubat", "mart", "nisan", "mayıs", "haziran", "temmuz", "ağustos", "eylül", "ekim", "kasım", "aralık"];
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** Every calendar date written in a piece of text, as YYYY-MM-DD. Handles "18 September 2026", Turkish month names, 2026-09-18 and 18.09.2026 / 18/09/2026. */
export function datesIn(text: string): string[] {
  const t = text.toLocaleLowerCase("tr");
  const out: string[] = [];
  for (const m of t.matchAll(/(\d{1,2})\s+([a-zçğıöşü]+)\s+(\d{4})/g)) {
    const month = Math.max(MONTHS.indexOf(m[2]!), MONTHS_TR.indexOf(m[2]!)) + 1 || MONTHS.findIndex((x) => x.startsWith(m[2]!.slice(0, 3))) + 1;
    if (month > 0) out.push(iso(Number(m[3]), month, Number(m[1])));
  }
  for (const m of t.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)) out.push(iso(Number(m[1]), Number(m[2]), Number(m[3])));
  for (const m of t.matchAll(/(\d{1,2})[./](\d{1,2})[./](\d{4})/g)) out.push(iso(Number(m[3]), Number(m[2]), Number(m[1])));
  return out;
}

function valueInQuote(name: FieldName, value: string, quote: string): boolean {
  if (NUMERIC_FIELDS.has(name)) {
    const v = Number(value.replace(/[^\d.]/g, ""));
    return numbersIn(quote).some((n) => Math.abs(n - v) < 1e-9);
  }
  if (name === "date") return datesIn(quote).includes(value.slice(0, 10));
  const q = normalizeText(quote);
  const v = normalizeText(value);
  return q.includes(v) || v.includes(q);
}

export function checkExtraction(
  documentName: string,
  extraction: Extraction,
  pages: string[] | null, // null for photos
): CheckedExtraction {
  const normPages = pages?.map(normalizeText);
  const fields: CheckedField[] = extraction.fields.map((f) => {
    if (!normPages) return { ...f, status: "needs-person" };
    const q = normalizeText(f.quote);
    let foundOnPage: number | undefined;
    if (q && normPages[f.page - 1]?.includes(q)) foundOnPage = f.page;
    else {
      const i = normPages.findIndex((p) => q && p.includes(q));
      if (i >= 0) foundOnPage = i + 1;
    }
    if (foundOnPage === undefined) return { ...f, status: "quote-not-found" };
    const status: FieldStatus = valueInQuote(f.name, f.value, f.quote) ? "verified" : "value-not-in-quote";
    return { ...f, status, ...(foundOnPage !== f.page ? { foundOnPage } : {}) };
  });
  return {
    documentName,
    documentType: extraction.documentType,
    fields,
    concerns: extraction.concerns,
    allVerified: fields.length > 0 && fields.every((f) => f.status === "verified"),
  };
}

export const fieldValue = (x: CheckedExtraction, name: FieldName): string | undefined =>
  x.fields.find((f) => f.name === name && f.status === "verified")?.value;

export interface CrossCheckFinding {
  severity: "warn" | "fail";
  message: string;
}

/**
 * Do the documents for one shipment agree with each other? Uses verified fields only.
 * The certificate, invoice and weighbridge ticket should report the same product weight, and
 * recycled weight can never exceed net weight.
 */
export function crossCheckShipment(docs: CheckedExtraction[]): CrossCheckFinding[] {
  const out: CrossCheckFinding[] = [];
  const weights = docs
    .map((d) => ({ d, kg: Number(fieldValue(d, "netWeightKg")) }))
    .filter((x) => Number.isFinite(x.kg) && x.kg > 0);
  if (weights.length >= 2) {
    const min = Math.min(...weights.map((w) => w.kg));
    const max = Math.max(...weights.map((w) => w.kg));
    if ((max - min) / max > 0.005) {
      out.push({
        severity: "fail",
        message: `Net weights disagree: ${weights.map((w) => `${w.d.documentName} says ${w.kg.toLocaleString("en-GB")} kg`).join(", ")}.`,
      });
    }
  }
  for (const d of docs) {
    const net = Number(fieldValue(d, "netWeightKg"));
    const rec = Number(fieldValue(d, "recycledWeightKg"));
    if (net > 0 && rec > net) {
      out.push({ severity: "fail", message: `${d.documentName}: recycled weight (${rec} kg) is above net weight (${net} kg).` });
    }
  }
  const certNo = docs.find((d) => d.documentType === "transaction-certificate");
  const tc = certNo && fieldValue(certNo, "documentNumber");
  for (const d of docs) {
    if (d === certNo || d.documentType !== "invoice") continue;
    const ref = fieldValue(d, "certificateReference");
    if (tc && ref && !normalizeText(ref).includes(normalizeText(tc))) {
      out.push({ severity: "warn", message: `${d.documentName} refers to certificate ${ref}, not ${tc}.` });
    }
  }
  return out;
}
