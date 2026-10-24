# Ilmek

**Proof that a garment's "recycled" claim is true, in kilograms and kg CO₂e, from the bottle bale to the label.**

IEEE ClimateChain Global Hackathon 2026 · Track: Sustainable Supply Chains (also touches Carbon Markets & Emissions Transparency)

> See [plan.md](plan.md) for the plan and [docs/SECURITY.md](docs/SECURITY.md) for the trust model.

## Live

| | |
|---|---|
| **Site** | https://pavilion-devs.github.io/ilmek/ |
| **Passport (what a shopper scans)** | https://pavilion-devs.github.io/ilmek/#/passport/15 |
| **Public verifier** | https://pavilion-devs.github.io/ilmek/#/verify/15 (choose "Live node" to read Base Sepolia directly) |
| **Contract** | [`0x90db5fde6310022c5f478bbb84e264455e895b1d`](https://sepolia.basescan.org/address/0x90db5fde6310022c5f478bbb84e264455e895b1d) on Base Sepolia · source [verified on Sourcify](https://repo.sourcify.dev/84532/0x90db5fde6310022c5f478bbb84e264455e895b1d) (exact match) |
| **Over-claim refused** | [`RecycledExceedsInputs`](https://sepolia.basescan.org/tx/0x7adced447492daa64267023072f7f380d48287c6f9d12dfccf083eed6b9c3024): 50 t "recycled" yarn from 30 t recycled chips, reverted even with a certifier signature |
| **Certificate reuse refused** | [`CertificateAlreadyUsed`](https://sepolia.basescan.org/tx/0xca2555d0cf6f4c3d50fc33ce96567298c39981fa40ae3234fd50d4862bb77022) |
| **Passport minted** | [lot 15](https://sepolia.basescan.org/tx/0xd891408242c126776b05130eb15ab6388bcc45c34a5ca2aa612ee2adf5e7ee0f): 57.43% recycled |

The certifier's ML-DSA-44 key on this deployment comes from a private random seed (not the public demo seed). Every party is a separate testnet account.

## What works now

- **`contracts/`**: `FiberLedger.sol`, a mass-balance ledger. Every processing step consumes its inputs and can't output more recycled kilograms than the inputs physically allow, **even with a valid certifier signature**. Each shipment certificate can be used once. The contract carries embedded CO₂e down the chain itself. 22 Foundry tests, including a fuzz test that recycled mass is never created.
- **`packages/core/`**: yields, carbon maths (Türkiye grid, IPCC gas, Textile Exchange fiber LCA), the integrity engine (plain-language findings), evidence Merkle trees, and the demo supply chain. 31 tests, including the verifier and post-quantum signatures.
- **`packages/ai/`**: Claude (the model in `ANTHROPIC_MODEL`, default `claude-opus-5-5`; the demo was recorded with `claude-sonnet-5`) reads transaction certificates, invoices, weighbridge tickets and electricity bills, returning each field with a quote. Code checks every quote against the PDF's own text and every value against its quote, and checks that a shipment's documents agree with each other. The claim checker sorts a brand's label phrases under EU Directive 2024/825 and rewrites the label; a **number lock** rejects any number the passport doesn't prove and any banned generic term, falling back to a safe template. Live responses are recorded to `packages/ai/recorded/` so the demo replays them without a key. 43 tests.
- **`apps/web/`**: the web app. A story page, role views (recycler, spinner, certifier, brand), the shopper's passport with a QR code, and a **public verifier** that walks the passport back to the certified bales in the browser, checking mass balance, evidence roots, certificate numbers, the label hash and every **ML-DSA-44** certifier signature. It reads a live node or a saved copy, and has a "try to break it" panel. See [docs/SECURITY.md](docs/SECURITY.md) for the trust model.
- **`data/sample-docs/`**: five demo PDFs (marked as demo, fictional companies), including the spinner's inflated yarn certificate.
- **`scripts/`**: `pnpm demo:local` deploys to a local chain and runs the whole story, saving every transaction to `data/`.

## Run it

Needs Node 20+, pnpm and Foundry.

```bash
pnpm install
pnpm test          # TypeScript + Solidity tests
pnpm demo:local    # full story on a throwaway local chain
pnpm --filter @ilmek/web dev   # web app at http://localhost:5173

# keep the local chain running so the verifier's "live node" mode works
ILMEK_AI=recorded pnpm demo:local --keep

# Base Sepolia: keys in .env.base-sepolia (git-ignored), then
pnpm fund --send                   # split test ETH from the admin account
ILMEK_AI=recorded pnpm demo:base   # deploy and run the whole story

# record live AI responses (needs an Anthropic API key)
ANTHROPIC_API_KEY=... pnpm --filter @ilmek/ai record
```

Set `ILMEK_AI=live|recorded|auto` to choose live calls or recorded responses (default `auto`: live when a key is present).

## The demo chain

Istanbul bottle bales → recycler, Adana → spinner, Gaziantep → fabric mill, Bursa → garment maker, Denizli → brand, Amsterdam. Companies are fictional; places, yields and emission factors are real ([sources](docs/SOURCES.md)).

| Moment | What happens |
|---|---|
| Over-claim | The spinner claims 50 t of recycled yarn from 30 t of recycled chips. The integrity engine fails it; the certifier signs anyway; the contract refuses: `RecycledExceedsInputs(50 t, max 29.1 t)`. |
| Certificate reuse | The recycler presents shipment certificate TC-2026-ADN-0042 to a second buyer. Refused: `CertificateAlreadyUsed`. |
| Honest carbon | Gaziantep yarn (58% recycled, grid power): 2.7 kg CO₂e/kg, 38% below virgin polyester. Kahramanmaraş yarn (100% recycled, own lignite power): 4.3 kg CO₂e/kg, barely better than virgin. |
| Passport | 57% recycled garments with a claim hash on-chain. |
