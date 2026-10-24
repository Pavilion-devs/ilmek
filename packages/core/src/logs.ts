import type { Abi, Hex, PublicClient } from "viem";

/**
 * Public RPCs cap how many blocks one eth_getLogs call may cover (Base's public endpoint: 200).
 * This walks the range in chunks so event reads keep working however old the deployment is.
 */
export async function getEventsChunked(
  client: Pick<PublicClient, "getContractEvents" | "getBlockNumber">,
  address: Hex,
  abi: Abi,
  fromBlock: bigint,
  toBlock?: bigint,
  eventName?: string,
  step = 190n,
) {
  const end = toBlock ?? (await client.getBlockNumber());
  const out: Awaited<ReturnType<PublicClient["getContractEvents"]>> = [];
  for (let start = fromBlock; start <= end; start += step + 1n) {
    const stop = start + step > end ? end : start + step;
    const chunk = await client.getContractEvents({ address, abi, fromBlock: start, toBlock: stop, ...(eventName ? { eventName } : {}) });
    out.push(...chunk);
  }
  return out;
}
