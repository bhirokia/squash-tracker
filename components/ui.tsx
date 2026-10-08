"use client";
import type { ReactNode } from "react";

export const primaryClass =
  "block w-full rounded-lg bg-accent py-3 text-center text-sm font-semibold text-bg transition-opacity disabled:opacity-30";

const buttonBase =
  "rounded-lg border px-4 py-2.5 text-center text-sm font-medium transition-colors disabled:opacity-30";

export const outlineAccentClass = `${buttonBase} border-accent/70 bg-transparent text-accent active:bg-accent/10`;
export const secondaryClass = `${buttonBase} border-line bg-surface text-fg/80 active:border-muted/50`;
export const dangerClass = `${buttonBase} border-red-400/30 bg-red-400/5 text-red-300 active:bg-red-400/10`;

export function Chip({
  active,
  onClick,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md border px-3 py-2 text-sm transition-colors disabled:opacity-30 ${
        active
          ? "border-accent/60 bg-accent/15 text-accent"
          : "border-line bg-surface text-fg/80 active:border-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted">
      {children}
    </p>
  );
}
