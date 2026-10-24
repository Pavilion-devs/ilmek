import { createPublicClient, defineChain, http, type Abi, type Hex } from "viem";
import abiJson from "./FiberLedger.abi.json";
import { getEventsChunked } from "./logs";
import { Stage } from "./types";
import { toLotView, type ChainReader, type LotView } from "./verifier";

const abi = abiJson as Abi;
type Ev = { args: Record<string, unknown> };

/**
 * Reads the ledger straight from a node. Nothing here comes from the page's own server.
 * On first use it loads every lot and the relevant events in parallel (reads are batched through
 * Multicall3 where the chain has it), so the verifier's walk doesn't wait on one call at a time.
 */
/** Multicall3 has the same address on nearly every EVM chain, including Base Sepolia. */
const MULTICALL3 = "0xcA11bde05977b3631167028862bE2a173976CA11";

export function liveReader(rpcUrl: string, ledger: Hex, fromBlock: bigint, toBlock?: bigint, chainId = 84532): ChainReader {
  const chain = defineChain({
    id: chainId,
    name: `chain ${chainId}`,
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
    // Local test chains have no Multicall3; plain calls are fine there.
    ...(chainId === 31337 ? {} : { contracts: { multicall3: { address: MULTICALL3 } } }),
  });
  const client = createPublicClient({ chain, transport: http(rpcUrl, { retryCount: 4, retryDelay: 400 }), batch: { multicall: chainId !== 31337 } });
  const read = <T>(functionName: string, args: unknown[] = []) =>
    client.readContract({ address: ledger, abi, functionName, args }) as Promise<T>;
  const events = (eventName: string) => getEventsChunked(client, ledger, abi, fromBlock, toBlock, eventName) as Promise<Ev[]>;

  let loaded:
    | Promise<{ lots: Map<string, LotView>; parents: Map<string, bigint[]>; consumed: Ev[]; inputs: Ev[] }>
    | undefined;
  const load = () =>
    (loaded ??= (async () => {
      const [count, consumed, inputs] = await Promise.all([read<bigint>("lotCount"), events("Consumed"), events("InputRegistered")]);
      const ids = Array.from({ length: Number(count) }, (_, i) => BigInt(i + 1));
      const [lotRows, parentRows] = await Promise.all([
        Promise.all(ids.map((id) => read<Record<string, unknown>>("getLot", [id]))),
        Promise.all(ids.map((id) => read<bigint[]>("getParents", [id]))),
      ]);
      const lots = new Map(ids.map((id, i) => [id.toString(), toLotView(lotRows[i]!)]));
      const parents = new Map(ids.map((id, i) => [id.toString(), [...parentRows[i]!]]));
      return { lots, parents, consumed, inputs };
    })());

  return {
    kind: "live",
    describe: `Read live from the ledger contract ${ledger} via ${new URL(rpcUrl).host}.`,
    async getLot(id) {
      const l = (await load()).lots.get(id.toString());
      return l ?? toLotView(await read<Record<string, unknown>>("getLot", [id]));
    },
    async getParents(id) {
      return (await load()).parents.get(id.toString()) ?? read<bigint[]>("getParents", [id]);
    },
    async getPassport(id) {
      const p = await read<{ lotId: bigint; brand: Hex; recycledBps: number; co2eGPerKg: number; claimHash: Hex; mintedAt: bigint }>("getPassport", [id]);
      return { ...p, recycledBps: Number(p.recycledBps), co2eGPerKg: Number(p.co2eGPerKg), mintedAt: BigInt(p.mintedAt) };
    },
    async getConsumedInto(id) {
      return (await load()).consumed
        .filter((e) => e.args.intoLotId === id)
        .map((e) => ({ fromLotId: e.args.lotId as bigint, grams: BigInt(e.args.grams as bigint), recycledG: BigInt(e.args.recycledG as bigint) }));
    },
    async isRegisteredInput(id) {
      return (await load()).inputs.some((e) => e.args.lotId === id);
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
