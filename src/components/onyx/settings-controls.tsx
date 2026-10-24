"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Labelled row: text on the start side, control on the end side. */
export function Field({ label, hint, children, stacked = false }: { label: string; hint?: string; children: ReactNode; stacked?: boolean }) {
  return (
    <div className={cn("flex gap-4 py-3", stacked ? "flex-col" : "items-center justify-between")}>
      <div className="min-w-0">
        <div className="font-medium">{label}</div>
        {hint && <p className="mt-0.5 text-meta text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn(!stacked && "shrink-0")}>{children}</div>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="py-6">
      <h3 className="mb-1 font-display text-title">{title}</h3>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

interface SegmentedProps<T extends string | number> {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}

/** A radio group that looks like a segmented control; arrow keys move the selection. */
export function Segmented<T extends string | number>({ label, value, options, onChange }: SegmentedProps<T>) {
  const move = (delta: number) => {
    const i = options.findIndex((o) => o.value === value);
    onChange(options[(i + delta + options.length) % options.length].value);
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex flex-wrap gap-1 rounded-full bg-muted p-1"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(document.dir === "rtl" && e.key === "ArrowRight" ? -1 : 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(document.dir === "rtl" && e.key === "ArrowLeft" ? 1 : -1);
        }
      }}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium tabular-nums transition-colors focus-visible:outline-2",
              selected ? "bg-foreground text-background" : "text-foreground/80 hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
