import { bundleFromRun, liveReader, snapshotReader, STAGE_NAME, verifyPassport, type PassportBundle, type VerificationResult } from "@ilmek/core";
import { useEffect, useState } from "react";
import { Badge, Card, Hash, StatusIcon } from "../components/ui";
import { chainName, isLocalRun, plantById, run, t } from "../run";

type Tamper = "label" | "document" | "pqkey" | "ledger";

const TAMPERS: { key: Tamper; label: string; detail: string; snapshotOnly?: boolean }[] = [
  { key: "label", label: "Edit the label", detail: "Change “57%” to “100%” in the claim text." },
  { key: "document", label: "Edit a document", detail: "Lower the spinner's electricity from 110,000 to 70,000 kWh to shrink its carbon." },
  { key: "pqkey", label: "Swap the certifier's key", detail: "Serve a different post-quantum public key with the page." },
  { key: "ledger", label: "Fake the ledger copy", detail: "Pretend the saved chain says the yarn is 50 t recycled.", snapshotOnly: true },
];

function buildBundle(tampers: Set<Tamper>): PassportBundle {
  const b = structuredClone(bundleFromRun(run));
  if (tampers.has("label")) b.claim = b.claim.replace(/\d+%/, "100%");
  if (tampers.has("document")) {
    const key = run.evidenceOfLot[run.lots.yarn!]!;
    const rec = b.evidence[key]!.items.find((i) => i.kind === "step-record");
    if (rec) rec.electricityKwh = 70_000;
  }
  if (tampers.has("pqkey")) b.pqPublicKey = `0x${"5a".repeat(1312)}`;
  return b;
}

function snapshotRun(tampers: Set<Tamper>) {
  if (!tampers.has("ledger")) return run;
  const r = structuredClone(run);
  r.chain.lots[run.lots.yarn!]!.recycledG = "50000000";
  return r;
}

