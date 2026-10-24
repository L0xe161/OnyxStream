import type { Transition, Variants } from "framer-motion";

/** The single source of truth for animation timing. No ad-hoc values in components. */
export const duration = { instant: 0.12, fast: 0.2, base: 0.32, slow: 0.56 } as const;

export const ease = {
  standard: [0.2, 0, 0, 1],
  emphasized: [0.3, 0, 0, 1],
  exit: [0.4, 0, 1, 1],
} as const;

export const spring: Transition = { type: "spring", stiffness: 420, damping: 34, mass: 0.8 };

/** Travel distances in px. */
export const distance = { xs: 4, sm: 8, md: 16, lg: 32 } as const;

export const transition = {
  fast: { duration: duration.fast, ease: ease.standard } satisfies Transition,
  base: { duration: duration.base, ease: ease.standard } satisfies Transition,
  emphasized: { duration: duration.slow, ease: ease.emphasized } satisfies Transition,
  spring,
} as const;

/** Seconds between staggered siblings; keeps whole-page entrances under ~900ms. */
export const STAGGER = 0.05;

export const fade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transition.base },
  exit: { opacity: 0, transition: { duration: duration.fast, ease: ease.exit } },
};

export function rise(reduced: boolean): Variants {
  const y = reduced ? 0 : distance.md;
  return {
    hidden: { opacity: 0, y },
    visible: { opacity: 1, y: 0, transition: transition.base },
    exit: { opacity: 0, y: reduced ? 0 : -distance.sm, transition: { duration: duration.fast, ease: ease.exit } },
  };
}

/** Slides in from the inline-end edge; `dir` mirrors it for RTL. */
export function slide(dir: "ltr" | "rtl", reduced: boolean): Variants {
  const x = reduced ? 0 : (dir === "rtl" ? -1 : 1) * 40;
  return {
    hidden: { opacity: 0, x },
    visible: { opacity: 1, x: 0, transition: transition.base },
    exit: { opacity: 0, x: -x / 2, transition: { duration: duration.fast, ease: ease.exit } },
  };
}

export const stagger = (delay = 0): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: STAGGER, delayChildren: delay } },
});
