import type { NextConfig } from "next";

/**
 * Directives that are safe without per-request nonces. `script-src` allows
 * `'self'` + `'unsafe-inline'` as a stop-gap so the Next.js inline scripts
 * (the `__next_f` RSC payload and the theme prepaint script) are no longer
 * blocked by the policy and React hydration can complete. Development also
 * allows `'unsafe-eval'` for the dev toolchain (HMR / React Refresh).
 * Third-party players are framed over https, and providers redirect across
 * domains, so `frame-src` is https-only instead of a brittle host list.
 */
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  "frame-src https:",
  "img-src 'self' data: blob: https://image.tmdb.org",
  "media-src 'self' blob: https:",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
];

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  // Type errors and ESLint failures now fail the build. The previous
  // `typescript.ignoreBuildErrors: true` and `reactStrictMode: false` were
  // stop-gaps that hid real problems; both have been resolved at the source.
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
