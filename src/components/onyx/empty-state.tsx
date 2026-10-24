import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void; icon?: ReactNode };
}

/**
 * A quiet empty/error state drawn in the product's own language: an unlit
 * frame holding a single glyph, then plain words and one action.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-[55svh] max-w-md flex-col items-center justify-center gap-6 px-[var(--gutter)] py-20 text-center">
      <div className="relative grid h-28 w-20 place-items-center rounded-[var(--radius-lg)] bg-secondary text-muted-foreground" aria-hidden>
        <span className="absolute inset-1.5 rounded-[calc(var(--radius-lg)-4px)] border border-dashed border-border" />
        {icon}
      </div>
      <div className="space-y-2">
        <h2 className="font-display text-headline !text-[clamp(1.5rem,1.2rem+1.2vw,2.25rem)]" dir="auto">{title}</h2>
        {description && <p className="text-muted-foreground" dir="auto">{description}</p>}
      </div>
      {action && (
        <button type="button" onClick={action.onClick} className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--primary)] px-6 text-[0.9375rem] font-semibold text-[var(--primary-foreground)] transition-colors hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2">
          {action.icon}
          {action.label}
        </button>
      )}
    </div>
  );
}
