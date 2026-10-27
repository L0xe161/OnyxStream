import ZAI from "z-ai-web-dev-sdk";
import type { Language } from "../types";

/**
 * The target language for translation, expressed the way the LLM understands
 * it best ("Persian" / "Arabic" / "English"). The LLM is told to translate to
 * the language, keep proper nouns / film titles intact, and output ONLY the
 * translation so we can use the response verbatim.
 */
const LANG_NAME: Record<Language, string> = {
  en: "English",
  ar: "Arabic",
  fa: "Persian (Farsi)",
};

/** A single shared ZAI instance — `ZAI.create()` is async and we reuse it. */
type ZaiInstance = Awaited<ReturnType<typeof ZAI.create>>;
let zaiPromise: Promise<ZaiInstance> | null = null;
function getZai(): Promise<ZaiInstance> {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise!;
}

/**
 * Validates that a value is a non-empty string of a sane length — the LLM
 * output and the API input both pass through here so a malformed payload can
 * never feed an over-long prompt or return junk to the client.
 */
function isTranslatableText(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= 1000;
}

/**
 * Machine-translates a short string (a movie tagline) to the target language
 * using the z-ai-web-dev-sdk LLM. Returns the original text untouched when:
 *   - the target is English (no translation needed), or
 *   - the input is missing/over-long, or
 *   - the LLM call fails (the caller falls back gracefully).
 *
 * The LLM is instructed to output ONLY the translation, keep proper nouns and
 * film titles intact, and not wrap the result in quotes. The output is trimmed
 * of any surrounding whitespace/newlines the model may add.
 */
export async function translateText(
  text: string,
  to: Language
): Promise<string> {
  if (to === "en" || !isTranslatableText(text)) return text;
  try {
    const zai = await getZai();
    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: "assistant",
          content:
            `You are a professional film-marketing translator. Translate the user's text into ${LANG_NAME[to]}. ` +
            "Keep proper nouns, film titles and character names intact. " +
            "Output ONLY the translated sentence — no preamble, no quotes, no explanation. " +
            "Match the tone of the original (punchy / dramatic / playful).",
        },
        { role: "user", content: text },
      ],
      thinking: { type: "disabled" },
    });
    const out = completion.choices[0]?.message?.content?.trim();
    // Strip a single pair of surrounding quotes if the model added them.
    const cleaned = out
      ? out.replace(/^["“”'`]+|["“”'`]+$/g, "").trim()
      : "";
    return cleaned || text;
  } catch {
    // On any failure, return the original so the caller can fall back to it.
    return text;
  }
}