export function Verify({ lotId, embedded = false }: { lotId: string; embedded?: boolean }) {
  const [source, setSource] = useState<"snapshot" | "live">("snapshot");
  const [rpc, setRpc] = useState(run.rpcUrl);
  const [tampers, setTampers] = useState<Set<Tamper>>(new Set());
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ms, setMs] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const go = async () => {
      setBusy(true);
      setError(null);
      const start = performance.now();
      try {
        const reader =
          source === "live" ? liveReader(rpc, run.ledger, BigInt(run.deployBlock), run.lastBlock ? BigInt(run.lastBlock) : undefined, run.chainId) : snapshotReader(snapshotRun(tampers) as never);
        const bundle = { ...buildBundle(tampers), lotId };
        const r = await verifyPassport(reader, bundle);
        if (!cancelled) {
          setResult(r);
          setMs(performance.now() - start);
        }
      } catch (e) {
        if (!cancelled) {
          setResult(null);
          setError(source === "live" ? `Could not read the ledger at ${rpc}. ${isLocalRun ? "Start the local chain with `pnpm demo:local --keep`." : ""}` : (e as Error).message);
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    go();
    return () => {
      cancelled = true;
    };
  }, [source, rpc, tampers, lotId]);

  const toggle = (k: Tamper) =>
    setTampers((s) => {
      const n = new Set(s);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });

  const fails = result?.checks.filter((c) => c.status === "fail") ?? [];

  return (
    <div className={embedded ? "" : "py-10"}>
      {!embedded && (
        <>
          <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">Public verifier</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">Check passport {lotId} yourself</h1>
        </>
      )}
      <p className={`max-w-2xl text-sm text-muted ${embedded ? "" : "mt-2"}`}>
        Everything below runs in your browser. The page's own server is treated as untrusted: the label, documents and signatures it serves are
        each checked against the ledger.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 space-y-6">
          <Card className={`p-5 ${result ? (result.ok ? "border-ok/40" : "border-bad/40") : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-3" aria-live="polite">
              <div className="flex items-center gap-3">
                {busy ? (
                  <span className="text-sm text-muted">Checking…</span>
                ) : error ? (
                  <>
                    <StatusIcon status="fail" />
                    <span className="font-semibold">Could not check</span>
                  </>
                ) : result?.ok ? (
                  <>
                    <StatusIcon status="pass" />
                    <span className="text-lg font-semibold">Passport verified</span>
                  </>
                ) : (
                  <>
                    <StatusIcon status="fail" />
                    <span className="text-lg font-semibold">
                      {fails.length} check{fails.length === 1 ? "" : "s"} failed
                    </span>
                  </>
                )}
              </div>
              {result && !busy && <span className="text-xs text-muted tabular">{result.checks.length} checks in {Math.max(1, Math.round(ms))} ms</span>}
            </div>
            {error && <p className="mt-3 text-sm text-bad">{error}</p>}
            {result && <p className="mt-2 text-xs text-muted">{result.sourceDescription}</p>}
          </Card>

          {result && (
            <Card>
              <ul className="divide-y divide-line">
                {result.checks.map((c) => (
                  <li key={c.id} className="flex gap-3 p-4">
                    <StatusIcon status={c.status} />
                    <div className="min-w-0">
                      <div className="font-medium">{c.label}</div>
                      <div className="mt-0.5 break-words text-sm text-muted">{c.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {result && result.journey.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-line p-4 font-medium">Every lot behind this passport, from the ledger</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead className="text-left text-xs text-muted">
                    <tr>
                      <th className="px-4 py-2 font-normal">Lot</th>
                      <th className="px-4 py-2 font-normal">What</th>
                      <th className="px-4 py-2 font-normal">Where</th>
                      <th className="px-4 py-2 text-right font-normal">Mass</th>
                      <th className="px-4 py-2 text-right font-normal">Recycled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line tabular">
                    {result.journey.map((j) => (
                      <tr key={j.lotId}>
                        <td className="px-4 py-2 font-mono text-xs">{j.lotId}</td>
                        <td className="px-4 py-2">
                          {STAGE_NAME[j.stage]}
                          <div className="text-xs text-muted">{j.kind}</div>
                        </td>
                        <td className="px-4 py-2">{plantById(j.plantId)?.city ?? <span className="text-muted">shipped</span>}</td>
                        <td className="px-4 py-2 text-right">{t(j.kg)}</td>
                        <td className="px-4 py-2 text-right">{Math.round((j.recycledKg / j.kg) * 100)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="font-medium">Read the ledger from</div>
            <fieldset className="mt-3 space-y-2 text-sm">
              <legend className="sr-only">Data source</legend>
              <label className="flex items-start gap-2">
                <input type="radio" name="src" checked={source === "snapshot"} onChange={() => setSource("snapshot")} className="mt-1 accent-[rgb(var(--accent))]" />
                <span>
                  Saved copy <span className="block text-xs text-muted">Works offline; trusts that the copy is faithful.</span>
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input type="radio" name="src" checked={source === "live"} onChange={() => setSource("live")} className="mt-1 accent-[rgb(var(--accent))]" />
                <span>
                  Live node <span className="block text-xs text-muted">Trustless: reads the contract on the {chainName()}.</span>
                </span>
              </label>
            </fieldset>
            {source === "live" && (
              <label className="mt-3 block text-xs text-muted">
                RPC URL
                <input value={rpc} onChange={(e) => setRpc(e.target.value)} className="mt-1 w-full rounded-lg border border-line bg-paper px-2 py-1.5 font-mono text-xs text-ink" />
              </label>
            )}
            <div className="mt-4 space-y-1 text-xs text-muted">
              <div>
                Contract <Hash value={run.ledger} kind="address" />
              </div>
            </div>
          </Card>

          <Card className="p-5">
            <div className="font-medium">Try to break it</div>
            <p className="mt-1 text-xs text-muted">Each switch changes what this page serves. The checks re-run.</p>
            <div className="mt-4 space-y-3">
              {TAMPERS.filter((x) => !(x.snapshotOnly && source === "live")).map((x) => (
                <label key={x.key} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input type="checkbox" checked={tampers.has(x.key)} onChange={() => toggle(x.key)} className="mt-1 accent-[rgb(var(--accent))]" />
                  <span>
                    {x.label}
                    <span className="block text-xs text-muted">{x.detail}</span>
                  </span>
                </label>
              ))}
            </div>
            {tampers.size > 0 && (
              <button type="button" onClick={() => setTampers(new Set())} className="mt-4 text-xs text-accent hover:underline">
                Undo all changes
              </button>
            )}
          </Card>
          {tampers.size > 0 && result && !result.ok && <Badge tone="ok">Tampering detected, as it should be</Badge>}
        </aside>
      </div>
    </div>
  );
}
