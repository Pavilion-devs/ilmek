import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";
import {
  allowedNumbers,
  checkExtraction,
  crossCheckShipment,
  datesIn,
  finalizeClaim,
  lockClaim,
  numbersIn,
  pdfPages,
  processClaim,
  processDocument,
  templateClaim,
  type Extraction,
  type PassportFacts,
} from "../src/index";

/**
 * These tests use hand-written extractions (test fixtures, not model output) against the real demo
 * PDFs, so they check the deterministic guards without calling the API.
 */
const DOCS = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/sample-docs");
const pagesOf = async (f: string) => pdfPages(new Uint8Array(readFileSync(resolve(DOCS, f))));

const field = (name: Extraction["fields"][number]["name"], value: string, quote: string, page = 1) => ({ name, value, quote, page });

const tcFixture: Extraction = {
  documentType: "transaction-certificate",
  fields: [
    field("documentNumber", "TC-2026-ADN-0042", "Certificate number TC-2026-ADN-0042"),
    field("date", "2026-09-18", "18 September 2026"),
    field("seller", "Recycler · Adana (demo), Hacı Sabancı OSB, Adana, Türkiye", "Recycler · Adana (demo), Hacı Sabancı OSB, Adana, Türkiye"),
    field("netWeightKg", "30000", "Net weight 30,000 kg"),
    field("recycledWeightKg", "30000", "Certified recycled weight 30,000 kg"),
    field("recycledContentPercent", "100", "100% post-consumer recycled PET"),
  ],
  concerns: [],
};

describe("extraction checks against the real PDF text", () => {
  let tcPages: string[];
  beforeAll(async () => {
    tcPages = await pagesOf("TC-2026-ADN-0042.pdf");
  });

  test("honest extraction: every field verified, including a value that wraps across lines", () => {
    const r = checkExtraction("TC-2026-ADN-0042.pdf", tcFixture, tcPages);
    expect(r.fields.map((f) => [f.name, f.status])).toEqual(tcFixture.fields.map((f) => [f.name, "verified"]));
    expect(r.allVerified).toBe(true);
  });

  test("a quote that is not in the document is caught", () => {
    const bad = { ...tcFixture, fields: [field("recycledWeightKg", "32000", "Certified recycled weight 32,000 kg")] };
    expect(checkExtraction("tc", bad, tcPages).fields[0]!.status).toBe("quote-not-found");
  });

  test("a real quote with a different value is caught", () => {
    const bad = { ...tcFixture, fields: [field("netWeightKg", "32000", "Net weight 30,000 kg")] };
    expect(checkExtraction("tc", bad, tcPages).fields[0]!.status).toBe("value-not-in-quote");
  });

  test("a quote found on another page is still verified and the page is corrected", () => {
    const moved = { ...tcFixture, fields: [field("netWeightKg", "30000", "Net weight 30,000 kg", 3)] };
    const f = checkExtraction("tc", moved, tcPages).fields[0]!;
    expect(f.status).toBe("verified");
    expect(f.foundOnPage).toBe(1);
  });

  test("fields from a photo always wait for a person", () => {
    const r = checkExtraction("ticket.jpg", tcFixture, null);
    expect(r.fields.every((f) => f.status === "needs-person")).toBe(true);
    expect(r.allVerified).toBe(false);
  });
});

describe("cross-checking the documents of one shipment", () => {
  test("certificate, invoice and weighbridge ticket agree", async () => {
    const tc = checkExtraction("TC", tcFixture, await pagesOf("TC-2026-ADN-0042.pdf"));
    const inv = checkExtraction(
      "INV",
      { documentType: "invoice", fields: [field("netWeightKg", "30000", "Quantity 30,000 kg"), field("certificateReference", "TC-2026-ADN-0042", "Recycled content TC-2026-ADN-0042")], concerns: [] },
      await pagesOf("INV-ADN-2026-0881.pdf"),
    );
    const wb = checkExtraction(
      "WB",
      { documentType: "weighbridge-ticket", fields: [field("netWeightKg", "30000", "Net product weight 30,000 kg")], concerns: [] },
      await pagesOf("WB-GZT-1182.pdf"),
    );
    expect(inv.allVerified && wb.allVerified).toBe(true);
    expect(crossCheckShipment([tc, inv, wb])).toEqual([]);
  });

  test("disagreeing weights fail", () => {
    const mk = (name: string, kg: string) => ({
      documentName: name,
      documentType: "invoice" as const,
      fields: [{ ...field("netWeightKg", kg, ""), status: "verified" as const }],
      concerns: [],
      allVerified: true,
    });
    const f = crossCheckShipment([mk("A", "30000"), mk("B", "32000")]);
    expect(f[0]?.severity).toBe("fail");
    expect(f[0]?.message).toMatch(/disagree/);
  });

  test("the inflated yarn certificate reads as internally consistent: only the ledger catches it", async () => {
    // 50 t net, 50 t recycled: nothing on the paper is contradictory. That's the point of the demo.
    const yarn = checkExtraction(
      "TC-2026-GZT-0311",
      { documentType: "transaction-certificate", fields: [field("netWeightKg", "50000", "Net weight 50,000 kg"), field("recycledWeightKg", "50000", "Certified recycled weight 50,000 kg")], concerns: [] },
      await pagesOf("TC-2026-GZT-0311-INFLATED.pdf"),
    );
    expect(yarn.allVerified).toBe(true);
    expect(crossCheckShipment([yarn])).toEqual([]);
  });
});

