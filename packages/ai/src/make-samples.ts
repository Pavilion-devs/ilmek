/**
 * Generates the demo documents in data/sample-docs/. Every page says it is a demo with fictional
 * companies. The numbers match the demo supply chain in @ilmek/core.
 *
 *   pnpm --filter @ilmek/ai samples
 */
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";

const require = createRequire(import.meta.url);
const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
/** fontkit applies ligatures by default; an object turns them off so "fi" stays two letters for text extraction. */
const NO_LIGATURES = { liga: false, clig: false } as unknown as PDFKit.Mixins.OpenTypeFeatures[];
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "../../../data/sample-docs");

type Row = [string, string];

interface Doc {
  file: string;
  title: string;
  subtitle: string;
  sections: { heading: string; rows: Row[] }[];
  footer: string;
}

const DEMO = "DEMO DOCUMENT · fictional companies · made for the Ilmek hackathon prototype";

const docs: Doc[] = [
  {
    file: "TC-2026-ADN-0042.pdf",
    title: "Recycled Content Transaction Certificate",
    subtitle: "Demo format modelled on recycled-content standards (not an official certificate)",
    sections: [
      {
        heading: "Certificate",
        rows: [
          ["Certificate number", "TC-2026-ADN-0042"],
          ["Issued by", "Demo Certification Body Ltd."],
          ["Date of issue", "18 September 2026"],
          ["Scope certificate of seller", "SC-ADN-CHIP-0915"],
        ],
      },
      {
        heading: "Parties",
        rows: [
          ["Seller", "Recycler · Adana (demo), Hacı Sabancı OSB, Adana, Türkiye"],
          ["Buyer", "Spinner · Gaziantep (demo), 4. OSB, Gaziantep, Türkiye"],
        ],
      },
      {
        heading: "Shipment",
        rows: [
          ["Product", "Recycled PET chip, bottle grade, post-consumer"],
          ["Shipment date", "18 September 2026"],
          ["Invoice reference", "INV-ADN-2026-0881"],
          ["Gross weight", "30,240 kg"],
          ["Net weight", "30,000 kg"],
          ["Certified recycled content", "100% post-consumer recycled PET"],
          ["Certified recycled weight", "30,000 kg"],
        ],
      },
    ],
    footer: "This certificate covers only the shipment listed above and may be used once.",
  },
  {
    file: "INV-ADN-2026-0881.pdf",
    title: "Commercial Invoice",
    subtitle: "Fatura / Invoice",
    sections: [
      {
        heading: "Invoice",
        rows: [
          ["Invoice number", "INV-ADN-2026-0881"],
          ["Invoice date", "18 September 2026"],
          ["Seller", "Recycler · Adana (demo)"],
          ["Buyer", "Spinner · Gaziantep (demo)"],
        ],
      },
      {
        heading: "Lines",
        rows: [
          ["Item", "rPET chip, bottle grade, 24 big bags"],
          ["Quantity", "30,000 kg"],
          ["Unit price", "EUR 1.12 per kg"],
          ["Total (excl. VAT)", "EUR 33,600.00"],
          ["Certificate", "Recycled content TC-2026-ADN-0042"],
        ],
      },
    ],
    footer: "Payment terms: 60 days.",
  },
  {
    file: "WB-GZT-1182.pdf",
    title: "Weighbridge Ticket",
    subtitle: "Kantar fişi (Türkçe / English)",
    sections: [
      {
        heading: "Ticket",
        rows: [
          ["Ticket number", "WB-GZT-1182"],
          ["Site", "Spinner · Gaziantep (demo), goods-in weighbridge 2"],
          ["Date and time in", "18 September 2026 14:05"],
          ["Vehicle plate", "01 ADN 482 (demo)"],
          ["Delivery note", "Ref. INV-ADN-2026-0881"],
        ],
      },
      {
        heading: "Weights",
        rows: [
          ["First weighing (loaded)", "45,860 kg"],
          ["Second weighing (empty)", "15,620 kg"],
          ["Net weight", "30,240 kg"],
          ["Packaging (24 big bags)", "240 kg"],
          ["Net product weight", "30,000 kg"],
        ],
      },
    ],
    footer: "Weighbridge calibrated 02 March 2026 (demo).",
  },
  {
    file: "ELEC-GZT-2026-09.pdf",
    title: "Electricity Bill",
    subtitle: "Elektrik faturası, September 2026",
    sections: [
      {
        heading: "Account",
        rows: [
          ["Customer", "Spinner · Gaziantep (demo)"],
          ["Meter number", "MTR-GZT-77210"],
          ["Billing period", "1 September 2026 to 30 September 2026"],
        ],
      },
      {
        heading: "Consumption",
        rows: [
          ["Previous reading", "1,284,500 kWh"],
          ["Current reading", "1,524,500 kWh"],
          ["Consumption this period", "240,000 kWh"],
          ["Of which yarn line 3 (sub-meter MTR-GZT-77210-L3)", "110,000 kWh"],
        ],
      },
    ],
    footer: "Supplied from the national grid.",
  },
  {
    file: "TC-2026-GZT-0311-INFLATED.pdf",
    title: "Recycled Content Transaction Certificate",
    subtitle: "Demo format modelled on recycled-content standards (not an official certificate)",
    sections: [
      {
        heading: "Certificate",
        rows: [
          ["Certificate number", "TC-2026-GZT-0311"],
          ["Issued by", "Demo Certification Body Ltd."],
          ["Date of issue", "26 September 2026"],
          ["Scope certificate of seller", "SC-GZT-YARN-0926-X"],
        ],
      },
      {
        heading: "Parties",
        rows: [
          ["Seller", "Spinner · Gaziantep (demo)"],
          ["Buyer", "Fabric mill · Bursa (demo)"],
        ],
      },
      {
        heading: "Shipment",
        rows: [
          ["Product", "Polyester filament yarn, 150 denier, textured"],
          ["Shipment date", "26 September 2026"],
          ["Net weight", "50,000 kg"],
          ["Certified recycled content", "100% post-consumer recycled PET"],
          ["Certified recycled weight", "50,000 kg"],
        ],
      },
    ],
    footer: "This certificate covers only the shipment listed above and may be used once.",
  },
];

