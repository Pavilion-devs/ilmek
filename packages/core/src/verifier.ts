import type { Hex } from "viem";
import { compareWithVirginFiber, intensityKgPerKg, type FiberComparison } from "./carbon";
import { buildTree, certHash, claimHash, type EvidenceItem } from "./merkle";
import { pqPubKeyHash, pqVerifyRoot } from "./pq";
import { Stage, STAGE_NAME } from "./types";

/**
 * Public verifier for a garment passport. Runs in the browser.
 *
 * Trust model: the chain is the source of truth. The passport bundle (claim text, evidence items,
 * certifier signatures) comes from whoever serves the page, so every part of it is checked against
 * what the chain holds. Our own server is treated as untrusted.
 */

export interface LotView {
  stage: Stage;
  owner: Hex;
  producedAt: bigint;
  revoked: boolean;
  totalG: bigint;
  recycledG: bigint;
  embeddedCo2eG: bigint;
  certHash: Hex;
  evidenceRoot: Hex;
}

export interface PassportView {
  lotId: bigint;
  brand: Hex;
  recycledBps: number;
  co2eGPerKg: number;
  claimHash: Hex;
  mintedAt: bigint;
}

export interface Consumption {
  fromLotId: bigint;
  grams: bigint;
  recycledG: bigint;
}

/** Read access to the ledger. Implemented over a live RPC node or over a saved snapshot. */
export interface ChainReader {
  kind: "live" | "snapshot";
  describe: string;
  getLot(id: bigint): Promise<LotView>;
  getParents(id: bigint): Promise<bigint[]>;
  getPassport(id: bigint): Promise<PassportView>;
  getConsumedInto(id: bigint): Promise<Consumption[]>;
  isRegisteredInput(id: bigint): Promise<boolean>;
  getCertifierPqHash(certifier: Hex): Promise<Hex>;
  getMaxYieldBps(from: Stage, to: Stage): Promise<number>;
}

export interface EvidenceBundle {
  root: Hex;
  items: EvidenceItem[];
  pqSig: Hex;
}

/** Everything the page serves alongside the passport. Untrusted until checked. */
export interface PassportBundle {
  lotId: string;
  claim: string;
  certifierAddress: Hex;
  pqPublicKey: Hex;
  evidence: Record<string, EvidenceBundle>;
  evidenceOfLot: Record<string, string>;
}

export type CheckStatus = "pass" | "fail" | "info";

export interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  lotId?: string;
}

export interface JourneyStep {
  lotId: string;
  stage: Stage;
  stageName: string;
  kind: "registered input" | "processing step" | "shipment";
  kg: number;
  recycledKg: number;
  /** From the evidence bundle; null when the lot has no bundle of its own (shipments) */
  plantId: string | null;
  certificateNo: string | null;
  producedAt: string;
}

export interface VerificationResult {
  ok: boolean;
  source: ChainReader["kind"];
  sourceDescription: string;
  checks: Check[];
  journey: JourneyStep[];
  passport: PassportView | null;
  fiber: FiberComparison | null;
}

