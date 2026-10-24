"use client";

import type { ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { duration, ease, distance } from "@/lib/motion";
import { useMotion } from "@/hooks/use-motion";
import { cn } from "@/lib/utils";

export type OverlayVariant = "modal" | "theater" | "sheet";

interface OverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Announced by screen readers; visually hidden. */
  title: string;
  description?: string;
  variant?: OverlayVariant;
  /** Which edge a `sheet` attaches to on wide screens (it is a bottom sheet on phones). */
  dir?: "ltr" | "rtl";
  className?: string;
  children: ReactNode;
}

const surface: Record<OverlayVariant, string> = {
  modal:
    "fixed inset-x-0 bottom-0 top-8 z-50 mx-auto flex max-w-5xl flex-col overflow-hidden rounded-t-[var(--radius-xl)] bg-card text-card-foreground outline-none sm:inset-y-8 sm:rounded-[var(--radius-xl)]",
  theater: "fixed inset-0 z-50 flex flex-col bg-black text-white outline-none",
  sheet:
    "fixed inset-x-0 bottom-0 z-50 flex max-h-[88dvh] flex-col overflow-hidden rounded-t-[var(--radius-xl)] bg-card text-card-foreground outline-none sm:inset-y-0 sm:bottom-auto sm:end-0 sm:start-auto sm:max-h-none sm:w-[26rem] sm:rounded-none",
};

function contentVariants(variant: OverlayVariant, dir: "ltr" | "rtl", reduced: boolean, off: boolean): Variants {
  const t = off ? 0 : duration.base;
  const tx = off ? 0 : duration.fast;
  if (reduced) {
    return {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: t } },
      exit: { opacity: 0, transition: { duration: tx } },
    };
  }
  if (variant === "sheet") {
    const sign = dir === "rtl" ? -1 : 1;
    return {
      hidden: { opacity: 0, y: distance.lg, x: sign * distance.lg },
      visible: { opacity: 1, y: 0, x: 0, transition: { duration: t, ease: ease.emphasized } },
      exit: { opacity: 0, y: distance.md, x: sign * distance.md, transition: { duration: tx, ease: ease.exit } },
    };
  }
  return {
    hidden: { opacity: 0, y: distance.md, scale: 0.985 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: t, ease: ease.emphasized } },
    exit: { opacity: 0, y: distance.sm, scale: 0.99, transition: { duration: tx, ease: ease.exit } },
  };
}

/**
 * Accessible, animated dialog shell. Provides role="dialog", aria-modal, a
 * labelled title, a focus trap, focus restoration, Escape-to-close and a
 * reference-counted scroll lock (all handled by Radix). Every overlay in the
 * product is built on this so enter/exit behaviour is identical.
 */
export function Overlay({
  open,
  onOpenChange,
  title,
  description,
  variant = "modal",
  dir = "ltr",
  className,
  children,
}: OverlayProps) {
  const { reduced, off } = useMotion();
  const variants = contentVariants(variant, dir, reduced, off);

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                className={cn("fixed inset-0 z-50", variant === "theater" ? "bg-black" : "bg-black/70")}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: off ? 0 : duration.base } }}
                exit={{ opacity: 0, transition: { duration: off ? 0 : duration.fast } }}
              />
            </DialogPrimitive.Overlay>
            <DialogPrimitive.Content asChild forceMount>
              <motion.div
                dir={dir}
                className={cn(surface[variant], className)}
                variants={variants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
                <DialogPrimitive.Description className="sr-only">{description ?? title}</DialogPrimitive.Description>
                {children}
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

export const OverlayClose = DialogPrimitive.Close;
