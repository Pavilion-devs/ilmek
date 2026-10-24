import { createPublicClient, http, type Abi, type Hex } from "viem";
import abiJson from "./FiberLedger.abi.json";
import { Stage } from "./types";
import { toLotView, type ChainReader } from "./verifier";

const abi = abiJson as Abi;

/** Reads the ledger straight from a node. Nothing here comes from the page's own server. */
export function liveReader(rpcUrl: string, ledger: Hex, fromBlock: bigint): ChainReader {
  const client = createPublicClient({ transport: http(rpcUrl) });
  const read = <T>(functionName: string, args: unknown[] = []) =>
    client.readContract({ address: ledger, abi, functionName, args }) as Promise<T>;
  const events = (eventName: string) =>
    client.getContractEvents({ address: ledger, abi, eventName, fromBlock }) as Promise<{ args: Record<string, unknown> }[]>;
  let consumed: Promise<{ args: Record<string, unknown> }[]> | undefined;
  let inputs: Promise<{ args: Record<string, unknown> }[]> | undefined;

  return {
    kind: "live",
    describe: `Read live from the ledger contract ${ledger} via ${new URL(rpcUrl).host}.`,
    async getLot(id) {
      return toLotView(await read<Record<string, unknown>>("getLot", [id]));
    },
    getParents: (id) => read<bigint[]>("getParents", [id]),
    async getPassport(id) {
      const p = await read<{ lotId: bigint; brand: Hex; recycledBps: number; co2eGPerKg: number; claimHash: Hex; mintedAt: bigint }>("getPassport", [id]);
      return { ...p, recycledBps: Number(p.recycledBps), co2eGPerKg: Number(p.co2eGPerKg), mintedAt: BigInt(p.mintedAt) };
    },
    async getConsumedInto(id) {
      consumed ??= events("Consumed");
      return (await consumed)
        .filter((e) => e.args.intoLotId === id)
        .map((e) => ({ fromLotId: e.args.lotId as bigint, grams: BigInt(e.args.grams as bigint), recycledG: BigInt(e.args.recycledG as bigint) }));
    },
    async isRegisteredInput(id) {
      inputs ??= events("InputRegistered");
      return (await inputs).some((e) => e.args.lotId === id);
    },
    async getCertifierPqHash(addr) {
      const [, hash] = await read<[boolean, Hex]>("certifiers", [addr]);
      return hash;
    },
    async getMaxYieldBps(from: Stage, to: Stage) {
      return Number(await read<number>("maxYieldBps", [from, to]));
    },
  };
}
