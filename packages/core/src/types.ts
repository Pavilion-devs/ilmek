/** Mirrors FiberLedger.Stage. Keep the numeric values in sync with the contract. */
export enum Stage {
  None = 0,
  Bale = 1,
  Flake = 2,
  Chip = 3,
  Yarn = 4,
  Fabric = 5,
  Garment = 6,
}

/** Mirrors FiberLedger.Role. */
export enum Role {
  None = 0,
  Recycler = 1,
  Spinner = 2,
  FabricMill = 3,
  GarmentMaker = 4,
  Brand = 5,
}

export const STAGE_NAME: Record<Stage, string> = {
  [Stage.None]: "none",
  [Stage.Bale]: "PET bottle bales",
  [Stage.Flake]: "washed PET flake",
  [Stage.Chip]: "recycled PET chip",
  [Stage.Yarn]: "polyester yarn",
  [Stage.Fabric]: "fabric",
  [Stage.Garment]: "garments",
};

/** A plant's own past steps, used to spot sudden changes. */
export interface PlantHistoryPoint {
  /** ISO date of the reporting period */
  period: string;
  recycledShare: number; // 0..1
  kwhPerKg: number;
  yield: number; // 0..1
}

export interface Plant {
  id: string;
  /** Fictional company name, shown only to permitted viewers */
  name: string;
  city: string;
  role: Role;
  capacityKgPerDay: number;
  /** Electricity emission factor the plant actually uses, g CO2e/kWh. Defaults to the Türkiye grid. */
  gridGPerKwh?: number;
  history: PlantHistoryPoint[];
}

export interface StepInput {
  /** Off-chain reference to the input lot, e.g. a lot ID or certificate number */
  lotRef: string;
  kg: number;
  recycledKg: number;
  /** ISO date the input lot was produced */
  producedAt: string;
}

/** One processing step as described by the documents a party uploads. */
export interface StepRecord {
  id: string;
  plantId: string;
  from: Stage;
  to: Stage;
  inputs: StepInput[];
  virginKg: number;
  outputKg: number;
  outputRecycledKg: number;
  electricityKwh: number;
  /** Fuel for heat (natural gas), in MJ */
  heatMJ: number;
  /** ISO dates the run started and ended */
  startedAt: string;
  producedAt: string;
  certificateNo: string;
}

export type Severity = "ok" | "warn" | "fail";

export interface Finding {
  code:
    | "RECYCLED_ABOVE_PHYSICAL_MAX"
    | "MASS_ABOVE_PHYSICAL_MAX"
    | "YIELD_UNUSUAL"
    | "ENERGY_TOO_LOW"
    | "ENERGY_TOO_HIGH"
    | "PRODUCED_BEFORE_INPUT"
    | "ABOVE_PLANT_CAPACITY"
    | "CERTIFICATE_REUSED"
    | "RECYCLED_SHARE_JUMP";
  severity: Exclude<Severity, "ok">;
  /** One or two plain-language sentences a certifier can act on */
  message: string;
  /** For over-claims: recycled kg that the inputs cannot account for */
  overclaimKg?: number;
  /** For over-claims: CO2e hidden by labelling virgin fiber as recycled, kg */
  hiddenCo2eKg?: number;
}

export interface IntegrityReport {
  stepId: string;
  verdict: Severity;
  findings: Finding[];
}
