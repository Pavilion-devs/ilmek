import { hiddenCo2eKg } from "./carbon";
import { stepFactor } from "./factors";
import { STAGE_NAME, type Finding, type IntegrityReport, type Plant, type StepRecord } from "./types";

const t = (kg: number) => `${(kg / 1000).toLocaleString("en-GB", { maximumFractionDigits: 1 })} t`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export interface IntegrityContext {
  plant: Plant;
  /** Certificate numbers already used anywhere on the ledger */
  usedCertificates: ReadonlySet<string>;
}

/**
 * Checks one step before a certifier signs it. The checks mirror the contract's hard limits
 * (so a certifier sees a refusal coming) and add softer checks the contract cannot do.
 * Nothing here decides: it explains, and the certifier decides.
 */
export function checkStep(step: StepRecord, ctx: IntegrityContext): IntegrityReport {
  const findings: Finding[] = [];
  const f = stepFactor(step.from, step.to);
  const inKg = sum(step.inputs.map((i) => i.kg));
  const recycledInKg = sum(step.inputs.map((i) => i.recycledKg));
  const what = STAGE_NAME[step.to];

  if (f) {
    // 1. Recycled content cannot appear from nowhere.
    const maxRecycled = recycledInKg * f.maxYield;
    if (step.outputRecycledKg > maxRecycled + 1e-6) {
      const over = step.outputRecycledKg - maxRecycled;
      findings.push({
        code: "RECYCLED_ABOVE_PHYSICAL_MAX",
        severity: "fail",
        message: `Claims ${t(step.outputRecycledKg)} of recycled ${what}, but the certified recycled inputs (${t(recycledInKg)}) can give at most ${t(maxRecycled)}, even at the best realistic yield. About ${t(over)} would have to be virgin material labelled as recycled.`,
        overclaimKg: over,
        hiddenCo2eKg: hiddenCo2eKg(over),
      });
    }

    // 2. Total mass cannot exceed inputs plus declared virgin material.
    const maxTotal = (inKg + step.virginKg) * f.maxYield;
    if (step.outputKg > maxTotal + 1e-6) {
      findings.push({
        code: "MASS_ABOVE_PHYSICAL_MAX",
        severity: "fail",
        message: `Reports ${t(step.outputKg)} of output from ${t(inKg + step.virginKg)} of input. The most this step can physically produce is ${t(maxTotal)}. Some input is missing from the documents.`,
      });
    }

    // 3. Yield outside the normal range (but within physics) is worth a look.
    const yld = step.outputKg / (inKg + step.virginKg || 1);
    if (yld <= f.maxYield && (yld < f.typicalYield[0] || yld > f.typicalYield[1])) {
      findings.push({
        code: "YIELD_UNUSUAL",
        severity: "warn",
        message: `Yield of ${pct(yld)} is outside the usual ${pct(f.typicalYield[0])}–${pct(f.typicalYield[1])} for this step. Check the weighbridge tickets.`,
      });
    }

    // 4. Energy per kg: too little means output was probably not made here; too much inflates carbon.
    const kwhPerKg = step.electricityKwh / (step.outputKg || 1);
    if (kwhPerKg < f.kwhPerKg[0] * 0.6) {
      findings.push({
        code: "ENERGY_TOO_LOW",
        severity: "fail",
        message: `Only ${kwhPerKg.toFixed(2)} kWh of electricity per kg of ${what}; this step normally needs at least ${f.kwhPerKg[0]} kWh/kg. Either the meter under-reports or the output was not made in this run.`,
      });
    } else if (kwhPerKg > f.kwhPerKg[1] * 1.5) {
      findings.push({
        code: "ENERGY_TOO_HIGH",
        severity: "warn",
        message: `${kwhPerKg.toFixed(2)} kWh per kg is well above the usual ${f.kwhPerKg[1]} kWh/kg. Check for a metering error before this carbon figure goes on a passport.`,
      });
    }
  }

  // 5. Time order: an output cannot exist before its inputs.
  const produced = Date.parse(step.producedAt);
  for (const i of step.inputs) {
    if (Date.parse(i.producedAt) > produced) {
      findings.push({
        code: "PRODUCED_BEFORE_INPUT",
        severity: "fail",
        message: `Output dated ${step.producedAt.slice(0, 10)}, but input ${i.lotRef} was only produced on ${i.producedAt.slice(0, 10)}.`,
      });
    }
  }

  // 6. Capacity: more output than the plant can make in the run time.
  const days = Math.max((produced - Date.parse(step.startedAt)) / 86_400_000, 1 / 24);
  const maxByCapacity = ctx.plant.capacityKgPerDay * days;
  if (step.outputKg > maxByCapacity * 1.05) {
    findings.push({
      code: "ABOVE_PLANT_CAPACITY",
      severity: "fail",
      message: `${t(step.outputKg)} in ${days.toFixed(1)} days is more than ${ctx.plant.name}'s capacity of ${t(ctx.plant.capacityKgPerDay)} per day allows (${t(maxByCapacity)}).`,
    });
  }

  // 7. Certificate reuse.
  if (ctx.usedCertificates.has(step.certificateNo)) {
    findings.push({
      code: "CERTIFICATE_REUSED",
      severity: "fail",
      message: `Certificate ${step.certificateNo} has already been used for another lot. One certificate can back only one lot.`,
    });
  }

  // 8. Sudden jump in recycled share compared with the plant's own history (robust z-score).
  const share = step.outputRecycledKg / (step.outputKg || 1);
  const past = ctx.plant.history.map((h) => h.recycledShare);
  if (past.length >= 4) {
    const z = robustZ(share, past);
    if (z > 3.5) {
      findings.push({
        code: "RECYCLED_SHARE_JUMP",
        severity: "warn",
        message: `Recycled share of ${pct(share)} is far above this plant's usual ${pct(median(past))} (robust z = ${z.toFixed(1)}). Ask what changed in its supply.`,
      });
    }
  }

  const verdict = findings.some((x) => x.severity === "fail") ? "fail" : findings.length ? "warn" : "ok";
  return { stepId: step.id, verdict, findings };
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}

/** Robust z-score using the median absolute deviation (scaled to match a standard deviation). */
export function robustZ(x: number, xs: number[]): number {
  const med = median(xs);
  const mad = median(xs.map((v) => Math.abs(v - med))) * 1.4826;
  return mad === 0 ? (x === med ? 0 : Infinity) : (x - med) / mad;
}
