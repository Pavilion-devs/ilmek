/**
 * Runs the whole Ilmek story on a chain and saves what happened to data/demo-run.json.
 *
 *   pnpm demo:local          starts a throwaway local chain (anvil) and runs everything
 *   RPC_URL=... pnpm demo:local   uses that chain instead (see .env.example for the keys)
 *
 * Steps: configure → register certified bales → recycle → ship → the fraud attempt is refused
 * → the reused certificate is refused → honest chain to garments → passport.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  hexToBytes,
  http,
  keccak256,
  toBytes,
  type Abi,
  type Account,
  type Address,
  type Hex,
} from "viem";
import { mnemonicToAccount, privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";
import {
  buildTree,
  certHash,
  checkStep,
  claimHash,
  compareWithVirginFiber,
  contractYieldTable,
  demo,
  demoPqKeys,
  gToKg,
  intensityKgPerKg,
  isoToUnix,
  kgToG,
  processCo2eG,
  pqKeygen,
  pqPubKeyHash,
  pqSignRoot,
  Role,
  Stage,
  VIRGIN_PET_CHIP_G_PER_KG,
  type IntegrityReport,
  type StepRecord,
} from "@ilmek/core";
import { crossCheckShipment, loadDotEnv, processClaim, processDocument } from "@ilmek/ai";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const artifact = JSON.parse(readFileSync(resolve(ROOT, "contracts/out/FiberLedger.sol/FiberLedger.json"), "utf8"));
const abi = artifact.abi as Abi;
const bytecode = artifact.bytecode.object as Hex;

// ------------------------------------------------------------------ chain + accounts

const ANVIL_MNEMONIC = "test test test test test test test test test test test junk"; // public dev mnemonic
const NAMES = ["admin", "certifier", "recycler", "spinner", "coalSpinner", "mill", "maker", "brand"] as const;
type Name = (typeof NAMES)[number];

function loadAccounts(): Record<Name, Account> {
  const out = {} as Record<Name, Account>;
  NAMES.forEach((n, i) => {
    const pk = process.env[`PK_${n.toUpperCase()}`] as Hex | undefined;
    out[n] = pk ? privateKeyToAccount(pk) : mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i });
  });
  return out;
}

async function startAnvil(): Promise<ChildProcess> {
  const proc = spawn("anvil", ["--port", "8545", "--silent"], { stdio: "ignore" });
  const probe = createPublicClient({ chain: foundry, transport: http("http://127.0.0.1:8545") });
  for (let i = 0; i < 50; i++) {
    try {
      await probe.getChainId();
      return proc;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error("anvil did not start");
}

// ------------------------------------------------------------------ main

async function main() {
  loadDotEnv(resolve(ROOT, ".env"));
  const rpc = process.env.RPC_URL;
  const keep = process.argv.includes("--keep");
  const anvil = rpc ? undefined : await startAnvil();
  const url = rpc ?? "http://127.0.0.1:8545";
  const pub = createPublicClient({ transport: http(url) });
  const chainId = await pub.getChainId();
  const chain = { ...foundry, id: chainId };
  const acct = loadAccounts();
  const wallet = (n: Name) => createWalletClient({ account: acct[n], chain, transport: http(url) });
  const log = (s: string) => console.log(s);
  const txs: { label: string; hash: Hex; status: string }[] = [];

  try {
    // -- deploy
    const deployHash = await wallet("admin").deployContract({ abi, bytecode, account: acct.admin, chain });
    const deployRcpt = await pub.waitForTransactionReceipt({ hash: deployHash });
    const deployBlock = deployRcpt.blockNumber;
    const ledger = deployRcpt.contractAddress as Address;
    log(`FiberLedger deployed at ${ledger} (chain ${chainId})`);

    const send = async (n: Name, functionName: string, args: unknown[], label: string) => {
      const { request } = await pub.simulateContract({ address: ledger, abi, functionName, args, account: acct[n] });
      const hash = await wallet(n).writeContract(request as never);
      const r = await pub.waitForTransactionReceipt({ hash });
      if (r.status !== "success") throw new Error(`${label} reverted`);
      txs.push({ label, hash, status: r.status });
      return r;
    };
    const read = <T>(functionName: string, args: unknown[] = []) =>
      pub.readContract({ address: ledger, abi, functionName, args }) as Promise<T>;
    const lastLot = () => read<bigint>("lotCount");

    /** Sends a call we expect to be refused: records the contract's reason and a mined, reverted tx. */
    const expectRefusal = async (n: Name, functionName: string, args: unknown[], label: string) => {
      let errorName = "none";
      let errorArgs: unknown[] = [];
      try {
        await pub.simulateContract({ address: ledger, abi, functionName, args, account: acct[n] });
      } catch (e) {
        const rev = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null;
        if (rev instanceof ContractFunctionRevertedError) {
          errorName = rev.data?.errorName ?? "unknown";
          errorArgs = [...(rev.data?.args ?? [])];
        }
      }
      if (errorName === "none") throw new Error(`${label}: expected the contract to refuse, but it accepted`);
      // Mine it anyway (fixed gas, no estimate) so there is a reverted transaction anyone can look up.
      const hash = await wallet(n).writeContract({ address: ledger, abi, functionName, args, gas: 1_500_000n } as never);
      const r = await pub.waitForTransactionReceipt({ hash });
      txs.push({ label, hash, status: r.status });
      log(`  refused ✔  ${label}: ${errorName}(${errorArgs.map(String).join(", ")})`);
      return { label, errorName, errorArgs: errorArgs.map(String), txHash: hash, status: r.status };
    };

    // -- configure
    // Post-quantum key of the certifier. Demo keys are derivable by anyone; set PQ_SEED (32-byte hex) for real use.
    const pq = process.env.PQ_SEED ? pqKeygen(hexToBytes(process.env.PQ_SEED as Hex)) : demoPqKeys();
    await send("admin", "setCertifier", [acct.certifier.address, true, pqPubKeyHash(pq.publicKey)], "add certifier");
    const parties: [Name, keyof typeof demo.PLANTS, Role][] = [
      ["recycler", "recycler", Role.Recycler],
      ["spinner", "spinner", Role.Spinner],
      ["coalSpinner", "coalSpinner", Role.Spinner],
      ["mill", "mill", Role.FabricMill],
      ["maker", "maker", Role.GarmentMaker],
      ["brand", "brand", Role.Brand],
    ];
    for (const [n, plant, role] of parties) {
      const partyId = keccak256(toBytes(`ilmek:party:${demo.PLANTS[plant]!.id}`));
      await send("admin", "registerParty", [acct[n].address, role, partyId], `register ${plant}`);
    }
    for (const y of contractYieldTable()) await send("admin", "setMaxYield", [y.from, y.to, y.bps], `yield ${y.from}->${y.to}`);
    await send("admin", "setVirginFactor", [Stage.Chip, VIRGIN_PET_CHIP_G_PER_KG], "virgin chip factor");
    log("configured: certifier, 6 parties, yield limits, virgin factor");

    // -- helpers for steps
    const domain = { name: "FiberLedger", version: "1", chainId, verifyingContract: ledger } as const;
    const types = {
      Transform: [
        { name: "owner", type: "address" },
        { name: "inputLotIds", type: "uint256[]" },
        { name: "consumeG", type: "uint64[]" },
        { name: "virginG", type: "uint64" },
        { name: "outputStage", type: "uint8" },
        { name: "outputTotalG", type: "uint64" },
        { name: "outputRecycledG", type: "uint64" },
        { name: "processCo2eG", type: "uint128" },
        { name: "producedAt", type: "uint64" },
        { name: "certHash", type: "bytes32" },
        { name: "evidenceRoot", type: "bytes32" },
      ],
    } as const;

    const used = new Set<string>();
    const reports: Record<string, IntegrityReport> = {};
    const evidence: Record<string, { root: Hex; items: Record<string, unknown>[]; pqSig: Hex }> = {};
    /** lot id -> key in `evidence` for lots that have their own bundle (registered inputs and steps) */
    const evidenceOfLot: Record<string, string> = {};

    const buildStep = (s: StepRecord, inputLotIds: bigint[], gridGPerKwh?: number) => {
      const plant = Object.values(demo.PLANTS).find((p) => p.id === s.plantId)!;
      const report = checkStep(s, { plant, usedCertificates: used });
      reports[s.id] = report;
      const items = [
        { kind: "step-record", ...s },
        { kind: "integrity-report", ...report },
        { kind: "emission-factors", gridGPerKwh: gridGPerKwh ?? 442, naturalGasGPerMJ: 56.1 },
      ];
      const tree = buildTree(items as Record<string, unknown>[]);
      evidence[s.id] = { root: tree.root, items: items as Record<string, unknown>[], pqSig: pqSignRoot(tree.root, pq.secretKey) };
      const req = {
        inputLotIds,
        consumeG: s.inputs.map((i) => kgToG(i.kg)),
        virginG: kgToG(s.virginKg),
        outputStage: s.to,
        outputTotalG: kgToG(s.outputKg),
        outputRecycledG: kgToG(s.outputRecycledKg),
        processCo2eG: BigInt(processCo2eG(s.electricityKwh, s.heatMJ, gridGPerKwh)),
        producedAt: isoToUnix(s.producedAt),
        certHash: certHash(s.certificateNo),
        evidenceRoot: tree.root,
      };
      return { req, report };
    };

    const approve = (owner: Name, req: ReturnType<typeof buildStep>["req"]) =>
      wallet("certifier").signTypedData({
        account: acct.certifier,
        domain,
        types,
        primaryType: "Transform",
        message: { owner: acct[owner].address, ...req, outputStage: Number(req.outputStage) },
      });

    const transform = async (owner: Name, s: StepRecord, inputs: bigint[], grid?: number) => {
      const { req, report } = buildStep(s, inputs, grid);
      if (report.verdict === "fail") throw new Error(`${s.id} failed integrity: ${report.findings[0]?.message}`);
      const sig = await approve(owner, req);
      await send(owner, "transform", [req, sig], s.id);
      used.add(s.certificateNo);
      const id = await lastLot();
      evidenceOfLot[id.toString()] = s.id;
      return id;
    };

    const ship = async (owner: Name, lot: bigint, kg: number, to: Name, cert: string) => {
      await send(owner, "ship", [lot, kgToG(kg), acct[to].address, certHash(cert)], `ship ${cert}`);
      used.add(cert);
      return lastLot();
    };

    // -- 1. certified bales arrive at the Adana recycler
    const reg = async (b: typeof demo.BALE_INPUT) => {
      const items = [{ kind: "transaction-certificate", no: b.certificateNo, kg: b.kg, producedAt: b.producedAt }];
      const root = buildTree(items).root;
      evidence[b.certificateNo] = { root, items, pqSig: pqSignRoot(root, pq.secretKey) };
      await send("certifier", "registerInput", [acct.recycler.address, kgToG(b.kg), BigInt(b.embeddedCo2eG), isoToUnix(b.producedAt), certHash(b.certificateNo), root], `register ${b.certificateNo}`);
      used.add(b.certificateNo);
      const id = await lastLot();
      evidenceOfLot[id.toString()] = b.certificateNo;
      return id;
    };
    const bale = await reg(demo.BALE_INPUT);
    const bale2 = await reg(demo.BALE_INPUT_2);
    log(`bales registered: lot ${bale} (80 t), lot ${bale2} (40 t)`);

    // -- 2. recycling
    const S = demo.STEPS;
    const flake = await transform("recycler", S.flake, [bale]);
    const chip = await transform("recycler", S.chip, [flake]);
    const flake2 = await transform("recycler", S.coalFlake, [bale2]);
    const chip2 = await transform("recycler", S.coalChip, [flake2]);
    log(`recycled: flake ${flake}, chip ${chip} (54 t); flake ${flake2}, chip ${chip2} (27 t)`);

    // -- 3. ship chips to the Gaziantep spinner, then try to reuse the same certificate
    const sh = demo.SHIPMENTS;
    const chipsAtSpinner = await ship("recycler", chip, sh.chipsToSpinner.kg, "spinner", sh.chipsToSpinner.certificateNo);
    log(`shipped 30 t chips to spinner: lot ${chipsAtSpinner} (${sh.chipsToSpinner.certificateNo})`);
    log("fraud attempts:");
    const reuse = await expectRefusal(
      "recycler",
      "ship",
      [chip, kgToG(sh.chipsReused.kg), acct.coalSpinner.address, certHash(sh.chipsReused.certificateNo)],
      `same certificate ${sh.chipsReused.certificateNo} for a second buyer`,
    );

    // -- 4. the over-claim: integrity engine fails it, a bribed certifier signs anyway, the contract refuses
    const fraud = buildStep(S.yarnFraud, [chipsAtSpinner]);
    const fraudSig = await approve("spinner", fraud.req);
    const overclaim = await expectRefusal("spinner", "transform", [fraud.req, fraudSig], "50 t 'recycled' yarn from 30 t recycled chips (certifier signed it)");

    // -- 5. coal-powered spinner, 100% recycled
    const chipsAtCoal = await ship("recycler", chip2, sh.chipsToCoalSpinner.kg, "coalSpinner", sh.chipsToCoalSpinner.certificateNo);
    const coalYarn = await transform("coalSpinner", S.coalYarn, [chipsAtCoal], demo.PLANTS.coalSpinner!.gridGPerKwh);

    // -- 6. honest chain to garments
    const yarn = await transform("spinner", S.yarn, [chipsAtSpinner]);
    const yarnAtMill = await ship("spinner", yarn, sh.yarnToMill.kg, "mill", sh.yarnToMill.certificateNo);
    const fabric = await transform("mill", S.fabric, [yarnAtMill]);
    const fabricAtMaker = await ship("mill", fabric, sh.fabricToMaker.kg, "maker", sh.fabricToMaker.certificateNo);
    const garment = await transform("maker", S.garment, [fabricAtMaker]);
    const garmentAtBrand = await ship("maker", garment, sh.garmentsToBrand.kg, "brand", sh.garmentsToBrand.certificateNo);
    log(`honest chain: yarn ${yarn} → fabric ${fabric} → garments ${garment} → at brand ${garmentAtBrand}`);

    // -- 7. passport (claim text comes from the claim checker in tier 2; a deterministic placeholder for now)
    type LotView = { totalG: bigint; recycledG: bigint; embeddedCo2eG: bigint };
    const yarnLot = await read<LotView>("getLot", [yarn]);
    const coalLot = await read<LotView>("getLot", [coalYarn]);
    const g = await read<LotView>("getLot", [garmentAtBrand]);
    const yarnCmp = compareWithVirginFiber(intensityKgPerKg(yarnLot.embeddedCo2eG, yarnLot.totalG));
    const coalCmp = compareWithVirginFiber(intensityKgPerKg(coalLot.embeddedCo2eG, coalLot.totalG));
    // The brand's draft goes through the claim checker (AI rewrite + number lock, or the safe template).
    const facts = {
      scope: "Shell fabric",
      recycledPercent: Math.floor((Number(g.recycledG) * 100) / Number(g.totalG)),
      recycledMaterial: "recycled polyester",
      fiberCo2eKgPerKg: Math.round(yarnCmp.actualKgPerKg * 10) / 10,
      virginFiberCo2eKgPerKg: Math.round(yarnCmp.virginKgPerKg * 10) / 10,
      fiberSavingPercent: Math.round(yarnCmp.savingShare * 100),
      carbonLabel: yarnCmp.label,
    };
    const checkedClaim = await processClaim(demo.BRAND_DRAFT_CLAIM, facts);
    const claim = checkedClaim.final.text;
    log(`claim (${checkedClaim.final.source}, AI ${checkedClaim.provenance.source}): ${claim}`);
    await send("brand", "mintPassport", [garmentAtBrand, claimHash(claim)], "mint passport");
    const passport = await read<{ recycledBps: number; co2eGPerKg: number }>("getPassport", [garmentAtBrand]);
    log(`passport minted for lot ${garmentAtBrand}: ${passport.recycledBps / 100}% recycled, ${passport.co2eGPerKg / 1000} kg CO₂e per kg of garment`);
    log(`  fiber, Gaziantep (grid):            ${yarnCmp.sentence}`);
    log(`  fiber, Kahramanmaraş (own lignite): ${coalCmp.sentence}`);

    // -- snapshot of the chain, so the web app can show and check it without a live node
    const lotCount = await lastLot();
    const lotsOnChain: Record<string, unknown> = {};
    for (let i = 1n; i <= lotCount; i++) {
      lotsOnChain[i.toString()] = { ...(await read<Record<string, unknown>>("getLot", [i])), parents: await read<bigint[]>("getParents", [i]) };
    }
    const events = (await pub.getContractEvents({ address: ledger, abi, fromBlock: deployBlock })).map((e) => ({
      eventName: (e as { eventName?: string }).eventName,
      args: (e as { args?: unknown }).args,
      blockNumber: e.blockNumber,
      transactionHash: e.transactionHash,
    }));
    const [, onChainPqHash] = await read<[boolean, Hex]>("certifiers", [acct.certifier.address]);
    const yields = await Promise.all(contractYieldTable().map(async (y) => ({ ...y, onChainBps: await read<number>("maxYieldBps", [y.from, y.to]) })));

    // -- the demo documents, read by Claude (recorded responses) and checked against the PDFs
    const docDir = resolve(ROOT, "data/sample-docs");
    const documents: Record<string, unknown> = {};
    for (const f of ["TC-2026-ADN-0042.pdf", "INV-ADN-2026-0881.pdf", "WB-GZT-1182.pdf", "ELEC-GZT-2026-09.pdf", "TC-2026-GZT-0311-INFLATED.pdf"]) {
      try {
        documents[f] = await processDocument(resolve(docDir, f), { mode: "recorded" });
      } catch (e) {
        log(`  (no recorded reading for ${f}: ${(e as Error).message})`);
      }
    }
    const chipShipmentDocs = ["TC-2026-ADN-0042.pdf", "INV-ADN-2026-0881.pdf", "WB-GZT-1182.pdf"]
      .map((f) => (documents[f] as { checked: Parameters<typeof crossCheckShipment>[0][number] } | undefined)?.checked)
      .filter((x) => x !== undefined);
    const shipmentCrossCheck = crossCheckShipment(chipShipmentDocs);

    // -- save the run
    const out = {
      chainId,
      ledger,
      rpcUrl: url.startsWith("http://127.0.0.1") ? "http://127.0.0.1:8545" : url,
      deployTx: deployHash,
      deployBlock,
      ranAt: new Date().toISOString(),
      accounts: Object.fromEntries(NAMES.map((n) => [n, acct[n].address])),
      lots: { bale, bale2, flake, chip, flake2, chip2, chipsAtSpinner, chipsAtCoal, coalYarn, yarn, yarnAtMill, fabric, fabricAtMaker, garment, garmentAtBrand },
      refusals: { certificateReuse: reuse, overclaim: { ...overclaim, integrity: fraud.report } },
      passport: {
        lotId: garmentAtBrand,
        recycledBps: passport.recycledBps,
        co2eKgPerKgGarment: passport.co2eGPerKg / 1000,
        claim,
        claimHash: claimHash(claim),
        brandDraftClaim: demo.BRAND_DRAFT_CLAIM,
        claimCheck: checkedClaim,
      },
      fiberComparison: { honestGrid: yarnCmp, coalPowered: coalCmp, garmentRecycledKg: gToKg(g.recycledG) },
      integrityReports: reports,
      evidence,
      evidenceOfLot,
      certifier: { address: acct.certifier.address, pqPublicKey: pq.publicKey, pqPubKeyHashOnChain: onChainPqHash, demoKeys: !process.env.PQ_SEED },
      chain: { lotCount, lots: lotsOnChain, events, yields },
      documents,
      documentsByStep: {
        chipShipment: chipShipmentDocs.map((d) => d.documentName),
        yarnEnergy: ["ELEC-GZT-2026-09.pdf"],
        fraudYarnCertificate: ["TC-2026-GZT-0311-INFLATED.pdf"],
      },
      shipmentCrossCheck,
      steps: demo.STEPS,
      plants: demo.PLANTS,
      transactions: txs,
    };
    const file = resolve(ROOT, "data", chainId === 31337 ? "demo-run.local.json" : `demo-run.${chainId}.json`);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
    log(`\nsaved ${txs.length} transactions to ${file.replace(ROOT + "/", "")}`);
  } finally {
    if (anvil && keep) log("\nlocal chain still running at http://127.0.0.1:8545 (Ctrl+C to stop)");
    else anvil?.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
