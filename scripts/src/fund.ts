/**
 * Shows the Base Sepolia demo accounts and tops them up from the admin account.
 *
 *   pnpm --filter @ilmek/scripts fund          show addresses and balances
 *   pnpm --filter @ilmek/scripts fund --send   send test ETH from admin to accounts below the minimum
 *
 * Keys come from .env.base-sepolia (git-ignored, testnet only).
 */
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createPublicClient, createWalletClient, formatEther, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { loadDotEnv } from "@ilmek/ai";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
loadDotEnv(resolve(ROOT, ".env.base-sepolia"));

const NAMES = ["ADMIN", "CERTIFIER", "RECYCLER", "SPINNER", "COALSPINNER", "MILL", "MAKER", "BRAND"] as const;
// Admin deploys and configures (most gas); the others send a handful of transactions each.
const MIN: Record<string, bigint> = { ADMIN: parseEther("0.0015") };
const DEFAULT_MIN = parseEther("0.0003");

const rpc = process.env.RPC_URL ?? "https://sepolia.base.org";
const pub = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const accounts = NAMES.map((n) => {
  const pk = process.env[`PK_${n}`] as Hex | undefined;
  if (!pk) throw new Error(`PK_${n} missing from .env.base-sepolia`);
  return { name: n, account: privateKeyToAccount(pk) };
});

const send = process.argv.includes("--send");
console.log(`Base Sepolia (${rpc})\n`);
const balances = await Promise.all(accounts.map((a) => pub.getBalance({ address: a.account.address })));
accounts.forEach((a, i) => console.log(`${a.name.padEnd(12)} ${a.account.address}  ${formatEther(balances[i]!)} ETH`));

const admin = accounts[0]!;
const needs = accounts.slice(1).map((a, i) => ({ a, short: (MIN[a.name] ?? DEFAULT_MIN) - balances[i + 1]! })).filter((x) => x.short > 0n);
const total = needs.reduce((s, x) => s + x.short, 0n) + (MIN.ADMIN ?? 0n);
console.log(`\nAdmin needs at least ${formatEther(total)} ETH to fund everyone and deploy.`);

if (!send) {
  console.log(`\nFund the ADMIN address above from a Base Sepolia faucet, then run with --send.`);
  process.exit(0);
}
if (balances[0]! < total) {
  console.error(`Admin has ${formatEther(balances[0]!)} ETH, not enough. Fund ${admin.account.address} first.`);
  process.exit(1);
}
const wallet = createWalletClient({ account: admin.account, chain: baseSepolia, transport: http(rpc) });
for (const { a, short } of needs) {
  const hash = await wallet.sendTransaction({ to: a.account.address, value: short });
  await pub.waitForTransactionReceipt({ hash });
  console.log(`sent ${formatEther(short)} ETH to ${a.name} (${hash})`);
}
console.log("done");
