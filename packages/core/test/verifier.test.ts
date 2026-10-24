import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { bundleFromRun, snapshotReader, verifyPassport, type PassportBundle } from "../src/index";

const RUN = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/demo-run.local.json");
const run = JSON.parse(readFileSync(RUN, "utf8"));
const fresh = (): PassportBundle => structuredClone(bundleFromRun(run));
const failed = async (b: PassportBundle) =>
  (await verifyPassport(snapshotReader(run), b)).checks.filter((c) => c.status === "fail").map((c) => c.label);

describe("public verifier on the demo run", () => {
  test("the honest passport passes every check and traces back to the bales", async () => {
    const r = await verifyPassport(snapshotReader(run), fresh());
    expect(r.checks.filter((c) => c.status === "fail")).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.journey[0]?.kind).toBe("registered input");
    expect(r.journey.at(-1)?.lotId).toBe(String(run.passport.lotId));
    expect(r.fiber?.label).toBe("low-carbon");
  });

  test("an edited label fails", async () => {
    const b = fresh();
    b.claim = b.claim.replace("57%", "100%");
    expect(await failed(b)).toEqual(["Label text matches the passport"]);
  });

  test("an edited number in the documents fails", async () => {
    const b = fresh();
    const key = run.evidenceOfLot["10"]; // the honest yarn step
    const rec = b.evidence[key]!.items.find((i) => i.kind === "step-record")!;
    rec.electricityKwh = 70_000;
    expect(await failed(b)).toContain("Evidence matches the ledger");
  });

  test("a different post-quantum key fails", async () => {
    const b = fresh();
    b.pqPublicKey = ("0x" + "11".repeat(1312)) as `0x${string}`;
    const f = await failed(b);
    expect(f).toContain("Certifier's post-quantum key matches the ledger");
    expect(f).toContain("Certifier's post-quantum signature");
  });

  test("a revoked lot upstream fails the whole passport", async () => {
    const r2 = structuredClone(run);
    r2.chain.lots["7"].revoked = true; // chips shipped to the spinner
    expect((await verifyPassport(snapshotReader(r2), fresh())).checks.find((c) => c.status === "fail")?.label).toBe("Lot frozen by a certifier");
  });

  test("an inflated recycled figure on the ledger copy fails the mass balance", async () => {
    const r2 = structuredClone(run);
    r2.chain.lots["10"].recycledG = "50000000"; // yarn: 50 t recycled from 30 t chips
    expect(await failed2(r2)).toContain("Recycled mass balances");
  });
});

async function failed2(r: unknown) {
  return (await verifyPassport(snapshotReader(r as never), bundleFromRun(r as never))).checks.filter((c) => c.status === "fail").map((c) => c.label);
}
