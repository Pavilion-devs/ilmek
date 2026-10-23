# Ilmek — plan

> Working name. *Ilmek* is Turkish for "loop" or "stitch": a loop for circular textiles, a stitch for each step of the chain. Easy to change.

**One line:** Proof that a garment's "recycled" claim is true, in kilograms and kg CO₂e, from the bale to the label, for Turkish textile exporters selling into the EU.

**Hackathon:** IEEE ClimateChain Global Hackathon 2026
**Deadline:** 25 Oct 2026, 17:00 Türkiye time (UTC+3)
**Primary track:** Sustainable Supply Chains (product lifecycle tracking, digital product passports, recycling traceability)
**Also touches:** Carbon Markets & Emissions Transparency (each passport carries a measured kg CO₂e per kg of fiber)

---

## 1. Why this, and not something else

What the competitor research showed (about 110 public repos, checked 24 Oct):

| Lane | Rough number of entries | Our position |
|---|---|---|
| Forest / satellite carbon credits + double counting | ~20 | avoid |
| Hourly clean-energy certificates, solar, P2P trading | ~12 | avoid |
| Fires, floods, gas flares, methane monitoring | ~12 | avoid |
| CBAM / factory emissions (Mizan, CarbonPass, EmbedProof, CarbonLEI…) | ~6, very strong | avoid |
| Supply chains / product passports | 2 (Orbit is general-purpose, GreenSilicon covers chips) | **our lane** |
| Textiles | **0** | **our lane** |

**The shared playbook** (post-quantum signatures, Merkle roots, a "claim once" contract, a browser verifier, a testnet, "AI flags, a human decides") is now the minimum. We include all of it, but we **don't pitch it**. We pitch the problem and the moment fraud gets caught.

**Why textiles land with this panel:**
- Türkiye is the EU's **2nd-largest textile supplier** (~17.6% share, after China) and its **3rd-largest apparel supplier** (~9–11%). This is core Istanbul Chamber of Commerce business, and Türkiye hosts COP31 in November.
- **The EU's greenwashing ban (Directive 2024/825) has applied since 27 Sept 2026.** Generic claims like "eco-friendly" are out, and sustainability claims need proof. The textile digital product passport (ESPR) comes next, expected to be adopted in 2027 with compliance around 2028.
- **The fraud is real and measurable.** An 18-month testing study found **62% of "recycled" polyester samples** contained less recycled content than claimed, or none. The cause is a shortage of recycled PET, with virgin fiber substituted for it.

**The Climate Impact risk, and how we turn it into an advantage:**
Textile Exchange's own life-cycle study puts mechanically recycled polyester staple fiber at **~3.0 kg CO₂e/kg** against **~4.0–4.8 for virgin**. The saving is real but modest, and it depends on the plant's electricity. So Ilmek does **not** assume "recycled = green". Every passport shows the **measured** kg CO₂e/kg for that lot, using the plant's real energy use and Türkiye's grid factor. A lot can be "recycled but not low-carbon", and the passport says so. This is more honest than any competitor's approach, and it holds up against the obvious judge objection.

---

## 2. The problem in 30 seconds (for the write-up and video)

A Turkish spinning mill buys 60 t of certified recycled PET chips, then sells 100 t of "recycled" yarn to an EU brand, padded with cheaper virgin chips. The paperwork is a PDF transaction certificate sent by email, and the same certificate can be shown to two buyers. The brand prints "eco-friendly, made from 100% recycled materials" on the label. Since 27 Sept 2026 that label is illegal in the EU, and nobody along the chain can check the number behind it.

---

## 3. What Ilmek does

Five parties: **recycler → spinner → fabric mill → garment maker → EU brand**, plus a **certifier** and the **public** (shopper, customs, journalist).

1. **Material-balance ledger (blockchain).** A certifier registers each certified recycled input in kilograms. Every processing step (bale → flake → chip → yarn → fabric → garment) **consumes** its inputs and can't output more recycled kg than its inputs multiplied by that step's maximum physical yield. The contract **refuses** over-claims, reuse of the same certificate, and outputs dated before their inputs arrived. This is "claim once" applied to material.
2. **Document AI.** It reads transaction certificates and invoices (PDF or photo) and extracts kg, dates, parties and certificate numbers, each with a quote from the source. Code then checks that every quote really appears in the PDF text. Fields that came from a photo wait for a person to confirm.
3. **Integrity engine.** Deterministic checks plus a small statistical model, each explained in plain language:
   - yield outside physical bounds for that step (e.g. bale → flake is typically 60–75%)
   - energy per kg implausible for the process
   - timing: output before input arrived, or throughput above the plant's capacity
   - one certificate hash presented to two buyers
   - the plant's recycled-content ratio jumps away from its own history

   The AI flags; the certifier decides, and the decision is signed.
