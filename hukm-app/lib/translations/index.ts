/**
 * HUKM — Translations utility.
 *
 * Use `t()` to look up a key by dotted path. Missing keys fall back to
 * the key itself so a typo is visible in the UI rather than silently
 * crashing.
 *
 * Pluralisation is intentionally minimal: callers pass `count` and a
 * pre-resolved `countLabel`. Two-form is enough for English/Amharic
 * counts in our UI.
 */

import { am } from "./am";
import { en } from "./en";
import type { Translations } from "./en";
import type { Language } from "../types";

export const translations: Record<Language, Translations> = { en, am };

export type { Translations };

type TParams = Record<string, string | number>;

function lookup(language: Language, key: string): string {
  const parts = key.split(".");
  let cursor: unknown = translations[language];
  for (const part of parts) {
    if (cursor && typeof cursor === "object" && part in (cursor as Record<string, unknown>)) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      cursor = undefined;
      break;
    }
  }
  if (typeof cursor !== "string") {
    if (language !== "en") return lookup("en", key);
    return key;
  }
  return cursor;
}

function interpolate(template: string, params?: TParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => {
    const v = params[k];
    return v === undefined || v === null ? `{${k}}` : String(v);
  });
}

export function translate(
  language: Language,
  key: string,
  params?: TParams,
): string {
  return interpolate(lookup(language, key), params);
}
