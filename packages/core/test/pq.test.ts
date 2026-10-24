import { describe, expect, test } from "vitest";
import { keccak256, toBytes } from "viem";
import { demoPqKeys, pqPubKeyHash, pqSignRoot, pqVerifyRoot } from "../src/index";

describe("ML-DSA-44 certifier signatures", () => {
  const keys = demoPqKeys();
  const root = keccak256(toBytes("evidence"));

  test("sizes match FIPS 204 ML-DSA-44", () => {
    expect((keys.publicKey.length - 2) / 2).toBe(1312);
    expect((pqSignRoot(root, keys.secretKey).length - 2) / 2).toBe(2420);
  });

  test("a signed root verifies", () => {
    expect(pqVerifyRoot(root, pqSignRoot(root, keys.secretKey), keys.publicKey)).toBe(true);
  });

  test("a different root, key or signature fails", () => {
    const sig = pqSignRoot(root, keys.secretKey);
    expect(pqVerifyRoot(keccak256(toBytes("other")), sig, keys.publicKey)).toBe(false);
    expect(pqVerifyRoot(root, sig, demoPqKeys("someone else").publicKey)).toBe(false);
    const flipped = (sig.slice(0, 10) + (sig[10] === "0" ? "1" : "0") + sig.slice(11)) as `0x${string}`;
    expect(pqVerifyRoot(root, flipped, keys.publicKey)).toBe(false);
  });

  test("signing is deterministic and keys are reproducible", () => {
    expect(pqSignRoot(root, keys.secretKey)).toBe(pqSignRoot(root, demoPqKeys().secretKey));
    expect(pqPubKeyHash(keys.publicKey)).toMatch(/^0x[0-9a-f]{64}$/);
  });
});
