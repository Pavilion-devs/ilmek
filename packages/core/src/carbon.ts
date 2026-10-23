import {
  NATURAL_GAS_G_PER_MJ,
  RECYCLED_POLYESTER_FIBER_KG_PER_KG,
  TR_GRID_G_PER_KWH,
  VIRGIN_POLYESTER_FIBER_KG_PER_KG,
} from "./factors";

/** Emissions of one processing step, in grams CO2e. */
export function processCo2eG(electricityKwh: number, heatMJ: number, gridGPerKwh = TR_GRID_G_PER_KWH): number {
  return Math.round(electricityKwh * gridGPerKwh + heatMJ * NATURAL_GAS_G_PER_MJ);
}

/** kg CO2e per kg of product, from contract values (grams / grams). */
export function intensityKgPerKg(embeddedCo2eG: number | bigint, totalG: number | bigint): number {
  const e = Number(embeddedCo2eG);
  const t = Number(totalG);
  return t === 0 ? 0 : e / t;
}

export type CarbonLabel = "low-carbon" | "modest-saving" | "recycled-but-not-low-carbon";

export interface FiberComparison {
  actualKgPerKg: number;
  virginKgPerKg: number;
  savingKgPerKg: number;
  savingShare: number; // 0..1, can be negative
  label: CarbonLabel;
  /** Plain-language line for the passport */
  sentence: string;
}

/**
 * Compares a yarn lot's measured intensity with all-virgin polyester fiber.
 * Recycled content alone does not make a lot low-carbon; this says how much it actually saves.
 */
export function compareWithVirginFiber(actualKgPerKg: number, virginKgPerKg = VIRGIN_POLYESTER_FIBER_KG_PER_KG): FiberComparison {
  const saving = virginKgPerKg - actualKgPerKg;
  const share = saving / virginKgPerKg;
  const label: CarbonLabel = share >= 0.3 ? "low-carbon" : share >= 0.15 ? "modest-saving" : "recycled-but-not-low-carbon";
  const fmt = (x: number) => x.toFixed(1);
  const sentence =
    label === "recycled-but-not-low-carbon"
      ? `${fmt(actualKgPerKg)} kg CO₂e per kg of fiber, close to virgin polyester (${fmt(virginKgPerKg)}). Recycled content here saves little carbon, mostly because of how the plant is powered.`
      : `${fmt(actualKgPerKg)} kg CO₂e per kg of fiber, ${Math.round(share * 100)}% below virgin polyester (${fmt(virginKgPerKg)}).`;
  return { actualKgPerKg, virginKgPerKg, savingKgPerKg: saving, savingShare: share, label, sentence };
}

/**
 * CO2e hidden when virgin fiber is sold as recycled: the buyer believes each kg carries the
 * recycled footprint, but it actually carries the virgin one.
 */
export function hiddenCo2eKg(overclaimKg: number): number {
  return overclaimKg * (VIRGIN_POLYESTER_FIBER_KG_PER_KG - RECYCLED_POLYESTER_FIBER_KG_PER_KG);
}
