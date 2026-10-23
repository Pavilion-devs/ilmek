/** The contract stores grams as integers. These helpers keep the conversion in one place. */
export const kgToG = (kg: number): bigint => BigInt(Math.round(kg * 1000));
export const gToKg = (g: bigint | number): number => Number(g) / 1000;
export const isoToUnix = (iso: string): bigint => BigInt(Math.floor(Date.parse(iso) / 1000));