4. **Carbon per lot.** kg CO₂e/kg = process energy (kWh/kg) × Türkiye grid factor (**0.442 tCO₂e/MWh**, Ministry of Energy 2022) + heat + an upstream factor, compared with a virgin baseline. This is shown as information only and is **never a tradable credit**, so it creates no double counting of savings.
5. **Claim checker (our unique piece).** The brand pastes its marketing text. AI sorts each phrase as *banned generic claim*, *specific but unproven*, or *provable*, then rewrites it using **only numbers taken from the ledger**. Code checks that every number in the rewrite matches the passport.
   `"Eco-friendly jacket, 100% recycled"` → `"Shell: 38% recycled polyester, verified. 2.9 kg CO₂e per kg of fiber (virgin ≈ 4.4)."`
6. **QR passport.** Shoppers, customs and auditors can verify it in the browser. Signatures and Merkle proofs are checked client-side against the chain, and our server is treated as untrusted. Supplier names stay private: parties appear as pseudonymous IDs, and the brand can choose which steps to disclose.

**Not in scope (stated openly):** we are not an accredited certification body and don't replace GRS/RCS certification. Our job is to make their certificates hard to fake and impossible to reuse. Lab fiber testing is a future input to the integrity engine.

---

## 4. Architecture

```
 PDFs / photos ──► Document AI ──► structured step record ──► Integrity engine ──► certifier review
                    (Claude)        (kg, dates, cert no.,       (rules + stats,       (approve / reject,
                                     source quotes)              plain-language why)    signed)
                                                                                           │
                                                                                           ▼
 Brand claim text ──► Claim checker ──► EU-safe claim      FiberLedger contract (Base Sepolia)
                      (Claude, numbers      │               - registerInput (certifier role)
                       locked to ledger)    │               - transform (yield-bounded, consumes inputs)
                                            ▼               - certificate hash used once
                                      Garment passport ◄─── - mintPassport (lot, recycled %, CO₂e, evidence root)
                                      (QR, browser verify)
```

**Stack (keep it boring and fast):**
- **Contracts:** Solidity 0.8.x + Foundry, deployed to **Base Sepolia** with source verified.
- **Core logic:** TypeScript package `core`: yields, carbon maths, integrity rules, Merkle trees (shared by the web app and scripts).
- **AI:** Claude API (`claude-sonnet-5-5` for extraction and claim rewriting). Responses are **recorded** so the live demo works without a key, and labelled "recorded response".
- **Signatures:** EIP-712 (ECDSA) for wallet actions; **ML-DSA-44** (`@noble/post-quantum`) on certifier approvals. One line in the pitch, for the cryptography judges.
- **Web:** Vite + React + Tailwind as a static site (Cloudflare Pages or Vercel). Roles: Recycler, Spinner, Brand, Certifier, Public verifier. No wallet and no login needed to view.
- **Data:** real factors (yields, grid factor, virgin vs recycled CO₂e) with sources in `docs/SOURCES.md`. Companies and people are fictional and clearly labelled.

**Repo layout:**
```
contracts/        FiberLedger.sol, tests, deploy script
packages/core/    yields, carbon, integrity rules, merkle, types
packages/ai/      extraction + claim checker prompts, recorded responses, number-lock check
apps/web/         role views, passport page, public verifier
data/             demo chain (JSON), sample certificate PDFs, factors with sources
docs/             SOURCES.md, SECURITY.md (threat model), JUDGES.md (90-second path), submission text
```

---

## 5. Demo story (the video, 3–5 min)

Fictional chain, real places and numbers: **bottle bales collected in Istanbul → recycler in Adana → spinner in Gaziantep → fabric mill in Bursa → garment maker in Denizli → brand in Amsterdam.**

| Time | Scene |
|---|---|
| 0:00–0:35 | **The hook.** "62% of 'recycled' polyester tested didn't contain what it claimed. Since September, that label is illegal in the EU. Türkiye is Europe's #2 textile supplier." |
| 0:35–1:10 | **Honest chain.** Recycler uploads a transaction certificate, the AI pulls out the numbers with quotes, the certifier approves, and kilograms flow down the chain step by step. |
| 1:10–2:00 | **Fraud, caught.** The Gaziantep spinner claims 100 t of recycled yarn from 60 t of certified chips. The integrity engine flags it with a plain-language reason, and the contract **refuses** it on-chain (a real reverted transaction with an explorer link). |
| 2:00–2:25 | **Certificate reuse.** The same certificate is sent to a second brand and refused. |
| 2:25–3:05 | **The label.** The brand pastes "eco-friendly, 100% recycled" and it's rewritten live into a provable claim with kg CO₂e. |
| 3:05–3:40 | **Honest carbon.** Two lots, both 100% recycled. One is from a coal-heavy plant and shows a much smaller saving. "Recycled isn't automatically low-carbon. Now you can see which one is." |
| 3:40–4:15 | **Anyone can check.** A shopper scans the QR code, the browser verifies the proof itself, and an edited number in the database fails verification. |
| 4:15–4:45 | **Impact and scale.** CO₂e behind fake claims per 1,000 t, the Turkish exporters covered, and the path to the 2028 textile passport. "Every kilo, counted once." |

---

## 6. How we score on each criterion

