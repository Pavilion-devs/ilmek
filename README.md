# Ilmek

**Proof that a garment's "recycled" claim is true, in kilograms and kg CO₂e, from the bottle bale to the label.**

IEEE ClimateChain Global Hackathon 2026 · Track: Sustainable Supply Chains (also touches Carbon Markets & Emissions Transparency)

> Work in progress. See [plan.md](plan.md) for the full plan.

## What works now

- **`contracts/`**: `FiberLedger.sol`, a mass-balance ledger. Every processing step consumes its inputs and can't output more recycled kilograms than the inputs physically allow, **even with a valid certifier signature**. Each shipment certificate can be used once. The contract carries embedded CO₂e down the chain itself. 22 Foundry tests, including a fuzz test that recycled mass is never created.
- **`packages/core/`**: yields, carbon maths (Türkiye grid, IPCC gas, Textile Exchange fiber LCA), the integrity engine (plain-language findings), evidence Merkle trees, and the demo supply chain. 21 tests.
- **`scripts/`**: `pnpm demo:local` deploys to a local chain and runs the whole story, saving every transaction to `data/`.

## Run it

Needs Node 20+, pnpm and Foundry.

```bash
pnpm install
pnpm test          # TypeScript + Solidity tests
pnpm demo:local    # full story on a throwaway local chain
```

## The demo chain

Istanbul bottle bales → recycler, Adana → spinner, Gaziantep → fabric mill, Bursa → garment maker, Denizli → brand, Amsterdam. Companies are fictional; places, yields and emission factors are real ([sources](docs/SOURCES.md)).

| Moment | What happens |
|---|---|
| Over-claim | The spinner claims 50 t of recycled yarn from 30 t of recycled chips. The integrity engine fails it; the certifier signs anyway; the contract refuses: `RecycledExceedsInputs(50 t, max 29.1 t)`. |
| Certificate reuse | The recycler presents shipment certificate TC-2026-ADN-0042 to a second buyer. Refused: `CertificateAlreadyUsed`. |
| Honest carbon | Gaziantep yarn (58% recycled, grid power): 2.7 kg CO₂e/kg, 38% below virgin polyester. Kahramanmaraş yarn (100% recycled, own lignite power): 4.3 kg CO₂e/kg, barely better than virgin. |
| Passport | 57% recycled garments with a claim hash on-chain. |
