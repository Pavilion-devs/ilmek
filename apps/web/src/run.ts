import type { CheckedExtraction, ClaimReview, FinalClaim, PassportFacts } from "@ilmek/ai/browser";
import type { EvidenceBundle, FiberComparison, IntegrityReport, Plant, StepRecord } from "@ilmek/core";

/**
 * The demo run written by scripts/src/run-demo.ts. A public-testnet run (demo-run.<chainId>.json)
 * is preferred over the local one when both exist.
 */
const runs = import.meta.glob<{ default: Run }>("../../../data/demo-run.*.json", { eager: true });
const pick = Object.keys(runs).sort((a, b) => Number(a.includes(".local.")) - Number(b.includes(".local.")))[0];
if (!pick) throw new Error("No demo run found. Run `pnpm demo:local` first.");

export interface Refusal {
  label: string;
  errorName: string;
  errorArgs: string[];
  txHash: string;
  status: string;
}

export interface ProcessedDoc {
  checked: CheckedExtraction;
  provenance: { source: "live" | "recorded" | "none"; model?: string; recordedAt?: string };
}

export interface Run {
  chainId: number;
  ledger: `0x${string}`;
  rpcUrl: string;
  deployBlock: string;
  lastBlock?: string;
  deployTx: string;
  ranAt: string;
  accounts: Record<string, string>;
  lots: Record<string, string>;
  refusals: {
    certificateReuse: Refusal;
    overclaim: Refusal & { integrity: IntegrityReport };
  };
  passport: {
    lotId: string;
    recycledBps: number;
    co2eKgPerKgGarment: number;
    claim: string;
    claimHash: string;
    brandDraftClaim: string;
    claimCheck: { draft: string; facts: PassportFacts; final: FinalClaim & { review: ClaimReview | null }; provenance: ProcessedDoc["provenance"] };
  };
  fiberComparison: { honestGrid: FiberComparison; coalPowered: FiberComparison; garmentRecycledKg: number };
  integrityReports: Record<string, IntegrityReport>;
  evidence: Record<string, EvidenceBundle>;
  evidenceOfLot: Record<string, string>;
  certifier: { address: `0x${string}`; pqPublicKey: `0x${string}`; pqPubKeyHashOnChain: string; demoKeys: boolean };
  chain: {
    lotCount: string;
    lots: Record<string, Record<string, unknown> & { parents: string[] }>;
    events: { eventName?: string; args?: Record<string, unknown>; blockNumber: string; transactionHash: string }[];
    yields: { from: number; to: number; bps: number; onChainBps: number }[];
  };
  documents: Record<string, ProcessedDoc>;
  documentsByStep: { chipShipment: string[]; yarnEnergy: string[]; fraudYarnCertificate: string[] };
  shipmentCrossCheck: { severity: "warn" | "fail"; message: string }[];
  steps: Record<string, StepRecord>;
  plants: Record<string, Plant>;
  transactions: { label: string; hash: string; status: string }[];
}

export const run: Run = runs[pick]!.default;
export const isLocalRun = run.chainId === 31337;

const EXPLORERS: Record<number, string> = { 84532: "https://sepolia.basescan.org", 11155111: "https://sepolia.etherscan.io" };
export const txUrl = (hash: string) => (EXPLORERS[run.chainId] ? `${EXPLORERS[run.chainId]}/tx/${hash}` : null);
export const addressUrl = (a: string) => (EXPLORERS[run.chainId] ? `${EXPLORERS[run.chainId]}/address/${a}` : null);
export const chainName = (id = run.chainId) => ({ 31337: "local test chain", 84532: "Base Sepolia", 11155111: "Ethereum Sepolia" })[id] ?? `chain ${id}`;

export const plantById = (id: string | null | undefined): Plant | undefined =>
  Object.values(run.plants).find((p) => p.id === id);

export const t = (kg: number, digits = 1) => `${(kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: digits })} t`;
export const kgFromG = (g: unknown) => Number(g) / 1000;
export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;
