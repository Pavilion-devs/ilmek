import type { CheckedField } from "@ilmek/ai/browser";
import type { Finding } from "@ilmek/core";
import { useState } from "react";
import type { ProcessedDoc } from "../run";
import { Badge, Card, RecordedNote, StatusIcon } from "./ui";

const FIELD_LABEL: Record<string, string> = {
  documentNumber: "Document number",
  issuer: "Issued by",
  seller: "Seller",
  buyer: "Buyer",
  product: "Product",
  date: "Date",
  grossWeightKg: "Gross weight (kg)",
  netWeightKg: "Net weight (kg)",
  recycledContentPercent: "Recycled content (%)",
  recycledWeightKg: "Recycled weight (kg)",
  certificateReference: "Certificate reference",
  invoiceReference: "Invoice reference",
  electricityKwh: "Electricity (kWh)",
  meterNumber: "Meter",
};

const STATUS: Record<CheckedField["status"], { tone: "ok" | "bad" | "warn"; text: string }> = {
  verified: { tone: "ok", text: "Quote found in PDF" },
  "quote-not-found": { tone: "bad", text: "Quote not in document" },
  "value-not-in-quote": { tone: "bad", text: "Value not in quote" },
  "needs-person": { tone: "warn", text: "Needs a person" },
};

const DOC_TYPE: Record<string, string> = {
  "transaction-certificate": "Transaction certificate",
  invoice: "Invoice",
  "weighbridge-ticket": "Weighbridge ticket",
  "electricity-bill": "Electricity bill",
  other: "Document",
};

export function DocCard({ doc, defaultOpen = false }: { doc: ProcessedDoc; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const c = doc.checked;
  const verified = c.fields.filter((f) => f.status === "verified").length;
  return (
    <Card className="overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-start justify-between gap-3 p-4 text-left" aria-expanded={open}>
        <div className="min-w-0">
          <div className="text-xs text-muted">{DOC_TYPE[c.documentType] ?? c.documentType}</div>
          <div className="truncate font-mono text-sm">{c.documentName}</div>
          <div className="mt-1">
            <RecordedNote {...doc.provenance} />
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <Badge tone={c.allVerified ? "ok" : "warn"}>
            {verified}/{c.fields.length} fields checked
          </Badge>
          <span className="text-xs text-muted">{open ? "Hide" : "Show"} fields</span>
        </div>
      </button>
      {open && (
        <div className="border-t border-line">
          <ul className="divide-y divide-line">
            {c.fields.map((f, i) => (
              <li key={i} className="grid gap-1 px-4 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-start sm:gap-4">
                <div className="text-xs text-muted">{FIELD_LABEL[f.name] ?? f.name}</div>
                <div className="min-w-0">
                  <div className="break-words text-sm font-medium">{f.value}</div>
                  <div className="mt-0.5 break-words text-xs text-muted">
                    “{f.quote}” <span className="whitespace-nowrap">· page {f.foundOnPage ?? f.page}</span>
                  </div>
                </div>
                <div>
                  <Badge tone={STATUS[f.status].tone}>{STATUS[f.status].text}</Badge>
                </div>
              </li>
            ))}
          </ul>
          {c.concerns.length > 0 && (
            <div className="border-t border-line px-4 py-3 text-sm">
              <div className="text-xs font-medium text-warn">Concerns raised by the AI</div>
              <ul className="mt-1 list-disc pl-5">
                {c.concerns.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          )}
          <a href={`./sample-docs/${c.documentName}`} target="_blank" rel="noreferrer" className="block border-t border-line px-4 py-2.5 text-xs text-accent hover:underline">
            Open the PDF
          </a>
        </div>
      )}
    </Card>
  );
}

export function Findings({ findings, empty = "All integrity checks passed." }: { findings: Finding[]; empty?: string }) {
  if (!findings.length)
    return (
      <div className="flex items-center gap-2 text-sm">
        <StatusIcon status="pass" />
        {empty}
      </div>
    );
  return (
    <ul className="space-y-3">
      {findings.map((f, i) => (
        <li key={i} className="flex gap-3 text-sm">
          <StatusIcon status={f.severity === "fail" ? "fail" : "warn"} />
          <div>
            <div className="font-mono text-xs text-muted">{f.code}</div>
            <div>{f.message}</div>
            {f.hiddenCo2eKg !== undefined && (
              <div className="mt-1 text-xs text-muted">
                CO₂e hidden by the false label: about {(f.hiddenCo2eKg / 1000).toFixed(1)} t (virgin vs recycled fiber footprint).
              </div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
