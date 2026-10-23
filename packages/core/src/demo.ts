import { BALE_COLLECTION_G_PER_KG } from "./factors";
import { Role, Stage, type Plant, type StepRecord } from "./types";

/**
 * Demo supply chain. Companies are fictional and named only by role and city; cities, factors
 * and yields are real. Quantities are in kg.
 *
 * Istanbul bottle bales -> Adana recycler -> Gaziantep spinner -> Bursa fabric mill
 * -> Denizli garment maker -> Amsterdam brand.
 */

const history = (shares: number[], kwh: number, yld: number) =>
  shares.map((s, i) => ({ period: `2026-0${i + 1}-01`, recycledShare: s, kwhPerKg: kwh, yield: yld }));

export const PLANTS: Record<string, Plant> = {
  recycler: {
    id: "recycler-adana",
    name: "Recycler · Adana",
    city: "Adana",
    role: Role.Recycler,
    capacityKgPerDay: 15_000,
    history: history([1, 1, 1, 1, 1, 1], 0.55, 0.7),
  },
  spinner: {
    id: "spinner-gaziantep",
    name: "Spinner · Gaziantep",
    city: "Gaziantep",
    role: Role.Spinner,
    capacityKgPerDay: 12_000,
    history: history([0.55, 0.58, 0.52, 0.6, 0.57, 0.56], 2.2, 0.96),
  },
  coalSpinner: {
    id: "spinner-kahramanmaras",
    name: "Spinner · Kahramanmaraş (captive lignite power)",
    city: "Kahramanmaraş",
    role: Role.Spinner,
    capacityKgPerDay: 10_000,
    gridGPerKwh: 1_050, // on-site lignite plant instead of the grid
    history: history([0.95, 1, 1, 0.98, 1, 1], 3.1, 0.95),
  },
  mill: {
    id: "fabric-mill-bursa",
    name: "Fabric mill · Bursa",
    city: "Bursa",
    role: Role.FabricMill,
    capacityKgPerDay: 8_000,
    history: history([0.5, 0.55, 0.57, 0.52, 0.56, 0.58], 2.0, 0.9),
  },
  maker: {
    id: "garment-maker-denizli",
    name: "Garment maker · Denizli",
    city: "Denizli",
    role: Role.GarmentMaker,
    capacityKgPerDay: 6_000,
    history: history([0.5, 0.55, 0.57, 0.52, 0.56, 0.58], 0.9, 0.83),
  },
  brand: {
    id: "brand-amsterdam",
    name: "Brand · Amsterdam",
    city: "Amsterdam",
    role: Role.Brand,
    capacityKgPerDay: 0,
    history: [],
  },
};

/** Certified bottle bales registered by the certifier for the Adana recycler. */
export const BALE_INPUT = {
  certificateNo: "TC-2026-IST-0117",
  kg: 80_000,
  embeddedCo2eG: 80_000 * BALE_COLLECTION_G_PER_KG,
  producedAt: "2026-09-01T08:00:00Z",
};

/** A second certified bale lot, feeding the coal-powered spinner in the carbon comparison. */
export const BALE_INPUT_2 = {
  certificateNo: "TC-2026-IST-0129",
  kg: 40_000,
  embeddedCo2eG: 40_000 * BALE_COLLECTION_G_PER_KG,
  producedAt: "2026-09-02T08:00:00Z",
};

