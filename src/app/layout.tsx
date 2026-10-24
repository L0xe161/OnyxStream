import type { Metadata, Viewport } from "next";
import { Amiri, Fraunces, Geist, IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeApplier } from "@/components/onyx/theme-applier";
import { PrepaintScript } from "@/components/onyx/prepaint-script";
import { Providers } from "@/components/onyx/providers";

/** Display: a soft-serif with optical sizing for titles; Amiri is its Arabic counterpart. */
const fraunces = Fraunces({ variable: "--f-fraunces", subsets: ["latin"], axes: ["opsz"], display: "swap" });
const amiri = Amiri({ variable: "--f-amiri", subsets: ["arabic"], weight: ["400", "700"], display: "swap" });
/** Text: a quiet grotesque with tabular numerals; IBM Plex Sans Arabic matches its proportions. */
const geist = Geist({ variable: "--f-geist", subsets: ["latin"], display: "swap" });
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--f-plex-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CineSolace — Your Personal Escape",
  description:
    "High-performance streaming platform for Movies, TV Shows, Anime, and Cartoons with light/dark/frosted themes, full catalog filtering, director & cast search, bilingual Arabic/English titles, and SubDL subtitle proxying.",
  keywords: [
    "CineSolace",
    "streaming",
    "movies",
    "tv shows",
    "anime",
    "arabic subtitles",
    "cinema",
    "catalog",
    "themes",
  ],
  authors: [{ name: "CineSolace" }],
  openGraph: {
    title: "CineSolace — Your Personal Escape",
    description:
      "Dark/light/frosted streaming platform for Movies, TV Shows, Anime & Cartoons with full catalog filtering and bilingual Arabic/English artwork.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CineSolace",
    description: "Your Personal Escape — bilingual cinema streaming with full theming.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const fonts = [fraunces, amiri, geist, plexArabic].map((f) => f.variable).join(" ");
  return (
    <html lang="en" dir="ltr" className="theme-dark" suppressHydrationWarning>
      <head>
        <PrepaintScript />
      </head>
      <body className={`${fonts} antialiased bg-background text-foreground`}>
        <ThemeApplier />
        <Providers>{children}</Providers>
        <Toaster position="bottom-center" closeButton />
      </body>
    </html>
  );
}
