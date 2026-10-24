"use client"

import { Toaster as Sonner, ToasterProps } from "sonner"
import { useEffectiveTheme } from "@/hooks/use-effective-theme"
import { useOnyxStore } from "@/lib/store"
import { dirFor } from "@/lib/i18n"

/** Toasts follow the app's own theme and reading direction, not the OS. */
const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useEffectiveTheme()
  const lang = useOnyxStore((s) => s.lang)

  return (
    <Sonner
      theme={theme === "light" ? "light" : "dark"}
      dir={dirFor(lang)}
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
