import type { CarbonLabel } from "@ilmek/core";
import type { ClaimReview } from "./schemas";
import { normalizeText, numbersIn } from "./verify";

/** Deterministic checks on claims. No SDK import, so this file is safe in the browser. */

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

// ------------------------------------------------------------------ deterministic guards

/** Words that make a claim generic under the Directive. Checked on the rewrite, case-insensitive. */
export const BANNED_TERMS = [
  "eco friendly",
  "environmentally friendly",
  "planet friendly",
  "earth friendly",
  "kind to the planet",
  "good for the planet",
  "planet positive",
  "climate friendly",
  "climate positive",
  "climate neutral",
  "carbon neutral",
  "carbon negative",
  "co2 neutral",
  "nature positive",
  "net zero",
  "zero impact",
  "guilt free",
  "green",
  "sustainable",
  "conscious",
  "responsible",
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
  // Hyphens count as spaces, so "eco-friendly" and "eco friendly" are the same term.
  const t = ` ${normalizeText(text).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
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