function render(doc: Doc): Promise<void> {
  return new Promise((done, fail) => {
    const pdf = new PDFDocument({ size: "A4", margin: 56, info: { Title: `${doc.title} (demo)` } });
    const stream = createWriteStream(resolve(OUT, doc.file));
    stream.on("finish", () => done());
    stream.on("error", fail);
    pdf.pipe(stream);
    pdf.registerFont("body", FONT);
    pdf.registerFont("bold", FONT_BOLD);
    pdf.font("body");

    pdf.fontSize(8).fillColor("#b42318").text(DEMO, 56, pdf.y, { align: "center", features: NO_LIGATURES });
    pdf.moveDown(1.2);
    pdf.font("bold").fontSize(18).fillColor("#111").text(doc.title, { features: NO_LIGATURES });
    pdf.font("body");
    pdf.fontSize(10).fillColor("#555").text(doc.subtitle, { features: NO_LIGATURES });
    pdf.moveDown(1);

    for (const s of doc.sections) {
      pdf.font("bold").fontSize(10).fillColor("#111").text(s.heading.toUpperCase(), 56, pdf.y, { characterSpacing: 1, features: NO_LIGATURES });
      pdf.font("body");
      pdf.moveDown(0.3);
      for (const [k, v] of s.rows) {
        const y = pdf.y;
        pdf.fontSize(10).fillColor("#555").text(k, 56, y, { width: 190, features: NO_LIGATURES });
        pdf.fillColor("#111").text(v, 256, y, { width: 283, features: NO_LIGATURES });
        pdf.moveDown(0.4);
      }
      pdf.moveDown(0.8);
    }
    pdf.fontSize(9).fillColor("#555").text(doc.footer, 56, pdf.y, { features: NO_LIGATURES });
    pdf.moveDown(2);
    pdf.fontSize(8).fillColor("#b42318").text(DEMO, 56, pdf.y, { align: "center", features: NO_LIGATURES });
    pdf.end();
  });
}

mkdirSync(OUT, { recursive: true });
await Promise.all(docs.map(render));
console.log(`wrote ${docs.length} demo documents to data/sample-docs/`);
