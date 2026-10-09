"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Gear outline: 8 teeth, generated so it stays perfectly symmetric
const GEAR = (() => {
  const teeth = 8;
  const outer = 9.5;
  const inner = 7.4;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const step = (Math.PI * 2) / teeth;
    for (const [r, off] of [
      [inner, -0.5],
      [outer, -0.3],
      [outer, 0.3],
      [inner, 0.5],
    ] as const) {
      const t = a + off * step * 0.6;
      pts.push(`${(12 + r * Math.cos(t)).toFixed(2)},${(12 + r * Math.sin(t)).toFixed(2)}`);
    }
  }
  return pts.join(" ");
})();

function Icon({ name, active }: { name: "home" | "stats" | "settings"; active: boolean }) {
  const fill = active ? "currentColor" : "none";
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      {name === "home" && (
        <path d="M3.5 10.5 12 3.5l8.5 7V19a1.5 1.5 0 0 1-1.5 1.5h-4.5v-6h-5v6H5A1.5 1.5 0 0 1 3.5 19z" fill={fill} fillOpacity={0.2} />
      )}
      {name === "stats" && (
        <g fill={fill} fillOpacity={0.2}>
          <rect x="4" y="12" width="4" height="8.5" rx="1" />
          <rect x="10" y="4" width="4" height="16.5" rx="1" />
          <rect x="16" y="8.5" width="4" height="12" rx="1" />
        </g>
      )}
      {name === "settings" && (
        <>
          <polygon points={GEAR} fill={fill} fillOpacity={0.2} />
          <circle cx="12" cy="12" r="2.8" />
        </>
      )}
    </svg>
  );
}

const TABS: { href: string; label: string; icon: "home" | "stats" | "settings"; match: (p: string) => boolean }[] = [
  { href: "/", label: "Home", icon: "home", match: (p) => p === "/" },
  { href: "/players", label: "Stats", icon: "stats", match: (p) => p.startsWith("/players") },
  { href: "/settings", label: "Settings", icon: "settings", match: (p) => p.startsWith("/settings") },
];

function Tab({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      className={`flex flex-1 flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-medium transition-colors ${
        active ? "text-accent" : "text-muted active:text-fg/80"
      }`}
    >
      {children}
    </Link>
  );
}

export default function BottomNav() {
  const pathname = usePathname() ?? "/";

  // Hide on match screens: they have their own bottom bar (Save rally)
  if (pathname.startsWith("/match")) return null;

  return (
    <>
      {/* Spacer so page content can scroll clear of the bar */}
      <div className="h-[calc(4.5rem+env(safe-area-inset-bottom))]" aria-hidden />
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-bg/75 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto flex max-w-md px-2">
          {TABS.map((t) => {
            const active = t.match(pathname);
            return (
              <Tab key={t.href} href={t.href} active={active}>
                <Icon name={t.icon} active={active} />
                {t.label}
              </Tab>
            );
          })}
        </div>
      </nav>
    </>
  );
}
