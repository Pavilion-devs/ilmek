import { lockClaim, templateClaim } from "@ilmek/ai/browser";
import { STAGE_NAME, processCo2eG, type StepRecord } from "@ilmek/core";
import { useMemo, useState } from "react";
import { DocCard, Findings } from "../components/Doc";
import { Badge, Bar, Button, Card, Hash, RecordedNote, Section } from "../components/ui";
import { kgFromG, plantById, run, t } from "../run";

// ------------------------------------------------------------------ shared

function StepCard({ step, lotId, title }: { step: StepRecord; lotId?: string; title: string }) {
  const plant = plantById(step.plantId);
  const report = run.integrityReports[step.id];
  const co2 = processCo2eG(step.electricityKwh, step.heatMJ, plant?.gridGPerKwh) / 1e6;
  const inKg = step.inputs.reduce((a, i) => a + i.kg, 0);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-semibold">{title}</div>
          <div className="text-xs text-muted">
            {plant?.name} · {step.id}
            {lotId && ` · lot ${lotId}`}
          </div>
        </div>
        <Badge tone={report?.verdict === "fail" ? "bad" : report?.verdict === "warn" ? "warn" : "ok"}>
          {report?.verdict === "fail" ? "Fails integrity" : report?.verdict === "warn" ? "Warnings" : "Passes integrity"}
        </Badge>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs text-muted">In</dt>
          <dd className="tabular">
            {t(inKg)} {STAGE_NAME[step.from]}
            {step.virginKg > 0 && <div className="text-xs text-muted">+ {t(step.virginKg)} virgin</div>}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Out</dt>
          <dd className="tabular">
            {t(step.outputKg)} {STAGE_NAME[step.to]}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Recycled out</dt>
          <dd className="tabular">
            {t(step.outputRecycledKg)} ({Math.round((step.outputRecycledKg / step.outputKg) * 100)}%)
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Step emissions</dt>
          <dd className="tabular">{co2.toFixed(1)} t CO₂e</dd>
        </div>
      </dl>
      {report && report.findings.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <Findings findings={report.findings} />
        </div>
      )}
    </Card>
  );
}

const doc = (name: string) => run.documents[name];

// ------------------------------------------------------------------ recycler

