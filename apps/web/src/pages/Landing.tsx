import { VIRGIN_POLYESTER_FIBER_KG_PER_KG } from "@ilmek/core";
import { Logo } from "../components/Logo";
import { Weave } from "../components/Weave";
import { Badge, Bar, Button, Card, Hash, Icon, Ring, type IconName } from "../components/ui";
import { chainName, run, t } from "../run";

const passportHref = `#/app/passport`;

export function Landing() {
  const { overclaim, certificateReuse } = run.refusals;
  const [claimed, allowed] = overclaim.errorArgs.map((g) => Number(g) / 1000);
  const fc = run.fiberComparison;
  const pct = Math.floor(run.passport.recycledBps / 100);
  const docs = Object.values(run.documents);
  const fields = docs.reduce((a, d) => a + d.checked.fields.length, 0);
  const verifiedFields = docs.reduce((a, d) => a + d.checked.fields.filter((f) => f.status === "verified").length, 0);

  return (
    <div className="min-h-screen">
      {/* nav */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-page items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="hidden items-center gap-7 text-sm text-muted md:flex" aria-label="Sections">
            <a href="#proof" className="hover:text-ink">Proof</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#carbon" className="hover:text-ink">Carbon</a>
          </nav>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex">
              <Button href={passportHref} variant="ghost">Scan a passport</Button>
            </span>
            <Button href="#/app" icon="arrow">Open dashboard</Button>
          </div>
        </div>
      </header>

      <main>
        {/* hero */}
        <section className="mx-auto max-w-page px-4 pb-10 pt-14 text-center sm:px-6 sm:pt-20">
          <div className="rise inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1.5 text-xs text-muted shadow-soft">
            <span className="h-1.5 w-1.5 rounded-full bg-accent" /> IEEE ClimateChain 2026 · Sustainable Supply Chains
          </div>
          <h1 className="rise rise-1 mx-auto mt-6 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-7xl">
            Every kilo of recycled fiber, counted once.
          </h1>
          <p className="rise rise-2 mx-auto mt-6 max-w-2xl text-lg text-muted">
            Ilmek proves a garment's “recycled” claim from the bottle bale to the label. The ledger refuses any step that makes more recycled fiber than
            physically came in, and every passport shows the carbon actually measured.
          </p>
          <div className="rise rise-3 mt-8 flex flex-wrap justify-center gap-3">
            <Button href="#/app" icon="arrow">Open the dashboard</Button>
            <Button href="#proof" variant="ghost">See the fraud get refused</Button>
          </div>
        </section>

        {/* woven panel with live cards */}
        <section className="rise rise-4 mx-auto max-w-page px-4 sm:px-6">
          <div className="relative overflow-hidden rounded-[28px] shadow-lift">
            <Weave className="h-[460px] w-full sm:h-[520px]" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
            <div className="absolute inset-x-0 bottom-0 grid gap-3 p-4 sm:grid-cols-3 sm:p-6">
              <Glass>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-ink/70">Recycled polyester, shell fabric</div>
                    <div className="mt-1 text-3xl font-semibold tracking-tight tabular">{pct}%</div>
                  </div>
                  <Ring value={pct / 100} tone="ok" label={<Icon name="check" className="h-4 w-4 text-ok" />} />
                </div>
                <div className="mt-2 text-xs text-ink/70">Verified bale to garment · lot {run.passport.lotId}</div>
              </Glass>
              <Glass>
                <div className="text-xs text-ink/70">Fiber footprint</div>
                <div className="mt-1 text-3xl font-semibold tracking-tight tabular">
                  {fc.honestGrid.actualKgPerKg.toFixed(1)} <span className="text-base font-medium">kg CO₂e/kg</span>
                </div>
                <div className="mt-2 text-xs text-ink/70">{Math.round(fc.honestGrid.savingShare * 100)}% below virgin polyester ({VIRGIN_POLYESTER_FIBER_KG_PER_KG.toFixed(1)})</div>
              </Glass>
              <Glass>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs text-ink/70">Spinner · Gaziantep</div>
                  <Badge tone="bad">Refused</Badge>
                </div>
                <div className="mt-1 font-mono text-sm font-medium text-bad">{overclaim.errorName}</div>
                <div className="mt-2 text-xs text-ink/70">
                  {t(claimed!)} “recycled” claimed · {t(allowed!)} possible
                </div>
              </Glass>
            </div>
          </div>
        </section>

        {/* built on */}
        <section className="mx-auto max-w-page px-4 py-10 sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted">
            <span className="text-xs uppercase tracking-[0.12em]">Built on</span>
            {[`Smart contract on ${chainName()}`, "ML-DSA-44 · FIPS 204", "EU Directive 2024/825", "Claude document reading", "Textile Exchange LCA"].map((x) => (
              <span key={x} className="font-medium text-ink/70">{x}</span>
            ))}
          </div>
        </section>

        {/* numbers */}
        <section className="mx-auto max-w-page px-4 sm:px-6">
          <div className="grid grid-cols-2 divide-line rounded-[24px] border border-line bg-card shadow-soft lg:grid-cols-4 lg:divide-x">
            {[
              ["62%", "of tested “recycled” polyester didn't contain the recycled content claimed", "Lab-testing study, Apparel Insider"],
              ["27.09.26", "EU ban on generic green claims took effect", "Directive (EU) 2024/825"],
              ["#2", "Türkiye's rank among EU textile suppliers", "≈17.6% of EU textile imports"],
              [`${verifiedFields}/${fields}`, "document fields read by AI and confirmed against the PDF", "Every value backed by a quote"],
            ].map(([n, l, s], i) => (
              <div key={n} className={`p-6 sm:p-8 ${i < 2 ? "border-b border-line lg:border-b-0" : ""} ${i % 2 === 0 ? "border-r border-line lg:border-r-0" : ""}`}>
                <div className="text-4xl font-semibold tracking-[-0.03em] tabular sm:text-5xl">{n}</div>
                <div className="mt-3 text-sm">{l}</div>
                <div className="mt-1 text-xs text-muted">{s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* proof */}
        <section id="proof" className="mx-auto grid max-w-page scroll-mt-20 items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <Kicker>Fraud, refused on-chain</Kicker>
            <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Paperwork can't catch it. Physics can.</h2>
            <p className="mt-5 text-lg text-muted">
              The spinner's certificate says 50 t net, 50 t recycled. It's internally consistent, and Claude read it without finding a single problem.
              But only 30 t of certified recycled chips ever arrived.
            </p>
            <ul className="mt-6 space-y-3 text-[15px]">
              {[
                "Each step consumes its inputs on the ledger",
                "Recycled out can't exceed recycled in × the best physical yield",
                "Enforced even when a certifier signs it, as a bribed one would",
                "Each shipment certificate works once, so it can't be sold twice",
              ].map((x) => (
                <li key={x} className="flex gap-3">
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand text-brand-ink">
                    <Icon name="check" className="h-3 w-3" />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-muted">Spinner · Gaziantep · {run.steps.yarnFraud?.id}</div>
                  <div className="mt-1 font-semibold">“100% recycled” yarn</div>
                </div>
                <Badge tone="bad">Transaction reverted</Badge>
              </div>
              <div className="mt-6 space-y-4">
                <Bar label="Recycled yarn claimed" value={claimed!} max={claimed!} tone="bad" right={t(claimed!)} />
                <Bar label="Most the certified inputs allow" value={allowed!} max={claimed!} tone="ok" right={t(allowed!)} />
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-2 rounded-xl bg-paper px-3 py-2.5 text-xs">
                <code className="font-mono font-medium text-bad">{overclaim.errorName}</code>
                <span className="text-muted">·</span>
                <Hash value={overclaim.txHash} />
              </div>
            </Card>
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <div className="text-xs text-muted">Recycler · Adana</div>
                <div className="mt-0.5 font-medium">Same certificate shown to a second buyer</div>
              </div>
              <code className="rounded-lg bg-bad/10 px-2 py-1 font-mono text-xs text-bad">{certificateReuse.errorName}</code>
            </Card>
          </div>
        </section>

        {/* how */}
        <section id="how" className="scroll-mt-20 border-y border-line bg-card">
          <div className="mx-auto max-w-page px-4 py-24 sm:px-6">
            <div className="max-w-2xl">
              <Kicker>How it works</Kicker>
              <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">AI reads and explains. Physics and signatures decide.</h2>
            </div>
            <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["doc", "Read", "Claude reads certificates, invoices, weighbridge tickets and meter bills. Every value comes with a quote that code finds in the PDF."],
                  ["shield", "Check", "Eight integrity checks per step: yield, energy per kg, timing, capacity, certificate reuse and sudden jumps, each explained in plain words."],
                  ["key", "Sign & enforce", `The certifier signs with ECDSA and post-quantum ML-DSA-44. The contract on the ${chainName()} still refuses what physics doesn't allow.`],
                  ["qr", "Prove", "The label is checked against EU rules and locked to the ledger's numbers. Anyone can verify the passport in their browser."],
                ] as [IconName, string, string][]
              ).map(([icon, h, p], i) => (
                <div key={h} className="group rounded-2xl border border-line bg-paper p-6 transition-all duration-300 hover:-translate-y-1 hover:bg-card hover:shadow-lift">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-brand-ink">
                      <Icon name={icon} />
                    </span>
                    <span className="font-mono text-xs text-muted">0{i + 1}</span>
                  </div>
                  <div className="mt-8 text-lg font-semibold">{h}</div>
                  <p className="mt-2 text-sm text-muted">{p}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* carbon */}
        <section id="carbon" className="mx-auto max-w-page scroll-mt-20 px-4 py-24 sm:px-6">
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Kicker>Honest carbon</Kicker>
              <h2 className="mt-3 text-4xl font-semibold leading-tight tracking-[-0.03em] sm:text-5xl">Recycled isn't automatically low-carbon.</h2>
              <p className="mt-5 text-lg text-muted">
                The contract carries each lot's CO₂e down the chain from the plant's real energy use. A 100% recycled yarn spun on lignite power saves almost
                nothing, and its passport says so.
              </p>
            </div>
            <Card className="p-7">
              <div className="space-y-6">
                <Bar label={<span>Gaziantep · 58% recycled · grid power</span>} value={fc.honestGrid.actualKgPerKg} max={5} tone="ok" right={`${fc.honestGrid.actualKgPerKg.toFixed(1)} kg`} />
                <Bar label={<span>Kahramanmaraş · 100% recycled · own lignite</span>} value={fc.coalPowered.actualKgPerKg} max={5} tone="accent" right={`${fc.coalPowered.actualKgPerKg.toFixed(1)} kg`} />
                <Bar label="Virgin polyester fiber" value={VIRGIN_POLYESTER_FIBER_KG_PER_KG} max={5} tone="muted" right={`${VIRGIN_POLYESTER_FIBER_KG_PER_KG.toFixed(1)} kg`} />
              </div>
              <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
                kg CO₂e per kg of fiber. Grid 442 g/kWh (Türkiye, 2022), gas 56.1 g/MJ (IPCC), virgin fiber from Textile Exchange's LCA. Shown as information,
                never sold as a credit.
              </p>
            </Card>
          </div>
        </section>

        {/* cta */}
        <section className="mx-auto max-w-page px-4 pb-24 sm:px-6">
          <div className="relative overflow-hidden rounded-[28px] bg-brand px-6 py-14 text-center text-brand-ink sm:px-12">
            <Weave cols={64} rows={14} className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.12]" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">Every lot, every document, every check.</h2>
              <p className="mx-auto mt-4 max-w-xl text-brand-ink/75">Walk the chain from Istanbul bottle bales to an Amsterdam shop, as each party sees it.</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <Button href="#/app" variant="light" icon="arrow">Open the dashboard</Button>
                <a href="#/app/verify" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-5 py-2.5 text-sm font-medium text-white hover:bg-white/10">
                  Verify a passport yourself
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-page flex-col gap-4 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo small />
          <p className="max-w-xl sm:text-right">
            Hackathon prototype for IEEE ClimateChain 2026. Companies are fictional; places, yields and emission factors are real. Ledger on the {chainName()}.
          </p>
        </div>
      </footer>
    </div>
  );
}

function Glass({ children }: { children: React.ReactNode }) {
  return <div className="rounded-2xl border border-white/50 bg-white/75 p-4 text-left text-ink shadow-soft backdrop-blur-md">{children}</div>;
}

function Kicker({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-accent">
      <span className="h-px w-6 bg-accent" />
      {children}
    </p>
  );
}
