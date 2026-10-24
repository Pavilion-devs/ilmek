import { run } from "../run";

const NAMES: Record<string, string> = {
  admin: "Admin",
  certifier: "Certifier",
  recycler: "Recycler · Adana",
  spinner: "Spinner · Gaziantep",
  coalSpinner: "Spinner · Kahramanmaraş",
  mill: "Fabric mill · Bursa",
  maker: "Garment maker · Denizli",
  brand: "Brand · Amsterdam",
};

/** Display name for a ledger address in the demo run (parties are pseudonymous on-chain). */
export function partyOf(address: string): string {
  const key = Object.entries(run.accounts).find(([, a]) => a.toLowerCase() === address.toLowerCase())?.[0];
  return key ? (NAMES[key] ?? key) : `${address.slice(0, 6)}…${address.slice(-4)}`;
}
