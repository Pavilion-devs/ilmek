import { Stage } from "./types";

/**
 * Factors used by Ilmek. Sources are listed in docs/SOURCES.md; the short tag in each
 * comment points to the entry there. Ranges marked "indicative" are starting values for
 * plausibility checks and should be tuned per plant.
 */

/** Türkiye grid, g CO2e per kWh. Ministry of Energy and Natural Resources, 2022 (0.442 tCO2e/MWh). [TR-GRID] */
export const TR_GRID_G_PER_KWH = 442;

/** Natural gas combustion, g CO2 per MJ (IPCC 2006 default, 56,100 kg/TJ). [IPCC-NG] */
export const NATURAL_GAS_G_PER_MJ = 56.1;

/** Virgin polyester yarn / staple fiber, cradle to gate, kg CO2e per kg (midpoint of 3.96–4.76). [TE-LCA] */
export const VIRGIN_POLYESTER_FIBER_KG_PER_KG = 4.36;

/** Mechanically recycled polyester staple fiber, cradle to gate, kg CO2e per kg. [TE-LCA] */
export const RECYCLED_POLYESTER_FIBER_KG_PER_KG = 3.04;

/** Virgin PET chip added at the spinning step, g CO2e per kg (indicative, PET resin ~2.2–3.0). [PET-RESIN] */
export const VIRGIN_PET_CHIP_G_PER_KG = 2700;

/** Collection and sorting of bottle bales, g CO2e per kg (indicative). */
export const BALE_COLLECTION_G_PER_KG = 100;

export interface StepFactor {
  /** Upper bound written into the contract: no step may beat this yield. */
  maxYield: number;
  /** Typical yield range; outside it the integrity engine warns. [YIELD] */
  typicalYield: [number, number];
  /** Typical electricity use, kWh per kg of output (indicative). */
  kwhPerKg: [number, number];
  /** Typical heat use, MJ per kg of output (indicative). */
  heatMJPerKg: [number, number];
}

const key = (from: Stage, to: Stage) => `${from}->${to}`;

export const STEP_FACTORS: Record<string, StepFactor> = {
  // Bale-to-flake yields of 60–75% are reported by reclaimers and Plastics Recyclers Europe. [YIELD]
  [key(Stage.Bale, Stage.Flake)]: { maxYield: 0.75, typicalYield: [0.6, 0.75], kwhPerKg: [0.25, 0.7], heatMJPerKg: [0.5, 3] },
  [key(Stage.Flake, Stage.Chip)]: { maxYield: 0.97, typicalYield: [0.92, 0.97], kwhPerKg: [0.35, 0.9], heatMJPerKg: [0, 1] },
  [key(Stage.Chip, Stage.Yarn)]: { maxYield: 0.97, typicalYield: [0.9, 0.97], kwhPerKg: [1.2, 3.5], heatMJPerKg: [0, 2] },
  [key(Stage.Yarn, Stage.Fabric)]: { maxYield: 0.92, typicalYield: [0.82, 0.92], kwhPerKg: [1.0, 3.5], heatMJPerKg: [15, 60] },
  [key(Stage.Fabric, Stage.Garment)]: { maxYield: 0.85, typicalYield: [0.7, 0.85], kwhPerKg: [0.4, 1.8], heatMJPerKg: [0, 5] },
};

export function stepFactor(from: Stage, to: Stage): StepFactor | undefined {
  return STEP_FACTORS[key(from, to)];
}

/** Contract configuration derived from the table above (basis points). */
export function contractYieldTable(): { from: Stage; to: Stage; bps: number }[] {
  return Object.entries(STEP_FACTORS).map(([k, f]) => {
    const [from, to] = k.split("->").map(Number) as [Stage, Stage];
    return { from, to, bps: Math.round(f.maxYield * 10000) };
  });
}
