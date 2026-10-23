import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { compareWithVirginFiber, type FiberComparison } from "@ilmek/core";
import { finalizeClaim, reviewClaim, type ClaimReview, type FinalClaim, type PassportFacts } from "./claims";
import { extractDocument, type DocumentInput, type Extraction } from "./extract";
import { pdfPages } from "./pdf";
import { checkExtraction, type CheckedExtraction } from "./verify";

/**
 * Live or recorded AI calls.
 *   live      call Claude, and save the response to packages/ai/recorded/
 *   recorded  replay a saved response (no key needed); labelled "recorded response" in the app
 *   auto      live when credentials are present, recorded otherwise (default)
 * Set with ILMEK_AI=live|recorded|auto.
 */
export type AiMode = "live" | "recorded" | "auto";

const RECORDED_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../recorded");

export interface Provenance {
  source: "live" | "recorded" | "none";
  model?: string;
  recordedAt?: string;
  inputHash: string;
}

interface Recording<T> {
  kind: "extraction" | "claim-review";
  id: string;
  inputHash: string;
  model: string;
  recordedAt: string;
  note: string;
  output: T;
  usage: unknown;
}

export function hasCredentials(): boolean {
  return Boolean(
    process.env.ANTHROPIC_API_KEY ||
      process.env.ANTHROPIC_AUTH_TOKEN ||
      process.env.ANTHROPIC_PROFILE ||
      existsSync(resolve(homedir(), ".config/anthropic")),
  );
}

function resolveMode(mode?: AiMode): "live" | "recorded" {
  const m = mode ?? (process.env.ILMEK_AI as AiMode | undefined) ?? "auto";
  return m === "auto" ? (hasCredentials() ? "live" : "recorded") : m;
}

const sha256 = (data: Uint8Array | string) => createHash("sha256").update(data).digest("hex");
const recordingPath = (kind: string, id: string) => resolve(RECORDED_DIR, `${kind}.${id}.json`);

function load<T>(kind: Recording<T>["kind"], id: string, inputHash: string): Recording<T> | undefined {
  const p = recordingPath(kind, id);
  if (!existsSync(p)) return undefined;
  const rec = JSON.parse(readFileSync(p, "utf8")) as Recording<T>;
  return rec.inputHash === inputHash ? rec : undefined; // input changed since recording: don't reuse
}

function save<T>(rec: Recording<T>) {
  mkdirSync(RECORDED_DIR, { recursive: true });
  writeFileSync(recordingPath(rec.kind, rec.id), JSON.stringify(rec, null, 2) + "\n");
}

// ------------------------------------------------------------------ documents

export interface ProcessedDocument {
  checked: CheckedExtraction;
  provenance: Provenance;
}

export async function processDocument(file: string, opts: { mode?: AiMode } = {}): Promise<ProcessedDocument> {
  const bytes = new Uint8Array(readFileSync(file));
  const name = basename(file);
  const ext = extname(file).toLowerCase();
  const input: DocumentInput =
    ext === ".pdf"
      ? { kind: "pdf", name, bytes }
      : { kind: "image", name, bytes, mediaType: ext === ".png" ? "image/png" : "image/jpeg" };
  const inputHash = sha256(bytes);
  const id = name.replace(/\.[^.]+$/, "");
  const mode = resolveMode(opts.mode);

  let extraction: Extraction;
  let provenance: Provenance;
  if (mode === "live") {
    const r = await extractDocument(input);
    const recordedAt = new Date().toISOString();
    save({ kind: "extraction", id, inputHash, model: r.model, recordedAt, note: "Recorded live response from the Claude API.", output: r.extraction, usage: r.usage });
    extraction = r.extraction;
    provenance = { source: "live", model: r.model, recordedAt, inputHash };
  } else {
    const rec = load<Extraction>("extraction", id, inputHash);
    if (!rec) throw new Error(`No recording for ${name}. Run "pnpm --filter @ilmek/ai record" with an Anthropic API key.`);
    extraction = rec.output;
    provenance = { source: "recorded", model: rec.model, recordedAt: rec.recordedAt, inputHash };
  }

  const pages = input.kind === "pdf" ? await pdfPages(bytes) : null;
  return { checked: checkExtraction(name, extraction, pages), provenance };
}

// ------------------------------------------------------------------ claims

export interface ProcessedClaim {
  draft: string;
  facts: PassportFacts;
  final: FinalClaim;
  provenance: Provenance;
}

export async function processClaim(draft: string, facts: PassportFacts, opts: { mode?: AiMode; id?: string } = {}): Promise<ProcessedClaim> {
  const inputHash = sha256(JSON.stringify({ draft, facts }));
  const id = opts.id ?? "brand-draft";
  const mode = resolveMode(opts.mode);

  let review: ClaimReview | null = null;
  let provenance: Provenance = { source: "none", inputHash };
  if (mode === "live") {
    const r = await reviewClaim(draft, facts);
    const recordedAt = new Date().toISOString();
    save({ kind: "claim-review", id, inputHash, model: r.model, recordedAt, note: "Recorded live response from the Claude API.", output: r.review, usage: r.usage });
    review = r.review;
    provenance = { source: "live", model: r.model, recordedAt, inputHash };
  } else {
    const rec = load<ClaimReview>("claim-review", id, inputHash);
    if (rec) {
      review = rec.output;
      provenance = { source: "recorded", model: rec.model, recordedAt: rec.recordedAt, inputHash };
    }
  }
  return { draft, facts, final: finalizeClaim(review, facts), provenance };
}

/** Passport facts from a demo run file (data/demo-run.*.json). */
export function factsFromRun(run: {
  passport: { recycledBps: number | string };
  fiberComparison: { honestGrid: FiberComparison };
}): PassportFacts {
  const cmp = compareWithVirginFiber(run.fiberComparison.honestGrid.actualKgPerKg);
  return {
    scope: "Shell fabric",
    recycledPercent: Math.floor(Number(run.passport.recycledBps) / 100),
    recycledMaterial: "recycled polyester",
    fiberCo2eKgPerKg: Math.round(cmp.actualKgPerKg * 10) / 10,
    virginFiberCo2eKgPerKg: Math.round(cmp.virginKgPerKg * 10) / 10,
    fiberSavingPercent: Math.round(cmp.savingShare * 100),
    carbonLabel: cmp.label,
  };
}
