import { VIRGIN_POLYESTER_FIBER_KG_PER_KG } from "@ilmek/core";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { hops } from "../components/Journey";
import { Badge, Bar, Button, Card } from "../components/ui";
import { chainName, run } from "../run";

function Qr({ text }: { text: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(text, { type: "svg", margin: 1, color: { dark: "#1c1917", light: "#ffffff" } }).then(setSvg);
  }, [text]);
  return <div className="h-32 w-32 overflow-hidden rounded-lg bg-white p-1" role="img" aria-label="QR code linking to this passport" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function Passport({ lotId, verifyHref }: { lotId: string; verifyHref?: string }) {
  if (lotId !== String(run.passport.lotId)) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-semibold">No passport for lot {lotId}</h1>
        <p className="mt-2 text-muted">This demo has one passport.</p>
        <div className="mt-6">
          <Button href={`#/passport/${run.passport.lotId}`}>Open lot {run.passport.lotId}</Button>
        </div>
      </div>
    );
  }
  const p = run.passport;
  const fiber = run.fiberComparison.honestGrid;
  const pct = Math.floor(p.recycledBps / 100);
  const url = `${window.location.origin}${window.location.pathname}#/passport/${p.lotId}`;
  const journey = hops();

  return (
    <div className="mx-auto max-w-xl py-6">
      <Card className="overflow-hidden">
        <div className="bg-accent px-6 py-5 text-accent-ink">
          <div className="text-xs uppercase tracking-[0.14em] opacity-80">Digital product passport</div>
          <div className="mt-1 text-xl font-semibold">Shell jacket · lot {p.lotId}</div>
          <div className="text-sm opacity-90">Brand · Amsterdam (demo)</div>
        </div>

        <div className="p-6">
          <div className="flex items-end gap-3">
            <div className="text-6xl font-semibold tracking-tight tabular">{pct}%</div>
            <div className="pb-2">
              <div className="font-medium">recycled polyester</div>
              <div className="text-sm text-muted">shell fabric</div>
            </div>
          </div>
          <div className="mt-2">
            <Badge tone="ok">Verified on the ledger, bale to garment</Badge>
          </div>

          <blockquote className="mt-6 border-l-2 border-accent pl-4 text-[15px]">{p.claim}</blockquote>

          <div className="mt-7">
            <div className="text-sm font-medium">Fiber carbon footprint</div>
            <div className="mt-3 space-y-3">
              <Bar label="This jacket's fiber" value={fiber.actualKgPerKg} max={5} tone="ok" right={`${fiber.actualKgPerKg.toFixed(1)} kg CO₂e/kg`} />
              <Bar label="Virgin polyester fiber" value={VIRGIN_POLYESTER_FIBER_KG_PER_KG} max={5} tone="muted" right={`${VIRGIN_POLYESTER_FIBER_KG_PER_KG.toFixed(1)} kg CO₂e/kg`} />
            </div>
            <p className="mt-2 text-xs text-muted">
              Measured from each plant's real energy use. Whole garment, including dyeing and sewing: {p.co2eKgPerKgGarment.toFixed(1)} kg CO₂e per kg.
            </p>
          </div>

          <div className="mt-7">
            <div className="text-sm font-medium">Where it was made</div>
            <ol className="mt-3 space-y-0">
              {journey.map((h, i) => (
                <li key={h.lotId} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-accent" />
                    {i < journey.length - 1 && <span className="w-px flex-1 bg-line" />}
                  </div>
                  <div className="pb-4">
                    <div className="text-sm font-medium">{h.city}</div>
                    <div className="text-xs text-muted">{h.role}</div>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="mt-4 flex flex-col gap-4 rounded-xl bg-ink/5 p-4 sm:flex-row sm:items-center">
            <Qr text={url} />
            <div className="text-sm">
              <div className="font-medium">Don't take our word for it</div>
              <p className="mt-1 text-muted">Your browser can check this passport against the {chainName()} itself, including every certifier signature.</p>
              <div className="mt-3">
                <Button href={verifyHref ?? `#/verify/${p.lotId}`}>Verify this passport</Button>
              </div>
            </div>
          </div>
        </div>
      </Card>
      <p className="mt-4 text-center text-xs text-muted">Supplier names are kept private; each party appears by role and city.</p>
    </div>
  );
}
