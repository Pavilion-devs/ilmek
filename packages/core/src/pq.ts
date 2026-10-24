import { ml_dsa44 } from "@noble/post-quantum/ml-dsa.js";
import { bytesToHex, hexToBytes, keccak256, toBytes, type Hex } from "viem";

/**
 * Post-quantum certifier signatures (ML-DSA-44, NIST FIPS 204).
 *
 * The certifier signs each step's evidence root. The contract stores only keccak256 of the
 * certifier's public key (too large and too costly to verify on-chain); anyone can check a
 * signature in the browser against that hash. Records that must hold up for years should not
 * rest only on ECDSA, which a large quantum computer could break.
 */

/** Domain separation: these signatures mean "this evidence root was approved", nothing else. */
const CONTEXT = toBytes("ilmek:evidence-root:v1");

export interface PqKeys {
  publicKey: Hex;
  secretKey: Hex;
}

/** Keys from a 32-byte seed. */
export function pqKeygen(seed: Uint8Array): PqKeys {
  if (seed.length !== 32) throw new Error("ML-DSA seed must be 32 bytes");
  const k = ml_dsa44.keygen(seed);
  return { publicKey: bytesToHex(k.publicKey), secretKey: bytesToHex(k.secretKey) };
}

/** Deterministic demo keys. Not secret: anyone can derive them. Use PQ_SEED for a real deployment. */
export function demoPqKeys(label = "ilmek demo certifier"): PqKeys {
  return pqKeygen(hexToBytes(keccak256(toBytes(label))));
}

export function pqSignRoot(root: Hex, secretKey: Hex): Hex {
  return bytesToHex(ml_dsa44.sign(hexToBytes(root), hexToBytes(secretKey), { context: CONTEXT, extraEntropy: false }));
}

export function pqVerifyRoot(root: Hex, signature: Hex, publicKey: Hex): boolean {
  try {
    return ml_dsa44.verify(hexToBytes(signature), hexToBytes(root), hexToBytes(publicKey), { context: CONTEXT });
  } catch {
    return false;
  }
}

/** What the contract stores for each certifier. */
export const pqPubKeyHash = (publicKey: Hex): Hex => keccak256(publicKey);