describe("dates in text", () => {
  test.each([
    ["18 September 2026 14:05", ["2026-09-18"]],
    ["1 September 2026 to 30 September 2026", ["2026-09-01", "2026-09-30"]],
    ["18 Eylül 2026", ["2026-09-18"]],
    ["issued 2026-09-18", ["2026-09-18"]],
    ["18.09.2026", ["2026-09-18"]],
    ["18 Sept 2026", ["2026-09-18"]],
  ])("%s", (s, d) => expect(datesIn(s)).toEqual(d));
});

describe("numbers in text", () => {
  test.each([
    ["30,240 kg", [30240]],
    ["EUR 1.12 per kg", [1.12]],
    ["1,284,500 kWh", [1284500]],
    ["45.860 kg", [45860]],
    ["57% and 2.7 kg", [57, 2.7]],
  ])("%s", (s, n) => expect(numbersIn(s)).toEqual(n));
});

describe("claim lock", () => {
  const facts: PassportFacts = {
    scope: "Shell fabric",
    recycledPercent: 57,
    recycledMaterial: "recycled polyester",
    fiberCo2eKgPerKg: 2.7,
    virginFiberCo2eKgPerKg: 4.4,
    fiberSavingPercent: 38,
    carbonLabel: "low-carbon",
  };

  test("a factual rewrite passes; CO₂ and CO2e are not read as numbers", () => {
    expect(lockClaim("Shell fabric: 57% recycled polyester, verified. Fiber footprint 2.7 kg CO₂e per kg, 38% below virgin polyester (4.4 kg CO2e).", facts)).toEqual({ ok: true, problems: [] });
  });

  test("a number the passport does not prove fails", () => {
    const r = lockClaim("Shell fabric: 100% recycled polyester.", facts);
    expect(r.ok).toBe(false);
    expect(r.problems[0]).toMatch(/"100"/);
  });

  test("a rounded number fails (3 instead of 2.7)", () => {
    expect(lockClaim("Shell fabric: 57% recycled polyester. About 3 kg CO₂e per kg.", facts).ok).toBe(false);
  });

  test.each(["eco-friendly", "Eco-Friendly", "kind to the planet", "sustainable", "carbon neutral"])("banned term '%s' fails", (term) => {
    expect(lockClaim(`Shell fabric: 57% recycled polyester, ${term}.`, facts).ok).toBe(false);
  });

  test("a claim that does not say which part it covers fails", () => {
    expect(lockClaim("57% recycled polyester, verified.", facts).ok).toBe(false);
  });

  test("the template always passes its own lock, for both carbon labels", () => {
    expect(lockClaim(templateClaim(facts), facts).ok).toBe(true);
    const coal = { ...facts, recycledPercent: 100, fiberCo2eKgPerKg: 4.3, fiberSavingPercent: 2, carbonLabel: "recycled-but-not-low-carbon" as const };
    expect(lockClaim(templateClaim(coal), coal).ok).toBe(true);
    expect(templateClaim(coal)).not.toMatch(/below/);
  });

  test("a rewrite that fails the lock is replaced by the template", () => {
    const final = finalizeClaim({ phrases: [], rewrite: "Eco-friendly jacket, 100% recycled." }, facts);
    expect(final.source).toBe("template");
    expect(final.text).toBe(templateClaim(facts));
  });

  test("allowed numbers are written exactly as the passport shows them", () => {
    expect(allowedNumbers(facts)).toEqual(["57", "2.7", "4.4", "38"]);
  });
});

describe("recorded mode without a recording", () => {
  test("a claim falls back to the template and says no AI was used", async () => {
    const r = await processClaim("Eco jacket", { scope: "Shell fabric", recycledPercent: 57, recycledMaterial: "recycled polyester", fiberCo2eKgPerKg: 2.7, virginFiberCo2eKgPerKg: 4.4, fiberSavingPercent: 38, carbonLabel: "low-carbon" }, { mode: "recorded", id: "test-missing" });
    expect(r.provenance.source).toBe("none");
    expect(r.final.source).toBe("template");
  });

  test("a document without a recording explains how to record it", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "ilmek-"));
    const copy = resolve(dir, "UNRECORDED.pdf");
    writeFileSync(copy, readFileSync(resolve(DOCS, "WB-GZT-1182.pdf")));
    await expect(processDocument(copy, { mode: "recorded" })).rejects.toThrow(/record/);
  });

  test("an edited document does not reuse the old recording", async () => {
    const dir = mkdtempSync(resolve(tmpdir(), "ilmek-"));
    const copy = resolve(dir, "WB-GZT-1182.pdf"); // same name, different bytes
    writeFileSync(copy, Buffer.concat([readFileSync(resolve(DOCS, "WB-GZT-1182.pdf")), Buffer.from("\n% edited")]));
    await expect(processDocument(copy, { mode: "recorded" })).rejects.toThrow(/record/);
  });
});

describe("recorded Claude responses (replayed, no network)", () => {
  test.each(readdirSync(DOCS).filter((f) => f.endsWith(".pdf")))("%s: every extracted field verifies against the PDF", async (f) => {
    const r = await processDocument(resolve(DOCS, f), { mode: "recorded" });
    expect(r.provenance.source).toBe("recorded");
    expect(r.checked.fields.filter((x) => x.status !== "verified")).toEqual([]);
  });

  test("the chip shipment's three documents agree", async () => {
    const docs = await Promise.all(
      ["TC-2026-ADN-0042.pdf", "INV-ADN-2026-0881.pdf", "WB-GZT-1182.pdf"].map((f) => processDocument(resolve(DOCS, f), { mode: "recorded" })),
    );
    expect(crossCheckShipment(docs.map((d) => d.checked))).toEqual([]);
  });
});
