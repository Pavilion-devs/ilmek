import { concat, keccak256, toBytes, type Hex } from "viem";

/**
 * Evidence bundle Merkle tree. Each leaf is one document or reading. Only the root goes
 * on-chain; a verifier gets the document, its proof and the root, and checks them in the browser.
 *
 * Leaf  = keccak256(keccak256(canonicalJson(item)))   (double hash: a leaf can't pose as a node)
 * Node  = keccak256(sorted(left, right))               (sorted pairs: proofs need no left/right flags)
 */

export type EvidenceItem = Record<string, unknown>;

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(",")}}`;
}

export function leafHash(item: EvidenceItem): Hex {
  return keccak256(keccak256(toBytes(canonicalJson(item))));
}

function hashPair(a: Hex, b: Hex): Hex {
  return a.toLowerCase() < b.toLowerCase() ? keccak256(concat([a, b])) : keccak256(concat([b, a]));
}

export interface MerkleTree {
  root: Hex;
  leaves: Hex[];
  /** layers[0] = leaves, last layer = [root] */
  layers: Hex[][];
}

export function buildTree(items: EvidenceItem[]): MerkleTree {
  if (items.length === 0) throw new Error("empty evidence bundle");
  const leaves = items.map(leafHash);
  const layers: Hex[][] = [leaves];
  while (layers[layers.length - 1]!.length > 1) {
    const prev = layers[layers.length - 1]!;
    const next: Hex[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      // An odd node is carried up unchanged.
      next.push(i + 1 < prev.length ? hashPair(prev[i]!, prev[i + 1]!) : prev[i]!);
    }
    layers.push(next);
  }
  return { root: layers[layers.length - 1]![0]!, leaves, layers };
}

export function getProof(tree: MerkleTree, index: number): Hex[] {
  const proof: Hex[] = [];
  let i = index;
  for (let l = 0; l < tree.layers.length - 1; l++) {
    const layer = tree.layers[l]!;
    const sibling = i ^ 1;
    if (sibling < layer.length) proof.push(layer[sibling]!);
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyProof(item: EvidenceItem, proof: Hex[], root: Hex): boolean {
  let h = leafHash(item);
  for (const p of proof) h = hashPair(h, p);
  return h.toLowerCase() === root.toLowerCase();
}

/** Hash for a certificate number, as stored on-chain in certUsed. */
export function certHash(certificateNo: string): Hex {
  return keccak256(toBytes(`ilmek:cert:${certificateNo.trim().toUpperCase()}`));
}

/** Hash for an approved consumer claim, as stored in the passport. */
export function claimHash(text: string): Hex {
  return keccak256(toBytes(`ilmek:claim:${text.trim()}`));
}