export function Recycler() {
  const L = run.lots;
  const bale = run.chain.lots[L.bale!]!;
  return (
    <>
      <Section title="Certified bottle bales in, recycled chips out" intro="A certifier registers the incoming bales against their transaction certificate. Each processing step then consumes its input lot on the ledger.">
        <div className="grid gap-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="font-semibold">Bottle bales registered by the certifier</div>
                <div className="text-xs text-muted">Certificate TC-2026-IST-0117 · lot {L.bale}</div>
              </div>
              <Badge tone="ok">Certified input</Badge>
            </div>
            <div className="mt-3 text-sm tabular">{t(kgFromG(bale.totalG))} post-consumer PET bottle bales, collected in Istanbul</div>
          </Card>
          <StepCard step={run.steps.flake!} lotId={L.flake} title="Washing and flaking" />
          <StepCard step={run.steps.chip!} lotId={L.chip} title="Extrusion to recycled chip" />
        </div>
      </Section>

      <Section
        title="Shipping 30 t of chips to Gaziantep"
        intro="Three documents travel with the shipment. Claude reads each one; every value comes with a quote that code finds in the PDF, and the three documents must agree with each other."
      >
        <div className="grid gap-3">
          {run.documentsByStep.chipShipment.map((n, i) => doc(n) && <DocCard key={n} doc={doc(n)!} defaultOpen={i === 0} />)}
        </div>
        <Card className="mt-4 flex items-center gap-3 p-4 text-sm">
          {run.shipmentCrossCheck.length === 0 ? (
            <>
              <Badge tone="ok">Documents agree</Badge> Certificate, invoice and weighbridge ticket all report 30,000 kg of product.
            </>
          ) : (
            run.shipmentCrossCheck.map((f) => <span key={f.message}>{f.message}</span>)
          )}
        </Card>
        <Card className="mt-4 p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-semibold">Same certificate, second buyer</div>
            <Badge tone="bad">Refused by the ledger</Badge>
          </div>
          <p className="mt-2 text-sm text-muted">
            The recycler tries to ship 20 t more chips to Kahramanmaraş on TC-2026-ADN-0042. The contract has already marked that certificate as
            used.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <code className="rounded bg-ink/5 px-1.5 py-0.5 font-mono text-bad">{run.refusals.certificateReuse.errorName}</code>
            <Hash value={run.refusals.certificateReuse.txHash} />
          </div>
        </Card>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ spinner

export function Spinner() {
  const fraud = run.refusals.overclaim;
  const [claimed, allowed] = fraud.errorArgs.map((g) => Number(g) / 1000);
  const inflated = doc(run.documentsByStep.fraudYarnCertificate[0]!);
  return (
    <>
      <Section
        title="The over-claim"
        intro="Same inputs as the honest run: 30 t of certified recycled chips plus 22 t of virgin chips. But the spinner wants to sell all 50 t of yarn as recycled."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <StepCard step={run.steps.yarnFraud!} title="Yarn claimed as 100% recycled" />
          <Card className="p-5">
            <div className="font-semibold">What happens next</div>
            <ol className="mt-4 space-y-4 text-sm">
              <li className="flex gap-3">
                <Badge tone="bad" dot={false}>1</Badge>
                <span>The integrity engine fails the step and explains why, in plain words (left).</span>
              </li>
              <li className="flex gap-3">
                <Badge tone="warn" dot={false}>2</Badge>
                <span>We play a bribed certifier: it signs the step anyway, with a valid EIP-712 signature.</span>
              </li>
              <li className="flex gap-3">
                <Badge tone="ok" dot={false}>3</Badge>
                <span>
                  The contract checks the physics itself and refuses: <code className="font-mono text-bad">{fraud.errorName}</code>.
                </span>
              </li>
            </ol>
            <div className="mt-5 space-y-3">
              <Bar label="Claimed" value={claimed!} max={claimed!} tone="bad" right={t(claimed!)} />
              <Bar label="Allowed by the ledger" value={allowed!} max={claimed!} tone="ok" right={t(allowed!)} />
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted">
              Reverted transaction <Hash value={fraud.txHash} />
            </div>
          </Card>
        </div>
      </Section>

      {inflated && (
        <Section
          title="The paperwork looks clean"
          intro="This is the certificate the spinner prepared for the fabric mill. Every field checks out against the PDF and the AI raised no concerns. Nothing on paper is contradictory; only the ledger knows the inputs can't support it."
        >
          <DocCard doc={inflated} defaultOpen />
        </Section>
      )}

      <Section title="The honest run" intro="What the spinner actually made: 57.6% recycled yarn, within what its inputs allow. Its electricity bill backs the carbon figure.">
        <div className="grid gap-4">
          <StepCard step={run.steps.yarn!} lotId={run.lots.yarn} title="Yarn, honestly labelled" />
          {run.documentsByStep.yarnEnergy.map((n) => doc(n) && <DocCard key={n} doc={doc(n)!} />)}
        </div>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ certifier

export function Certifier() {
  const steps = Object.values(run.steps);
  return (
    <>
      <Section
        title="Review queue"
        intro="Every step arrives with the integrity engine's report. The certifier decides and signs twice: an EIP-712 signature the contract checks, and a post-quantum ML-DSA-44 signature over the evidence that anyone can check in a browser."
      >
        <div className="grid gap-3">
          {steps.map((s) => {
            const r = run.integrityReports[s.id];
            const plant = plantById(s.plantId);
            const onLedger = Object.values(run.evidenceOfLot).includes(s.id);
            return (
              <details key={s.id} className="group rounded-2xl border border-line bg-card">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-4">
                  <div className="min-w-0">
                    <div className="font-mono text-sm">{s.id}</div>
                    <div className="text-xs text-muted">
                      {plant?.name} · {STAGE_NAME[s.from]} → {STAGE_NAME[s.to]} · {t(s.outputKg)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone={r?.verdict === "fail" ? "bad" : r?.verdict === "warn" ? "warn" : "ok"}>{r?.verdict === "fail" ? "Fail" : r?.verdict === "warn" ? "Warn" : "Pass"}</Badge>
                    <Badge tone={onLedger ? "ok" : "bad"}>{onLedger ? "On ledger" : "Refused by ledger"}</Badge>
                  </div>
                </summary>
                <div className="border-t border-line p-4">
                  <Findings findings={r?.findings ?? []} />
                </div>
              </details>
            );
          })}
        </div>
      </Section>
      <Section title="The certifier's keys">
        <Card className="p-5 text-sm">
          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted">Ledger address (ECDSA, approves steps on-chain)</dt>
              <dd className="mt-1">
                <Hash value={run.certifier.address} kind="address" />
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">ML-DSA-44 public key hash stored on the ledger</dt>
              <dd className="mt-1">
                <Hash value={run.certifier.pqPubKeyHashOnChain} kind="plain" />
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-muted">
            Evidence must stay checkable for years, longer than ECDSA may survive a large quantum computer. The ML-DSA-44 key (1,312 bytes) is
            too large to verify on-chain, so the ledger stores its hash and browsers verify the signatures.
            {run.certifier.demoKeys && " These are demo keys derived from a public phrase: fine for a prototype, not for production."}
          </p>
        </Card>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ brand

const VERDICT = {
  "banned-generic": { tone: "bad" as const, text: "Banned: generic claim" },
  unsupported: { tone: "warn" as const, text: "Not supported by the passport" },
  supported: { tone: "ok" as const, text: "Supported" },
};

export function Brand() {
  const cc = run.passport.claimCheck;
  const [draft, setDraft] = useState("Shell fabric: 57% recycled polyester. Eco-friendly and 100% planet-positive!");
  const lock = useMemo(() => lockClaim(draft, cc.facts), [draft, cc.facts]);
  return (
    <>
      <Section
        title="From “eco-friendly” to provable"
        intro="The brand pastes its draft label. Claude sorts each phrase under the EU rules in force since 27 September 2026 and drafts a replacement. Code then locks every number to the passport before the label is accepted."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <div className="text-xs text-muted">Brand's draft</div>
            <p className="mt-1 text-lg">“{cc.draft}”</p>
            <ul className="mt-4 space-y-3">
              {(cc.final.review?.phrases ?? []).map((p) => (
                <li key={p.text} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">“{p.text}”</span>
                    <Badge tone={VERDICT[p.verdict].tone}>{VERDICT[p.verdict].text}</Badge>
                  </div>
                  <div className="mt-0.5 text-muted">{p.reason}</div>
                </li>
              ))}
            </ul>
            <div className="mt-4">
              <RecordedNote {...cc.provenance} />
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs text-muted">Label on the passport</div>
              <Badge tone="ok">{cc.final.source === "ai-rewrite" ? "AI rewrite, passed the lock" : "Safe template"}</Badge>
            </div>
            <p className="mt-1 text-lg">“{run.passport.claim}”</p>
            <div className="mt-4 text-sm text-muted">Numbers the label may use, exactly as written:</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {[`${cc.facts.recycledPercent}%`, `${cc.facts.fiberCo2eKgPerKg.toFixed(1)} kg`, `${cc.facts.virginFiberCo2eKgPerKg.toFixed(1)} kg`, `${cc.facts.fiberSavingPercent}%`].map((n) => (
                <code key={n} className="rounded bg-ink/5 px-2 py-0.5 font-mono text-xs">
                  {n}
                </code>
              ))}
            </div>
            <div className="mt-5">
              <Button href="#/app/passport">Open the passport</Button>
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Try a label yourself" intro="The number lock runs right here in your browser. It is the last gate before any text, from a person or from the AI, reaches the passport.">
        <Card className="p-5">
          <label htmlFor="draft" className="text-sm font-medium">
            Label text
          </label>
          <textarea
            id="draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            className="mt-2 w-full rounded-xl border border-line bg-paper p-3 text-sm outline-none focus:border-accent"
          />
          <div className="mt-3" aria-live="polite">
            {lock.ok ? (
              <Badge tone="ok">Passes: every number is proven and no generic green words</Badge>
            ) : (
              <ul className="space-y-1 text-sm">
                {lock.problems.map((p) => (
                  <li key={p} className="flex gap-2">
                    <span className="text-bad">✕</span>
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {!lock.ok && (
            <p className="mt-3 text-sm text-muted">
              The passport would use the safe template instead: <span className="text-ink">“{templateClaim(cc.facts)}”</span>
            </p>
          )}
        </Card>
      </Section>
    </>
  );
}