| Criterion | What judges will see |
|---|---|
| Climate impact | Measured kg CO₂e per lot. Fake recycled claims caught and converted to tonnes of CO₂e. Recycling money goes to real recyclers, not virgin padding. |
| Innovation | First entry on textiles. "Claim once" applied to material by mass balance. AI rewrites the claim the shopper actually reads. Honest "recycled but not low-carbon" flag. |
| Technical execution | Live testnet contract with tests, real reverted fraud transactions, browser verification, ML-DSA certifier signatures, AI numbers locked to the ledger. |
| Practical usefulness | Clear users (Turkish mills, EU brands, certifiers), a legal driver live since 27 Sept 2026, works alongside existing GRS/RCS certificates, supplier privacy kept. |
| Presentation | One story told through one jacket, a fraud moment in the first two minutes, real places, the judge's 90-second path in the README. |

---

## 7. Build order

Must-haves first. Nothing from a later tier starts until the tier above it works end to end.

**Tier 1: the spine (must)**
1. Scaffold the repo (Foundry + pnpm workspace + Vite).
2. `FiberLedger.sol`: roles, `registerInput`, `transform` with yield bounds, certificate hash used once, `mintPassport`. Foundry tests for the honest path and each refusal.
3. `core`: yield table, carbon maths, integrity rules, Merkle tree, plus the demo chain data.
4. Script that runs the full demo (honest chain, over-claim, certificate reuse) on a local chain, then on Base Sepolia, and saves the transaction hashes.
5. Web: passport page + public verifier that reads the chain and checks proofs in the browser.

**Tier 2: the AI (must)**
6. Document extraction on 3–4 sample certificate PDFs, with quotes and the quote check.
7. Claim checker with the number-lock check.
8. Recorded responses wired into the web app.

**Tier 3: polish (should)**
9. Role views (Recycler, Spinner, Certifier, Brand) with the integrity flags explained.
10. Comparison of the two lots (coal-heavy vs clean plant).
11. ML-DSA-44 certifier signature verified in the browser.
12. README with the judge's 90-second path, plus SECURITY.md and SOURCES.md.

**Tier 4: ship (must, kept separate so it always gets time)**
13. Deploy the static site, confirm the live links work from a clean browser.
14. Record the video (script above), upload to YouTube.
15. Devpost write-up: track, problem, solution, users, scale, adoption. Submit.

**Could (only if everything above is done):** Turkish/English toggle on the passport, a CSV import for a real mill's monthly data, a statistical drift model trained on a plant's history.

---

## 8. Risks

| Risk | Mitigation |
|---|---|
| Judges see textiles as "less climate" | Lead with kg CO₂e; touch the Carbon Markets track; the honest-carbon scene. |
| Orbit (general-purpose passport) looks similar | Be specific: Turkish chain, physical yields, a real EU law, a live fraud refusal. |
| Volumes on-chain leak business data | Pseudonymous party IDs, evidence kept off-chain, only roots on-chain. A future option is proving the balance without revealing volumes (zero-knowledge), stated as roadmap. |
| AI makes up a number | AI never writes to the chain. Quotes are checked against the PDF text, and claim numbers are checked against the passport. |
| Live demo breaks during judging | Static snapshot of the verified testnet run, plus recorded AI responses. |

---

## 9. Sources (verify again before quoting in the submission)

- EU Directive 2024/825 applies from 27 Sept 2026: [European Commission, sustainable consumption](https://commission.europa.eu/topics/consumers/consumer-rights-and-complaints/sustainable-consumption_en)
- Türkiye's EU textile (~17.6%, #2) and apparel (~9–11%, #3) shares: [IHKIB 2025 apparel export report](https://www.ihkib.org.tr/content/files/uploads/289/2025-annual-apparel-export-report.pdf), [Textalks](https://textalks.com/turkiyes-textile-apparel-exports-hit-26-2bn-in-2025-preserve-17bn-trade-surplus-despite-global-slowdown/). The 2026 share figure is from a secondary source; check against Eurostat.
- ESPR textile passport timeline (adoption expected 2027, compliance ~2028, an estimate): [Renoon](https://www.renoon.com/blog/delegated-acts-for-digital-product-passport-explainer-and-current-status)
- Recycled vs virgin polyester CO₂e (Textile Exchange / SCS LCA): [Textalks summary](https://textalks.com/?p=84948)
- 62% of tested "recycled" polyester fell short of its claim: [Apparel Insider](https://apparelinsider.com/net-closes-on-rpet-fraud-as-more-testing-methods-launched)
- Bale-to-flake yields of 60–75%: [Recycling Today](https://recyclingtoday.com/article/hanging-on-by-a-thread), [Plastics Recyclers Europe](https://plastics-recyclers-europe.prezly.com/pet-recyclers-suffer-lower-input-qualities)
- Türkiye grid factor of 0.442 tCO₂e/MWh (2022): [Ministry of Energy](https://enerji.gov.tr//Media/Dizin/EVCED/tr/ÇevreVeİklim/İklimDeğişikliği/EmisyonFaktorleri/2022_Uretim_Tuketim_EF.pdf)
