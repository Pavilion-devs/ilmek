import type { ReactNode } from "react";
import { addressUrl, txUrl } from "../run";

// ------------------------------------------------------------------ icons (24px, 1.6 stroke)

const PATHS = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  flow: "M5 7h9M5 12h14M5 17h6M17 5l2 2-2 2M15 15l2 2-2 2",
  factory: "M3 20V10l5 3V10l5 3V6h3l1 14M3 20h18M7 17h1M11 17h1M15 17h1",
  spool: "M7 4h10M7 20h10M8 4v16M16 4v16M8 8l8 2M8 12l8 2M8 16l8 2",
  shield: "M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z M9 12l2 2 4-4",
  tag: "M3 12V4h8l9 9-8 8z M7.5 7.5h.01",
  qr: "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2",
  check: "M5 12.5 10 17l9-10",
  doc: "M7 3h7l5 5v13H7z M14 3v5h5 M10 13h6M10 17h6",
  leaf: "M5 19c0-8 6-14 14-14 0 8-6 14-14 14z M5 19l7-7",
  bolt: "M13 3 5 14h6l-1 7 8-11h-6z",
  alert: "M12 4 3 20h18z M12 10v4 M12 17h.01",
  arrow: "M5 12h14 M13 6l6 6-6 6",
  external: "M14 4h6v6 M20 4l-9 9 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1 M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  key: "M15 9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z M12 12v8 M12 16h3 M12 19h2",
  menu: "M4 7h16M4 12h16M4 17h16",
  x: "M6 6l12 12M18 6 6 18",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "h-5 w-5" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

// ------------------------------------------------------------------ surfaces

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-line bg-card shadow-soft ${className}`}>{children}</div>;
}

/** Dashboard panel with a header row. */
export function Panel({ title, subtitle, action, children, className = "", bodyClass = "p-5" }: { title: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <Card className={className}>
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <h3 className="font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className={bodyClass}>{children}</div>
    </Card>
  );
}

/** A titled group inside a dashboard page. */
export function Section({ eyebrow, title, intro, children }: { eyebrow?: string; title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <section className="py-6">
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.12em] text-accent">{eyebrow}</p>}
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {intro && <p className="mt-1 max-w-3xl text-sm text-muted">{intro}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// ------------------------------------------------------------------ small parts

type Tone = "ok" | "bad" | "warn" | "neutral" | "accent" | "brand";
const toneClass: Record<Tone, string> = {
  ok: "bg-ok/10 text-ok",
  bad: "bg-bad/10 text-bad",
  warn: "bg-warn/10 text-warn",
  neutral: "bg-ink/[0.05] text-muted",
  accent: "bg-accent/10 text-accent",
  brand: "bg-brand/10 text-brand",
};
const dotClass: Record<Tone, string> = { ok: "bg-ok", bad: "bg-bad", warn: "bg-warn", neutral: "bg-muted", accent: "bg-accent", brand: "bg-brand" };

export function Badge({ tone = "neutral", children, dot = true }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[tone]}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotClass[tone]}`} />}
      {children}
    </span>
  );
}

