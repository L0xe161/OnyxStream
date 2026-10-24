"use client";

import { useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import { useMotion } from "@/hooks/use-motion";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** App-wide data layer. TMDB data changes slowly, so it is kept fresh for minutes. */
export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60_000,
            gcTime: 30 * 60_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
  return (
    <QueryClientProvider client={client}>
      <MotionProvider>{children}</MotionProvider>
    </QueryClientProvider>
  );
}

/** Applies the user's motion preference to every framer-motion animation at once. */
function MotionProvider({ children }: { children: ReactNode }) {
  const { level } = useMotion();
  return (
    <MotionConfig
      reducedMotion={level === "full" ? "never" : "always"}
      transition={level === "off" ? { duration: 0 } : undefined}
    >
      {children}
    </MotionConfig>
  );
}
