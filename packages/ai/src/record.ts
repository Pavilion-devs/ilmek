/**
 * Calls Claude live on every demo document and the brand's draft claim, verifies the results,
 * and saves the responses to packages/ai/recorded/ so the demo can replay them without a key.
 *
 *   ANTHROPIC_API_KEY=... pnpm --filter @ilmek/ai record
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { demo } from "@ilmek/core";
import { loadDotEnv, modelId } from "./client";
import { factsFromRun, hasCredentials, processClaim, processDocument } from "./pipeline";
import { crossCheckShipment } from "./verify";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const DOCS = resolve(ROOT, "data/sample-docs");

loadDotEnv(resolve(ROOT, ".env"));
if (!hasCredentials()) {
  console.error("No Anthropic credentials found. Set ANTHROPIC_API_KEY (or run `ant auth login`) and try again.");
  process.exit(1);
}

console.log(`model: ${modelId()}\n`);
const files = readdirSync(DOCS).filter((f) => f.endsWith(".pdf")).sort();
const results = [];
for (const f of files) {
  const r = await processDocument(resolve(DOCS, f), { mode: "live" });
  const ok = r.checked.fields.filter((x) => x.status === "verified").length;
  console.log(`${f}: ${ok}/${r.checked.fields.length} fields verified${r.checked.concerns.length ? `, concerns: ${r.checked.concerns.join(" | ")}` : ""}`);
  for (const x of r.checked.fields.filter((x) => x.status !== "verified")) console.log(`   ${x.status}: ${x.name} = ${x.value} ("${x.quote}")`);
  results.push(r.checked);
}

const shipment = results.filter((r) => /ADN-0042|ADN-2026-0881|WB-GZT-1182/.test(r.documentName));
console.log("cross-check of the chip shipment:", crossCheckShipment(shipment).map((x) => x.message).join(" ") || "documents agree");

const run = JSON.parse(readFileSync(resolve(ROOT, "data/demo-run.local.json"), "utf8"));
const claim = await processClaim(demo.BRAND_DRAFT_CLAIM, factsFromRun(run), { mode: "live" });
console.log(`\nclaim (${claim.final.source}): ${claim.final.text}`);
if (!claim.final.lock.ok) console.log(`  lock problems: ${claim.final.lock.problems.join(" ")}`);
for (const p of claim.final.review?.phrases ?? []) console.log(`  ${p.verdict}: "${p.text}" (${p.reason})`);
