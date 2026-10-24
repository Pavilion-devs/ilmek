import { STAGE_NAME, Stage, VIRGIN_POLYESTER_FIBER_KG_PER_KG } from "@ilmek/core";
import { Badge, Bar, Hash, Kpi, Panel, Ring, StatusIcon } from "../components/ui";
import { kgFromG, run, t } from "../run";
import { partyOf } from "./parties";

const lot = (id: string | undefined) => run.chain.lots[id ?? ""]!;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function Home() {
  const L = run.lots;
  const garment = lot(L.garmentAtBrand);
  const recycledKg = kgFromG(garment.recycledG);
  const share = run.passport.recycledBps / 10000;
  const fc = run.fiberComparison;
  const docs = Object.values(run.documents);
  const fields = docs.reduce((a, d) => a + d.checked.fields.length, 0);
  const ok = docs.reduce((a, d) => a + d.checked.fields.filter((f) => f.status === "verified").length, 0);
  const refusals = [run.refusals.overclaim, run.refusals.certificateReuse];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icon="check" tone="ok" label="Recycled fiber verified" value={t(recycledKg)} note={`In ${t(kgFromG(garment.totalG))} of finished jackets`} aside={<Ring value={share} tone="ok" />} />
        <Kpi icon="alert" tone="bad" label="Fraud refused on-chain" value={refusals.length} note="Over-claim and certificate reuse" />
        <Kpi
          icon="leaf"
          tone="accent"
          label="Fiber footprint"
          value={
            <>
              {fc.honestGrid.actualKgPerKg.toFixed(1)} <span className="text-base font-medium text-muted">kg CO₂e/kg</span>
            </>
          }
          note={`Virgin polyester ${VIRGIN_POLYESTER_FIBER_KG_PER_KG.toFixed(1)}`}
          aside={<Ring value={fc.honestGrid.savingShare} tone="accent" label={`−${Math.round(fc.honestGrid.savingShare * 100)}%`} />}
        />
        <Kpi icon="doc" label="Document fields confirmed" value={`${ok}/${fields}`} note={`Read by AI from ${docs.length} PDFs, each quote found in the file`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr] [&>*]:min-w-0">
        <Panel title="Mass through the chain" subtitle="Total and recycled tonnes at each stage of the honest chain, read from the ledger." action={<Legend />}>
          <MassFlow />
        </Panel>
        <Panel title="Alerts" subtitle="What the integrity engine and the ledger stopped.">
          <ul className="space-y-4">
            {refusals.map((r) => (
              <li key={r.txHash} className="flex gap-3">
                <StatusIcon status="fail" />
                <div className="min-w-0 text-sm">
                  <div className="font-medium">{cap(r.label)}</div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                    <code className="font-mono text-bad">{r.errorName}</code> · <Hash value={r.txHash} />
                  </div>
                </div>
              </li>
            ))}
            {run.refusals.overclaim.integrity.findings
              .filter((f) => f.severity === "warn")
              .map((f) => (
                <li key={f.code} className="flex gap-3">
                  <StatusIcon status="warn" />
                  <div className="text-sm">
                    <div className="font-medium">Recycled share jump at the spinner</div>
                    <div className="mt-0.5 text-xs text-muted">{f.message}</div>
                  </div>
                </li>
              ))}
          </ul>
          <a href="#/app/spinner" className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
            Open the spinner's workspace →
          </a>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr] [&>*]:min-w-0">
        <Panel title="Ledger activity" subtitle="The latest accepted transactions in this run." bodyClass="p-0">
          <Activity />
        </Panel>
        <Panel title="Carbon by yarn lot" subtitle="kg CO₂e per kg of fiber, carried down the chain by the contract.">
          <div className="space-y-5">
            <Bar label={<span>Gaziantep · 58% recycled · grid</span>} value={fc.honestGrid.actualKgPerKg} max={5} tone="ok" right={`${fc.honestGrid.actualKgPerKg.toFixed(1)} kg`} />
            <Bar label={<span>Kahramanmaraş · 100% recycled · lignite</span>} value={fc.coalPowered.actualKgPerKg} max={5} tone="accent" right={`${fc.coalPowered.actualKgPerKg.toFixed(1)} kg`} />
            <Bar label="Virgin polyester fiber" value={VIRGIN_POLYESTER_FIBER_KG_PER_KG} max={5} tone="muted" right={`${VIRGIN_POLYESTER_FIBER_KG_PER_KG.toFixed(1)} kg`} />
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl bg-accent/[0.07] p-3 text-sm">
            <Badge tone="accent">Insight</Badge>
            <span className="text-ink/80">The 100% recycled lot saves only {Math.round(fc.coalPowered.savingShare * 100)}% against virgin fiber because of its plant's power. Its passport says so.</span>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-4 text-xs text-muted sm:flex">
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-sand" /> Total
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Recycled
      </span>
    </div>
  );
}