export function StatusIcon({ status }: { status: "pass" | "fail" | "info" | "warn" }) {
  const map = {
    pass: { c: "bg-ok/10 text-ok", d: "M5 10.5l3.2 3.2L15 7", label: "passed" },
    fail: { c: "bg-bad/10 text-bad", d: "M6.5 6.5l7 7M13.5 6.5l-7 7", label: "failed" },
    warn: { c: "bg-warn/10 text-warn", d: "M10 5.5v5.5M10 14v.5", label: "warning" },
    info: { c: "bg-ink/[0.05] text-muted", d: "M10 9v5M10 6v.5", label: "information" },
  }[status];
  return (
    <span className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${map.c}`}>
      <svg viewBox="0 0 20 20" className="h-4 w-4" role="img" aria-label={map.label}>
        <path d={map.d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** A hash or address, shortened, with an explorer link when the chain has one. */
export function Hash({ value, kind = "tx" }: { value: string; kind?: "tx" | "address" | "plain" }) {
  const shortV = value.length > 20 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
  const url = kind === "tx" ? txUrl(value) : kind === "address" ? addressUrl(value) : null;
  const cls = "font-mono text-xs";
  return url ? (
    <a href={url} target="_blank" rel="noreferrer" className={`${cls} text-brand underline-offset-2 hover:underline`} title={value}>
      {shortV}
    </a>
  ) : (
    <span className={`${cls} text-muted`} title={value}>
      {shortV}
    </span>
  );
}

export function Button({ href, children, variant = "primary", icon }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "light"; icon?: IconName }) {
  const cls = {
    primary: "bg-brand text-brand-ink hover:bg-brand/90 shadow-soft",
    ghost: "border border-line bg-card text-ink hover:border-ink/25",
    light: "bg-white/90 text-ink hover:bg-white backdrop-blur",
  }[variant];
  return (
    <a href={href} className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium transition-all duration-200 ${cls}`}>
      {children}
      {icon && <Icon name={icon} className="h-4 w-4" />}
    </a>
  );
}

/** KPI card: icon, label, big value, note. */
export function Kpi({ icon, label, value, note, tone = "brand", aside }: { icon: IconName; label: string; value: ReactNode; note?: ReactNode; tone?: "brand" | "accent" | "ok" | "bad"; aside?: ReactNode }) {
  const iconBg = { brand: "bg-brand/10 text-brand", accent: "bg-accent/10 text-accent", ok: "bg-ok/10 text-ok", bad: "bg-bad/10 text-bad" }[tone];
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-muted">
            <span className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${iconBg}`}>
              <Icon name={icon} className="h-4 w-4" />
            </span>
            {label}
          </div>
          <div className="mt-3 text-[28px] font-semibold leading-none tracking-tight tabular">{value}</div>
          {note && <div className="mt-2 text-xs text-muted">{note}</div>}
        </div>
        {aside}
      </div>
    </Card>
  );
}

/** Progress ring. */
export function Ring({ value, size = 56, stroke = 6, tone = "accent", label }: { value: number; size?: number; stroke?: number; tone?: "accent" | "ok" | "brand" | "bad"; label?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = { accent: "text-accent", ok: "text-ok", brand: "text-brand", bad: "text-bad" }[tone];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90" width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-ink/[0.06]" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${c * Math.max(0, Math.min(1, value))} ${c}`} className={`${color} transition-all duration-700`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold tabular">{label ?? `${Math.round(value * 100)}%`}</div>
    </div>
  );
}

/** Horizontal bar comparing values on one scale. */
export function Bar({ value, max, tone = "accent", label, right }: { value: number; max: number; tone?: "accent" | "ok" | "bad" | "muted" | "brand"; label: ReactNode; right: ReactNode }) {
  const color = { accent: "bg-accent", ok: "bg-ok", bad: "bg-bad", muted: "bg-ink/20", brand: "bg-brand" }[tone];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="min-w-0">{label}</span>
        <span className="shrink-0 font-medium tabular">{right}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink/[0.06]">
        <div className={`h-full rounded-full ${color} transition-all duration-700`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      </div>
    </div>
  );
}

export function RecordedNote({ model, recordedAt, source }: { model?: string; recordedAt?: string; source: string }) {
  if (source === "none") return <span className="text-xs text-muted">No AI response: safe template used.</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {source === "recorded" ? "Recorded response" : "Live response"} from <span className="font-mono">{model}</span>
      {recordedAt && <span>· {recordedAt.slice(0, 10)}</span>}
    </span>
  );
}

/** Kept for older pages. */
export function Stat({ value, label, note }: { value: ReactNode; label: ReactNode; note?: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="text-3xl font-semibold tracking-tight tabular">{value}</div>
      <div className="mt-1 text-sm">{label}</div>
      {note && <div className="mt-2 text-xs text-muted">{note}</div>}
    </Card>
  );
}
