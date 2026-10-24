/**
 * Reads a required secret from the environment. There are deliberately no
 * fallbacks: a missing key must fail loudly on the server instead of silently
 * shipping a hard-coded credential.
 */
export class MissingEnvError extends Error {
  constructor(readonly variable: string) {
    super(`Missing required environment variable ${variable}. Copy .env.example to .env.local and set it.`);
    this.name = "MissingEnvError";
  }
}

export function requireEnv(name: "TMDB_API_KEY" | "SUBDL_API_KEY"): string {
  const value = process.env[name]?.trim();
  if (!value) throw new MissingEnvError(name);
  return value;
}
