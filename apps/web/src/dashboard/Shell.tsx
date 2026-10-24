import { useEffect, useState, type ReactNode } from "react";
import { Logo } from "../components/Logo";
import { Hash, Icon, type IconName } from "../components/ui";
import { chainName, run } from "../run";

export type AppPage = "home" | "chain" | "recycler" | "spinner" | "certifier" | "brand" | "passport" | "verify";

const NAV: { group: string; items: { key: AppPage; label: string; icon: IconName; hint?: string }[] }[] = [
  {
    group: "Main",
    items: [
      { key: "home", label: "Overview", icon: "home" },
      { key: "chain", label: "Supply chain", icon: "flow" },
    ],
  },
  {
    group: "Workspaces",
    items: [
      { key: "recycler", label: "Recycler", icon: "factory", hint: "Adana" },
      { key: "spinner", label: "Spinner", icon: "spool", hint: "Gaziantep" },
      { key: "certifier", label: "Certifier", icon: "shield", hint: "Review" },
      { key: "brand", label: "Brand", icon: "tag", hint: "Amsterdam" },
    ],
  },
  {
    group: "Public",
    items: [
      { key: "passport", label: "Passport", icon: "qr", hint: `Lot ${run.passport.lotId}` },
      { key: "verify", label: "Verifier", icon: "check" },
    ],
  },
];

export const PAGE_TITLE: Record<AppPage, [string, string]> = {
  home: ["Overview", "One jacket's chain, from Istanbul bottle bales to an Amsterdam shop."],
  chain: ["Supply chain", "Every lot on the ledger, how much of it is recycled, and the carbon it carries."],
  recycler: ["Recycler · Adana", "Certified bottle bales in, recycled chips out, and the documents that travel with them."],
  spinner: ["Spinner · Gaziantep", "The over-claim the ledger refused, and the honest yarn that went on."],
  certifier: ["Certifier", "Every step's integrity report, and the keys used to sign them."],
  brand: ["Brand · Amsterdam", "From “eco-friendly” to a label where every number is proven."],
  passport: ["Passport", "What a shopper sees after scanning the QR code on the jacket."],
  verify: ["Verifier", "Check the passport yourself. Runs in your browser; trusts only the ledger."],
};

function Sidebar({ page, onNavigate }: { page: AppPage; onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <Logo />
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 pb-6" aria-label="Dashboard">
        {NAV.map((g) => (
          <div key={g.group}>
            <div className="px-3 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-muted/80">{g.group}</div>
            <ul className="space-y-0.5">
              {g.items.map((it) => {
                const active = it.key === page;
                return (
                  <li key={it.key}>
                    <a
                      href={it.key === "home" ? "#/app" : `#/app/${it.key}`}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors ${
                        active ? "bg-brand text-brand-ink shadow-soft" : "text-ink/75 hover:bg-ink/[0.04] hover:text-ink"
                      }`}
                    >
                      <Icon name={it.icon} className={`h-[18px] w-[18px] ${active ? "" : "text-muted group-hover:text-ink"}`} />
                      <span className="flex-1">{it.label}</span>
                      {it.hint && <span className={`text-xs ${active ? "text-brand-ink/70" : "text-muted"}`}>{it.hint}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-paper p-4 text-xs">
        <div className="flex items-center gap-2 font-medium">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ok/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-ok" />
          </span>
          Ledger · {chainName()}
        </div>
        <div className="mt-2 text-muted">
          Contract <Hash value={run.ledger} kind="address" />
        </div>
        <div className="mt-1 text-muted">{run.transactions.length} transactions in this run</div>
      </div>
      <a href="#/" className="mx-3 mb-4 flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted hover:bg-ink/[0.04] hover:text-ink">
        <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to the site
      </a>
    </div>
  );
}

export function Shell({ page, children }: { page: AppPage; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [title, subtitle] = PAGE_TITLE[page];
  useEffect(() => setOpen(false), [page]);

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-line bg-card lg:block">
        <Sidebar page={page} />
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" className="absolute inset-0 bg-ink/30 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-card shadow-lift">
            <Sidebar page={page} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[84rem] items-center gap-3 px-4 py-3 sm:px-8">
          <button type="button" onClick={() => setOpen(true)} className="rounded-xl border border-line bg-card p-2 lg:hidden" aria-label="Open menu">
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{title}</h1>
            <p className="hidden truncate text-sm text-muted sm:block">{subtitle}</p>
          </div>
          <a href="#/app/verify" className="hidden items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm font-medium shadow-soft transition hover:border-ink/25 sm:inline-flex">
            <Icon name="check" className="h-4 w-4 text-ok" /> Verify passport
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-[84rem] px-4 pb-16 pt-6 sm:px-8">{children}</main>
    </div>
  );
}
