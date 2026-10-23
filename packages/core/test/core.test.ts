import { describe, expect, test } from "vitest";
import {
  buildTree,
  certHash,
  checkStep,
  compareWithVirginFiber,
  contractYieldTable,
  demo,
  getProof,
  hiddenCo2eKg,
  processCo2eG,
  robustZ,
  Stage,
  VIRGIN_PET_CHIP_G_PER_KG,
  verifyProof,
  type StepRecord,
} from "../src/index";

const { STEPS, PLANTS } = demo;
const ctx = (plantKey: keyof typeof PLANTS, used: string[] = []) => ({
  plant: PLANTS[plantKey]!,
  usedCertificates: new Set(used),
});

describe("integrity engine", () => {
  test.each([
    ["flake", "recycler"],
    ["chip", "recycler"],
    ["yarn", "spinner"],
    ["fabric", "mill"],
    ["garment", "maker"],
    ["coalYarn", "coalSpinner"],
  ] as const)("honest %s step passes", (step, plant) => {
    const r = checkStep(STEPS[step], ctx(plant));
    expect(r.findings.filter((f) => f.severity === "fail")).toEqual([]);
    expect(r.verdict).toBe("ok");
  });

  test("fraud: 50 t recycled yarn from 30 t recycled chips is caught and explained", () => {
    const r = checkStep(STEPS.yarnFraud, ctx("spinner"));
    expect(r.verdict).toBe("fail");
    const f = r.findings.find((x) => x.code === "RECYCLED_ABOVE_PHYSICAL_MAX")!;
    expect(f.overclaimKg).toBeCloseTo(50_000 - 30_000 * 0.97);
    expect(f.hiddenCo2eKg).toBeCloseTo(hiddenCo2eKg(20_900));
    expect(f.message).toMatch(/at most 29\.1 t/);
    // The plant's recycled share jumps from ~56% to 100%: flagged too.
    expect(r.findings.map((x) => x.code)).toContain("RECYCLED_SHARE_JUMP");
  });

  test("certificate reuse is flagged", () => {
    const r = checkStep(STEPS.yarn, ctx("spinner", [STEPS.yarn.certificateNo]));
    expect(r.findings.map((x) => x.code)).toContain("CERTIFICATE_REUSED");
  });

  test("output dated before its input is flagged", () => {
    const step: StepRecord = { ...STEPS.yarn, producedAt: "2026-09-10T00:00:00Z", startedAt: "2026-09-05T00:00:00Z" };
    expect(checkStep(step, ctx("spinner")).findings.map((x) => x.code)).toContain("PRODUCED_BEFORE_INPUT");
  });

  test("electricity far too low for the output is flagged (meter or paper output)", () => {
    const step: StepRecord = { ...STEPS.yarn, electricityKwh: 20_000 };
    expect(checkStep(step, ctx("spinner")).findings.map((x) => x.code)).toContain("ENERGY_TOO_LOW");
  });

  test("more output than the plant can make in the run time is flagged", () => {
    const step: StepRecord = { ...STEPS.yarn, startedAt: "2026-09-24T18:00:00Z" };
    expect(checkStep(step, ctx("spinner")).findings.map((x) => x.code)).toContain("ABOVE_PLANT_CAPACITY");
  });

  test("mass from nowhere is flagged", () => {
    const step: StepRecord = { ...STEPS.yarn, virginKg: 0, outputRecycledKg: 20_000 };
    expect(checkStep(step, ctx("spinner")).findings.map((x) => x.code)).toContain("MASS_ABOVE_PHYSICAL_MAX");
  });

  test("robust z ignores one outlier in history", () => {
    expect(robustZ(0.57, [0.55, 0.58, 0.52, 0.6, 0.57, 0.99])).toBeLessThan(1);
  });
});

describe("carbon", () => {
  const pc = (s: StepRecord, grid?: number) => processCo2eG(s.electricityKwh, s.heatMJ, grid);
  const chipG = demo.BALE_INPUT.embeddedCo2eG + pc(STEPS.flake) + pc(STEPS.chip);
  const coalChipG = demo.BALE_INPUT_2.embeddedCo2eG + pc(STEPS.coalFlake) + pc(STEPS.coalChip);

  test("Türkiye grid factor is applied to electricity and IPCC factor to gas", () => {
    expect(processCo2eG(1000, 0)).toBe(442_000);
    expect(processCo2eG(0, 1000)).toBe(56_100);
  });

  test("honest mixed yarn is well below virgin polyester", () => {
    const yarnG = (chipG * 30_000) / 54_000 + STEPS.yarn.virginKg * VIRGIN_PET_CHIP_G_PER_KG + pc(STEPS.yarn);
    const c = compareWithVirginFiber(yarnG / 1000 / STEPS.yarn.outputKg);
    expect(c.actualKgPerKg).toBeCloseTo(2.69, 1);
    expect(c.label).toBe("low-carbon");
  });

  test("100% recycled yarn on lignite power is labelled recycled-but-not-low-carbon", () => {
    const yarnG = (coalChipG * 20_000) / 27_000 + pc(STEPS.coalYarn, PLANTS.coalSpinner!.gridGPerKwh);
    const c = compareWithVirginFiber(yarnG / 1000 / STEPS.coalYarn.outputKg);
    expect(c.actualKgPerKg).toBeGreaterThan(4);
    expect(c.label).toBe("recycled-but-not-low-carbon");
    expect(c.sentence).toMatch(/saves little carbon/);
  });
});

describe("evidence merkle tree", () => {
  const items = [
    { kind: "transaction-certificate", no: "TC-2026-ADN-0042", sha256: "aa" },
    { kind: "invoice", no: "INV-881", sha256: "bb" },
    { kind: "meter", period: "2026-09", kwh: 110_000 },
    { kind: "weighbridge", ticket: "WB-12", kg: 30_000 },
    { kind: "certifier-approval", sig: "ml-dsa-44:..." },
  ];
  const tree = buildTree(items);

  test("every item verifies against the root", () => {
    items.forEach((it, i) => expect(verifyProof(it, getProof(tree, i), tree.root)).toBe(true));
  });

  test("an edited item fails", () => {
    expect(verifyProof({ ...items[2]!, kwh: 70_000 }, getProof(tree, 2), tree.root)).toBe(false);
  });

  test("key order does not change the hash", () => {
    expect(buildTree([{ b: 1, a: 2 }]).root).toBe(buildTree([{ a: 2, b: 1 }]).root);
  });

  test("certificate hashes ignore case and spaces", () => {
    expect(certHash(" tc-2026-adn-0042 ")).toBe(certHash("TC-2026-ADN-0042"));
  });
});

test("contract yield table matches the values used in the Solidity tests", () => {
  const t = Object.fromEntries(contractYieldTable().map((r) => [`${r.from}-${r.to}`, r.bps]));
  expect(t[`${Stage.Bale}-${Stage.Flake}`]).toBe(7500);
  expect(t[`${Stage.Flake}-${Stage.Chip}`]).toBe(9700);
  expect(t[`${Stage.Chip}-${Stage.Yarn}`]).toBe(9700);
  expect(t[`${Stage.Yarn}-${Stage.Fabric}`]).toBe(9200);
  expect(t[`${Stage.Fabric}-${Stage.Garment}`]).toBe(8500);
});
