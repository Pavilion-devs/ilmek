# Security and trust model

What Ilmek protects against, how, and where its limits are.

## Who is trusted for what

| Party | Trusted to | Not trusted to |
|---|---|---|
| Ledger contract | Enforce physics and single use of certificates | Know whether a document is genuine |
| Certifier | Look at evidence and approve a step | Approve something physically impossible (the contract refuses it anyway) |
| Factory (recycler, spinner, mill, maker) | Upload its documents | Decide its own recycled share or carbon figure |
| AI (Claude) | Read documents and propose fields; draft a label | Write to the ledger, approve anything, or invent numbers |
| Our web server | Serve the page | Anything: the verifier checks every byte it serves against the chain |

## Threats and what stops them

| Threat | Defence | Where |
|---|---|---|
| Selling virgin fiber as recycled ("padding") | Each step consumes its inputs; recycled out ≤ recycled in × best physical yield, enforced even with a valid certifier signature | `FiberLedger.transform`, fuzz test `testFuzz_RecycledNeverCreated` |
| Showing one certificate to two buyers | Certificate hashes can be used once, ledger-wide | `_useCert`, `test_SameCertificateTwice_Reverts` |
| Spending the same lot twice | Lots track remaining mass; consumption subtracts | `_take`, `test_ConsumeSameLotTwice_Reverts` |
| Editing a step after the certifier approved it | EIP-712 signature covers every field, including the evidence root | `test_EditedAfterSigning_Reverts` |
| Replaying an approval | The approval includes a single-use certificate hash | `test_ReplayedApproval_Reverts` |
| Backdating output before its inputs | `producedAt` must not precede any input | `test_OutputDatedBeforeInput_Reverts` |
| Rogue signer | Only allowlisted certifiers; admin-only configuration | `test_SignatureFromNonCertifier_Reverts`, `test_OnlyAdminConfigures` |
| Editing documents after approval | Evidence bundle hashes to a Merkle root on the ledger; the browser recomputes it | `verifier.ts`, "Edit a document" switch on the verify page |
| Editing the label after the passport was minted | The claim's hash is on the ledger | "Edit the label" switch |
| A quantum computer forging old approvals | Certifiers also sign each evidence root with ML-DSA-44 (FIPS 204); the ledger stores the key's hash | `pq.ts`, "Swap the certifier's key" switch |
| AI inventing a quote or a number | Quotes must appear in the PDF's own text and contain the value; photos always go to a person | `verify.ts`, 40+ tests |
| AI writing an illegal or false label | Number lock: only the passport's numbers, exactly as written, no generic green terms; otherwise a template is used | `guards.ts` |
| Fraud discovered later | A certifier can freeze a lot; frozen lots can't be used, and the verifier flags every passport downstream | `revokeLot`, `test_RevokedLotIsFrozen` |

## Privacy

- Parties appear on-chain as addresses and pseudonymous IDs (`keccak256` of an internal ID). Company names stay off-chain.
- Documents stay off-chain. Only Merkle roots are stored, and a brand can choose which steps' documents to share.
- Lot masses are visible on-chain, because the mass balance needs them. Hiding them with zero-knowledge proofs of the balance is on the roadmap, not in this prototype.

## Limits, stated plainly

- **Garbage in.** The ledger proves that claims are consistent with certified inputs and physics, not that the first certificate is honest. Ilmek makes fraud harder and visible; it does not replace accredited GRS/RCS certification or lab fiber testing.
- **Yield limits are configuration.** The admin sets the maximum yield per step. Set too high, they allow some padding. Values and sources are in `docs/SOURCES.md`.
- **Demo keys.** The demo's ML-DSA key is derived from a public phrase and its ECDSA keys are the public Anvil test keys. A deployment must use `PQ_SEED` and private keys.
- **Single admin.** One admin configures certifiers and yields. Production would use a multisig or governance by certification bodies.
- **Snapshot mode.** The verifier's "saved copy" mode trusts that the copy is faithful. "Live node" mode reads the contract directly and is the trustless one.