const CITY: Partial<Record<Stage, string>> = {
  [Stage.Bale]: "Istanbul",
  [Stage.Flake]: "Adana",
  [Stage.Chip]: "Adana",
  [Stage.Yarn]: "Gaziantep",
  [Stage.Fabric]: "Bursa",
  [Stage.Garment]: "Denizli",
};

const SHORT: Partial<Record<Stage, string>> = {
  [Stage.Bale]: "Bales",
  [Stage.Flake]: "Flake",
  [Stage.Chip]: "Chips sent",
  [Stage.Yarn]: "Yarn",
  [Stage.Fabric]: "Fabric",
  [Stage.Garment]: "Garments",
};

function MassFlow() {
  const L = run.lots;
  const ids = [L.bale, L.flake, L.chipsAtSpinner, L.yarn, L.fabric, L.garment];
  const rows = ids.map((id) => {
    const l = lot(id);
    return { id: id!, stage: Number(l.stage) as Stage, total: kgFromG(l.totalG), recycled: kgFromG(l.recycledG) };
  });
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div>
      <div className="flex h-56 items-end gap-2 sm:gap-5">
        {rows.map((r) => (
          <div key={r.id} className="group flex h-full min-w-0 flex-1 flex-col justify-end">
            <div className="mb-1.5 text-center text-xs font-medium tabular opacity-0 transition-opacity group-hover:opacity-100">{t(r.recycled)}</div>
            <div className="relative w-full rounded-t-xl bg-sand transition-all duration-700" style={{ height: `${(r.total / max) * 100}%` }}>
              <div className="absolute inset-x-0 bottom-0 rounded-t-xl bg-accent" style={{ height: `${(r.recycled / r.total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-2 sm:gap-5">
        {rows.map((r) => (
          <div key={r.id} className="min-w-0 flex-1 text-center">
            <div className="truncate text-xs font-medium">{SHORT[r.stage]}</div>
            <div className="truncate text-[11px] text-muted">{r.id === run.lots.chipsAtSpinner ? "Adana → Gaziantep" : CITY[r.stage]}</div>
            <div className="text-[11px] text-muted tabular">{t(r.total, 0)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Activity() {
  const describe = (name: string | undefined, a: Record<string, unknown>) => {
    if (name === "Transformed") return { title: `${STAGE_NAME[Number(a.stage) as Stage]} produced`, detail: `Lot ${a.lotId} · ${t(kgFromG(a.totalG))} · ${Math.round((Number(a.recycledG) / Number(a.totalG)) * 100)}% recycled` };
    if (name === "Shipped") return { title: `Shipped to ${partyOf(String(a.to))}`, detail: `Lot ${a.fromLotId} → ${a.toLotId} · ${t(kgFromG(a.grams))}` };
    if (name === "PassportMinted") return { title: "Passport issued", detail: `Lot ${a.lotId} · ${Number(a.recycledBps) / 100}% recycled` };
    if (name === "InputRegistered") return { title: "Certified bales registered", detail: `Lot ${a.lotId} · ${t(kgFromG(a.totalG))}` };
    return null;
  };
  const rows = run.chain.events
    .map((e) => ({ e, d: describe(e.eventName, e.args ?? {}) }))
    .filter((x) => x.d)
    .reverse()
    .slice(0, 7);
  return (
    <ul className="divide-y divide-line">
      {rows.map(({ e, d }, i) => (
        <li key={i} className="flex items-center gap-3 px-5 py-3">
          <StatusIcon status="pass" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{cap(d!.title)}</div>
            <div className="truncate text-xs text-muted">{d!.detail}</div>
          </div>
          <div className="shrink-0 text-right">
            <Hash value={e.transactionHash} />
            <div className="text-[11px] text-muted tabular">block {e.blockNumber}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
