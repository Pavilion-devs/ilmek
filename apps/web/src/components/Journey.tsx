import { STAGE_NAME, Stage } from "@ilmek/core";
import { kgFromG, plantById, run, t } from "../run";

/** The demo chain, city by city, from lots on the ledger. */
export interface Hop {
  city: string;
  role: string;
  stage: Stage;
  kg: number;
  recycledKg: number;
  lotId: string;
}

const lot = (id: string) => run.chain.lots[id]!;

export function hops(): Hop[] {
  const L = run.lots;
  const mk = (id: string, city: string, role: string): Hop => ({
    city,
    role,
    lotId: id,
    stage: Number(lot(id).stage) as Stage,
    kg: kgFromG(lot(id).totalG),
    recycledKg: kgFromG(lot(id).recycledG),
  });
  return [
    mk(L.bale!, "Istanbul", "Bottle bales collected"),
    mk(L.chip!, plantById("recycler-adana")!.city, "Washed, flaked, re-pelletised"),
    mk(L.yarn!, plantById("spinner-gaziantep")!.city, "Spun into yarn"),
    mk(L.fabric!, plantById("fabric-mill-bursa")!.city, "Knitted and dyed"),
    mk(L.garment!, plantById("garment-maker-denizli")!.city, "Cut and sewn"),
    mk(L.garmentAtBrand!, plantById("brand-amsterdam")!.city, "Passport issued"),
  ];
}

/** Horizontal stepper on wide screens, vertical list on phones. */
export function JourneyStrip() {
  const h = hops();
  return (
    <ol className="relative grid gap-4 sm:grid-cols-3 lg:grid-cols-6">
      <span className="absolute left-0 right-0 top-[18px] hidden h-px bg-line lg:block" aria-hidden="true" />
      {h.map((x, i) => (
        <li key={x.lotId} className="relative">
          <div className="flex items-center gap-3 lg:block">
            <span className="relative z-10 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line bg-card text-xs font-semibold text-accent shadow-soft">
              {i + 1}
            </span>
            <div className="lg:mt-3">
              <div className="font-semibold">{x.city}</div>
              <div className="text-xs text-muted">{x.role}</div>
            </div>
          </div>
          <div className="mt-2 pl-12 text-sm tabular lg:pl-0">
            {t(x.kg)} {STAGE_NAME[x.stage].replace("PET bottle bales", "bales").replace("recycled PET chip", "rPET chip").replace("polyester yarn", "yarn")}
            <div className="text-xs text-muted">{x.recycledKg === x.kg ? "100% recycled" : `${Math.round((x.recycledKg / x.kg) * 100)}% recycled`}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}