export const STEPS = {
  flake: {
    id: "SC-ADN-FLAKE-0910",
    plantId: "recycler-adana",
    from: Stage.Bale,
    to: Stage.Flake,
    inputs: [{ lotRef: "TC-2026-IST-0117", kg: 80_000, recycledKg: 80_000, producedAt: "2026-09-01T08:00:00Z" }],
    virginKg: 0,
    outputKg: 56_000,
    outputRecycledKg: 56_000,
    electricityKwh: 30_800, // 0.55 kWh/kg
    heatMJ: 112_000, // 2 MJ/kg hot wash
    startedAt: "2026-09-03T06:00:00Z",
    producedAt: "2026-09-08T18:00:00Z",
    certificateNo: "SC-ADN-FLAKE-0910",
  },
  chip: {
    id: "SC-ADN-CHIP-0915",
    plantId: "recycler-adana",
    from: Stage.Flake,
    to: Stage.Chip,
    inputs: [{ lotRef: "SC-ADN-FLAKE-0910", kg: 56_000, recycledKg: 56_000, producedAt: "2026-09-08T18:00:00Z" }],
    virginKg: 0,
    outputKg: 54_000,
    outputRecycledKg: 54_000,
    electricityKwh: 37_800, // 0.7 kWh/kg extrusion + solid-state polycondensation
    heatMJ: 16_200,
    startedAt: "2026-09-10T06:00:00Z",
    producedAt: "2026-09-15T18:00:00Z",
    certificateNo: "SC-ADN-CHIP-0915",
  },
  /** Honest: 30 t certified recycled chips + 22 t virgin chips -> 50 t yarn, 28.8 t recycled (57.6%). */
  yarn: {
    id: "SC-GZT-YARN-0925",
    plantId: "spinner-gaziantep",
    from: Stage.Chip,
    to: Stage.Yarn,
    inputs: [{ lotRef: "TC-2026-ADN-0042", kg: 30_000, recycledKg: 30_000, producedAt: "2026-09-15T18:00:00Z" }],
    virginKg: 22_000,
    outputKg: 50_000,
    outputRecycledKg: 28_800,
    electricityKwh: 110_000, // 2.2 kWh/kg melt spinning + texturing
    heatMJ: 25_000,
    startedAt: "2026-09-20T06:00:00Z",
    producedAt: "2026-09-25T18:00:00Z",
    certificateNo: "SC-GZT-YARN-0925",
  },
  fabric: {
    id: "SC-BRS-FAB-1005",
    plantId: "fabric-mill-bursa",
    from: Stage.Yarn,
    to: Stage.Fabric,
    inputs: [{ lotRef: "TC-2026-GZT-0311", kg: 50_000, recycledKg: 28_800, producedAt: "2026-09-25T18:00:00Z" }],
    virginKg: 0,
    outputKg: 46_000,
    outputRecycledKg: 26_400,
    electricityKwh: 92_000, // 2 kWh/kg knitting + finishing
    heatMJ: 1_610_000, // 35 MJ/kg dyeing
    startedAt: "2026-09-27T06:00:00Z",
    producedAt: "2026-10-05T18:00:00Z",
    certificateNo: "SC-BRS-FAB-1005",
  },
  garment: {
    id: "SC-DNZ-GAR-1014",
    plantId: "garment-maker-denizli",
    from: Stage.Fabric,
    to: Stage.Garment,
    inputs: [{ lotRef: "TC-2026-BRS-0508", kg: 46_000, recycledKg: 26_400, producedAt: "2026-10-05T18:00:00Z" }],
    virginKg: 0,
    outputKg: 39_000,
    outputRecycledKg: 22_400,
    electricityKwh: 35_100, // 0.9 kWh/kg cutting and sewing
    heatMJ: 39_000,
    startedAt: "2026-10-07T06:00:00Z",
    producedAt: "2026-10-14T18:00:00Z",
    certificateNo: "SC-DNZ-GAR-1014",
  },
  /** Fraud: same inputs as the honest yarn step, but all 50 t claimed as recycled. */
  yarnFraud: {
    id: "SC-GZT-YARN-0926-X",
    plantId: "spinner-gaziantep",
    from: Stage.Chip,
    to: Stage.Yarn,
    inputs: [{ lotRef: "TC-2026-ADN-0042", kg: 30_000, recycledKg: 30_000, producedAt: "2026-09-15T18:00:00Z" }],
    virginKg: 22_000,
    outputKg: 50_000,
    outputRecycledKg: 50_000,
    electricityKwh: 110_000,
    heatMJ: 25_000,
    startedAt: "2026-09-20T06:00:00Z",
    producedAt: "2026-09-25T18:00:00Z",
    certificateNo: "SC-GZT-YARN-0926-X",
  },
  /** Carbon comparison: 100% recycled yarn from a plant on its own lignite power. */
  coalFlake: {
    id: "SC-ADN-FLAKE-0912",
    plantId: "recycler-adana",
    from: Stage.Bale,
    to: Stage.Flake,
    inputs: [{ lotRef: "TC-2026-IST-0129", kg: 40_000, recycledKg: 40_000, producedAt: "2026-09-02T08:00:00Z" }],
    virginKg: 0,
    outputKg: 28_000,
    outputRecycledKg: 28_000,
    electricityKwh: 15_400,
    heatMJ: 56_000,
    startedAt: "2026-09-04T06:00:00Z",
    producedAt: "2026-09-09T18:00:00Z",
    certificateNo: "SC-ADN-FLAKE-0912",
  },
  coalChip: {
    id: "SC-ADN-CHIP-0916",
    plantId: "recycler-adana",
    from: Stage.Flake,
    to: Stage.Chip,
    inputs: [{ lotRef: "SC-ADN-FLAKE-0912", kg: 28_000, recycledKg: 28_000, producedAt: "2026-09-09T18:00:00Z" }],
    virginKg: 0,
    outputKg: 27_000,
    outputRecycledKg: 27_000,
    electricityKwh: 18_900,
    heatMJ: 8_100,
    startedAt: "2026-09-11T06:00:00Z",
    producedAt: "2026-09-16T18:00:00Z",
    certificateNo: "SC-ADN-CHIP-0916",
  },
  coalYarn: {
    id: "SC-KHM-YARN-0927",
    plantId: "spinner-kahramanmaras",
    from: Stage.Chip,
    to: Stage.Yarn,
    inputs: [{ lotRef: "TC-2026-ADN-0051", kg: 20_000, recycledKg: 20_000, producedAt: "2026-09-16T18:00:00Z" }],
    virginKg: 0,
    outputKg: 19_200,
    outputRecycledKg: 19_200,
    electricityKwh: 61_440, // 3.2 kWh/kg, older line
    heatMJ: 9_600,
    startedAt: "2026-09-22T06:00:00Z",
    producedAt: "2026-09-27T18:00:00Z",
    certificateNo: "SC-KHM-YARN-0927",
  },
} satisfies Record<string, StepRecord>;

/** Shipment certificates (one per shipment). TC-2026-ADN-0042 is the one the recycler tries to reuse. */
export const SHIPMENTS = {
  chipsToSpinner: { certificateNo: "TC-2026-ADN-0042", kg: 30_000, at: "2026-09-18T10:00:00Z" },
  chipsReused: { certificateNo: "TC-2026-ADN-0042", kg: 20_000, at: "2026-09-19T10:00:00Z" },
  chipsToCoalSpinner: { certificateNo: "TC-2026-ADN-0051", kg: 20_000, at: "2026-09-19T12:00:00Z" },
  yarnToMill: { certificateNo: "TC-2026-GZT-0311", kg: 50_000, at: "2026-09-26T10:00:00Z" },
  fabricToMaker: { certificateNo: "TC-2026-BRS-0508", kg: 46_000, at: "2026-10-06T10:00:00Z" },
  garmentsToBrand: { certificateNo: "TC-2026-DNZ-0712", kg: 39_000, at: "2026-10-18T10:00:00Z" },
};

/** The label the brand wants to print, before the claim checker rewrites it. */
export const BRAND_DRAFT_CLAIM = "Eco-friendly jacket made from 100% recycled materials. Kind to the planet.";
