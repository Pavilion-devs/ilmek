export function Logo({ small = false, href = "#/" }: { small?: boolean; href?: string }) {
  return (
    <a href={href} className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink ${small ? "text-sm" : "text-[17px]"}`}>
      <svg viewBox="0 0 32 32" className={small ? "h-6 w-6" : "h-8 w-8"} aria-hidden="true">
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <path d="M8.5 20.5c0-5.2 3.3-9.5 7.5-9.5s7.5 4.3 7.5 9.5" fill="none" stroke="#e7d7bb" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="16" cy="20.5" r="3.4" fill="none" stroke="#c55838" strokeWidth="2.6" />
      </svg>
      Ilmek
    </a>
  );
}