const fmtT = (g: bigint) => `${(Number(g) / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 })} t`;
const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-6)}`;

export async function verifyPassport(chain: ChainReader, bundle: PassportBundle): Promise<VerificationResult> {
  const checks: Check[] = [];
  const add = (c: Check) => checks.push(c);
  const lotId = BigInt(bundle.lotId);

  // 1. The passport exists and the label text is the one it was minted with.
  const passport = await chain.getPassport(lotId);
  if (passport.mintedAt === 0n) {
    add({ id: "passport", label: "Passport exists on the ledger", status: "fail", detail: `No passport for lot ${lotId}.` });
    return { ok: false, source: chain.kind, sourceDescription: chain.describe, checks, journey: [], passport: null, fiber: null };
  }
  add({ id: "passport", label: "Passport exists on the ledger", status: "pass", detail: `Lot ${lotId}, minted by the brand that owns the garments.` });

  const claimOk = claimHash(bundle.claim) === passport.claimHash;
  add({
    id: "claim",
    label: "Label text matches the passport",
    status: claimOk ? "pass" : "fail",
    detail: claimOk ? "The claim shown is exactly the one recorded when the passport was minted." : "The claim shown here was changed after the passport was minted.",
  });

  const garment = await chain.getLot(lotId);
  const bps = Number((garment.recycledG * 10000n) / garment.totalG);
  add({
    id: "share",
    label: "Recycled share recomputed from the ledger",
    status: bps === passport.recycledBps ? "pass" : "fail",
    detail: `${fmtT(garment.recycledG)} recycled of ${fmtT(garment.totalG)} = ${(bps / 100).toFixed(2)}%.`,
  });

  // 2. Walk back to the origin, checking every lot on the way.
  const pqKeyOk = pqPubKeyHash(bundle.pqPublicKey) === (await chain.getCertifierPqHash(bundle.certifierAddress));
  add({
    id: "pq-key",
    label: "Certifier's post-quantum key matches the ledger",
    status: pqKeyOk ? "pass" : "fail",
    detail: pqKeyOk ? "The ML-DSA-44 public key hashes to the value the ledger stores for this certifier." : "The public key served with this page is not the certifier's key on the ledger.",
  });

  const journey: JourneyStep[] = [];
  const seen = new Set<string>();
  const queue: bigint[] = [lotId];
  let yarnLot: LotView | null = null;
  const lotFail = (id: bigint, label: string, detail: string) => add({ id: `${label}-${id}`, label, status: "fail", detail, lotId: id.toString() });

  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id.toString())) continue;
    seen.add(id.toString());
    const lot = await chain.getLot(id);
    const parents = await chain.getParents(id);
    if (lot.stage === Stage.Yarn && !yarnLot) yarnLot = lot;
    if (lot.revoked) lotFail(id, "Lot frozen by a certifier", `Lot ${id} (${STAGE_NAME[lot.stage]}) was revoked; everything made from it is suspect.`);

    const key = bundle.evidenceOfLot[id.toString()];
    const ev = key ? bundle.evidence[key] : undefined;
    const stepRecord = ev?.items.find((i) => i.kind === "step-record") as Record<string, unknown> | undefined;
    const tcItem = ev?.items.find((i) => i.kind === "transaction-certificate") as Record<string, unknown> | undefined;
    const isInput = await chain.isRegisteredInput(id);
    const kind: JourneyStep["kind"] = isInput ? "registered input" : parents.length && !ev ? "shipment" : "processing step";

    journey.push({
      lotId: id.toString(),
      stage: lot.stage,
      stageName: STAGE_NAME[lot.stage],
      kind,
      kg: Number(lot.totalG) / 1000,
      recycledKg: Number(lot.recycledG) / 1000,
      plantId: (stepRecord?.plantId as string | undefined) ?? (isInput ? "recycler-adana" : null),
      certificateNo: (stepRecord?.certificateNo as string | undefined) ?? (tcItem?.no as string | undefined) ?? null,
      producedAt: new Date(Number(lot.producedAt) * 1000).toISOString(),
    });

    if (kind === "shipment") {
      // A shipment carries a proportional share of its parent, never more recycled content.
      const parent = await chain.getLot(parents[0]!);
      const ok = lot.recycledG * parent.totalG <= parent.recycledG * lot.totalG + parent.totalG;
      if (!ok) lotFail(id, "Shipment keeps its parent's recycled share", `Lot ${id} claims a higher recycled share than lot ${parents[0]} it was shipped from.`);
      if (lot.evidenceRoot !== parent.evidenceRoot) lotFail(id, "Shipment points at its parent's evidence", `Lot ${id} has different evidence from the lot it was shipped from.`);
    } else if (!isInput) {
      // Mass balance: recycled out ≤ recycled consumed × the best physical yield.
      const consumed = await chain.getConsumedInto(id);
      const recycledIn = consumed.reduce((a, c) => a + c.recycledG, 0n);
      const from = consumed.length ? (await chain.getLot(consumed[0]!.fromLotId)).stage : Stage.None;
      const yieldBps = await chain.getMaxYieldBps(from, lot.stage);
      const max = (recycledIn * BigInt(yieldBps)) / 10000n;
      if (lot.recycledG > max) lotFail(id, "Recycled mass balances", `Lot ${id} holds ${fmtT(lot.recycledG)} recycled but its inputs allow ${fmtT(max)}.`);
    }

    if (!ev) {
      if (kind !== "shipment") lotFail(id, "Evidence available", `No evidence bundle was served for lot ${id}.`);
    } else {
      const root = buildTree(ev.items).root;
      if (root !== lot.evidenceRoot) {
        lotFail(id, "Evidence matches the ledger", `Lot ${id}: the documents served here hash to ${short(root)}, but the ledger holds ${short(lot.evidenceRoot)}. Something was edited.`);
      }
      if (!pqVerifyRoot(lot.evidenceRoot, ev.pqSig, bundle.pqPublicKey)) {
        lotFail(id, "Certifier's post-quantum signature", `Lot ${id}: the ML-DSA-44 signature does not verify for this evidence.`);
      }
      const certNo = (stepRecord?.certificateNo ?? tcItem?.no) as string | undefined;
      if (certNo && certHash(certNo) !== lot.certHash) {
        lotFail(id, "Certificate number matches the ledger", `Lot ${id}: certificate ${certNo} is not the one recorded on the ledger.`);
      }
      const report = ev.items.find((i) => i.kind === "integrity-report") as { verdict?: string } | undefined;
      if (report?.verdict === "fail") lotFail(id, "Integrity checks passed before signing", `Lot ${id} was signed despite failing integrity checks.`);
    }

    if (!parents.length && !isInput) lotFail(id, "Chain starts at certified input", `Lot ${id} has no inputs and was not registered by a certifier.`);
    queue.push(...parents);
  }

  // Summaries for the per-lot checks (one line each when everything passed).
  const lotIds = [...seen];
  const summary = (label: string, detail: string) => {
    if (!checks.some((c) => c.label === label && c.status === "fail")) add({ id: label, label, status: "pass", detail });
  };
  const steps = journey.filter((j) => j.kind === "processing step").length;
  const inputs = journey.filter((j) => j.kind === "registered input").length;
  summary("Chain starts at certified input", `Traced back through ${lotIds.length} lots to ${inputs} certified bale lot${inputs === 1 ? "" : "s"}.`);
  summary("Recycled mass balances", `At each of ${steps} processing steps, recycled output is within what the inputs physically allow.`);
  summary("Shipment keeps its parent's recycled share", `Every shipment carries no more recycled content than the lot it came from.`);
  summary("Evidence matches the ledger", `Every document set hashes to the Merkle root stored on the ledger.`);
  summary("Certifier's post-quantum signature", `Every evidence root carries a valid ML-DSA-44 signature (FIPS 204), checked in this browser.`);
  summary("Certificate number matches the ledger", `Each certificate number in the documents is the one used once on the ledger.`);
  summary("Lot frozen by a certifier", `No lot in the chain has been frozen.`);
  summary("Integrity checks passed before signing", `Every step passed the integrity engine before the certifier signed.`);

  const fiber = yarnLot ? compareWithVirginFiber(intensityKgPerKg(yarnLot.embeddedCo2eG, yarnLot.totalG)) : null;
  if (fiber) add({ id: "fiber", label: "Fiber carbon footprint", status: "info", detail: fiber.sentence });
  add({ id: "garment-carbon", label: "Garment carbon footprint", status: "info", detail: `${(passport.co2eGPerKg / 1000).toFixed(1)} kg CO₂e per kg of garment, carried down the chain by the contract.` });

  const order = (c: Check) => (c.status === "fail" ? 0 : c.status === "pass" ? 1 : 2);
  checks.sort((a, b) => order(a) - order(b));
  return {
    ok: !checks.some((c) => c.status === "fail"),
    source: chain.kind,
    sourceDescription: chain.describe,
    checks,
    journey: journey.reverse(),
    passport,
    fiber,
  };
}

// ------------------------------------------------------------------ snapshot reader

type Json = Record<string, unknown>;
interface SnapshotRun {
  ranAt: string;
  chainId: number;
  ledger: string;
  chain: { lots: Record<string, Json & { parents: (string | number)[] }>; events: { eventName?: string; args?: Json }[]; yields: { from: number; to: number; onChainBps: number }[] };
  certifier: { address: string; pqPubKeyHashOnChain: string };
  passport: { lotId: string | number; recycledBps: number; claimHash: string };
}

const big = (v: unknown) => BigInt(v as string | number);

export function toLotView(o: Json): LotView {
  return {
    stage: Number(o.stage) as Stage,
    owner: o.owner as Hex,
    producedAt: big(o.producedAt),
    revoked: Boolean(o.revoked),
    totalG: big(o.totalG),
    recycledG: big(o.recycledG),
    embeddedCo2eG: big(o.embeddedCo2eG),
    certHash: o.certHash as Hex,
    evidenceRoot: o.evidenceRoot as Hex,
  };
}

/** Reads a saved copy of the chain (data/demo-run.*.json). Honest about what it is. */
export function snapshotReader(run: SnapshotRun): ChainReader {
  const ev = (name: string) => run.chain.events.filter((e) => e.eventName === name).map((e) => e.args ?? {});
  const passportEvent = ev("PassportMinted").find((a) => String(a.lotId) === String(run.passport.lotId));
  return {
    kind: "snapshot",
    describe: `Saved copy of chain ${run.chainId} state, recorded ${run.ranAt.slice(0, 16).replace("T", " ")} UTC. For a trustless check, connect to a live node.`,
    async getLot(id) {
      const l = run.chain.lots[id.toString()];
      if (!l) throw new Error(`lot ${id} not in snapshot`);
      return toLotView(l);
    },
    async getParents(id) {
      return (run.chain.lots[id.toString()]?.parents ?? []).map(big);
    },
    async getPassport(id) {
      const a = ev("PassportMinted").find((x) => String(x.lotId) === id.toString());
      if (!a) return { lotId: id, brand: "0x0" as Hex, recycledBps: 0, co2eGPerKg: 0, claimHash: "0x0" as Hex, mintedAt: 0n };
      return { lotId: id, brand: a.brand as Hex, recycledBps: Number(a.recycledBps), co2eGPerKg: Number(a.co2eGPerKg), claimHash: a.claimHash as Hex, mintedAt: passportEvent ? 1n : 0n };
    },
    async getConsumedInto(id) {
      return ev("Consumed")
        .filter((a) => String(a.intoLotId) === id.toString())
        .map((a) => ({ fromLotId: big(a.lotId), grams: big(a.grams), recycledG: big(a.recycledG) }));
    },
    async isRegisteredInput(id) {
      return ev("InputRegistered").some((a) => String(a.lotId) === id.toString());
    },
    async getCertifierPqHash(addr) {
      return (addr.toLowerCase() === run.certifier.address.toLowerCase() ? run.certifier.pqPubKeyHashOnChain : "0x") as Hex;
    },
    async getMaxYieldBps(from, to) {
      return run.chain.yields.find((y) => y.from === from && y.to === to)?.onChainBps ?? 0;
    },
  };
}

/** The bundle a passport page serves, built from a run file. */
export function bundleFromRun(run: {
  passport: { lotId: string | number; claim: string };
  certifier: { address: string; pqPublicKey: string };
  evidence: Record<string, EvidenceBundle>;
  evidenceOfLot: Record<string, string>;
}): PassportBundle {
  return {
    lotId: String(run.passport.lotId),
    claim: run.passport.claim,
    certifierAddress: run.certifier.address as Hex,
    pqPublicKey: run.certifier.pqPublicKey as Hex,
    evidence: run.evidence,
    evidenceOfLot: run.evidenceOfLot,
  };
}
