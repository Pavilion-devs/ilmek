import { STAGE_NAME, Stage } from "@ilmek/core";
import { JourneyStrip } from "../components/Journey";
import { Badge, Panel } from "../components/ui";
import { kgFromG, run, t } from "../run";
import { partyOf } from "./parties";

export function Chain() {
  const inputs = new Set(run.chain.events.filter((e) => e.eventName === "InputRegistered").map((e) => String(e.args?.lotId)));
  const passportLot = String(run.passport.lotId);
  const lots = Object.entries(run.chain.lots).map(([id, l]) => {
    const kind = inputs.has(id) ? "Certified input" : run.evidenceOfLot[id] ? "Processing step" : "Shipment";
    const total = kgFromG(l.totalG);
    const recycled = kgFromG(l.recycledG);
    return {
      id,
      stage: Number(l.stage) as Stage,
      owner: partyOf(String(l.owner)),
      total,
      recycled,
      remaining: kgFromG(l.remainingG),
      co2: Number(l.embeddedCo2eG) / Number(l.totalG),
      kind,
      parents: l.parents.map(String),
      revoked: Boolean(l.revoked),
    };
  });

  return (
    <div className="space-y-6">
      <Panel title="The route" subtitle="Istanbul bottle bales to an Amsterdam shop, as recorded on the ledger.">
        <JourneyStrip />
      </Panel>

      <Panel title={`All ${lots.length} lots`} subtitle="Every lot in this run, including the second chain that feeds the lignite-powered spinner." bodyClass="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-muted">
                <th className="px-5 py-3 font-medium">Lot</th>
                <th className="px-3 py-3 font-medium">Material</th>
                <th className="px-3 py-3 font-medium">Held by</th>
                <th className="px-3 py-3 font-medium">Type</th>
                <th className="px-3 py-3 text-right font-medium">Mass</th>
                <th className="px-3 py-3 font-medium">Recycled</th>
                <th className="px-3 py-3 text-right font-medium">CO₂e / kg</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular">
              {lots.map((l) => (
                <tr key={l.id} className={`transition-colors hover:bg-paper ${l.id === passportLot ? "bg-ok/[0.04]" : ""}`}>
                  <td className="px-5 py-3">
                    <div className="font-mono text-xs">#{l.id}</div>
                    {l.parents.length > 0 && <div className="text-[11px] text-muted">from #{l.parents.join(", #")}</div>}
                  </td>
                  <td className="px-3 py-3">{STAGE_NAME[l.stage].charAt(0).toUpperCase() + STAGE_NAME[l.stage].slice(1)}</td>
                  <td className="px-3 py-3">{l.owner}</td>
                  <td className="px-3 py-3 text-muted">{l.kind}</td>
                  <td className="px-3 py-3 text-right">
                    {t(l.total)}
                    {l.remaining < l.total && <div className="text-[11px] text-muted">{t(l.remaining)} left</div>}
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-ink/[0.06]">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(l.recycled / l.total) * 100}%` }} />
                      </div>
                      <span className="text-xs">{Math.round((l.recycled / l.total) * 100)}%</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right">{l.co2.toFixed(2)}</td>
                  <td className="px-5 py-3 text-right">
                    {l.revoked ? <Badge tone="bad">Frozen</Badge> : l.id === passportLot ? <Badge tone="ok">Passport</Badge> : l.remaining === 0 ? <Badge>Used</Badge> : <Badge tone="brand">Available</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
