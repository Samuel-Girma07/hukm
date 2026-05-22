"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { translate } from "@/lib/translations";
import type { Language } from "@/lib/types";

type TParams = Record<string, string | number>;

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: TParams) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "hukm-language";
const VALID_LANGUAGES: ReadonlyArray<Language> = ["en", "am"];

function readInitial(): Language {
  if (typeof window === "undefined") return "en";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "am") return stored;
  } catch {
    // ignore
  }
  return "en";
}

interface LanguageProviderProps {
  children: React.ReactNode;
  /**
   * Initial language passed in from the server. Hydrating with the server
   * value avoids the client briefly rendering English then swapping to
   * Amharic on mount.
   */
  initial?: Language;
}

export function LanguageProvider({
  children,
  initial,
}: LanguageProviderProps): React.ReactElement {
  const [language, setLanguageState] = useState<Language>(
    initial ?? "en",
  );

  // After hydration, sync from localStorage if the user has a preference.
  useEffect(() => {
    const stored = readInitial();
    if (stored !== language) setLanguageState(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirror to <html lang="…"> for accessibility / SEO.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    if (!VALID_LANGUAGES.includes(lang)) return;
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
    // Best-effort track the change.
    void fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventType: "language_changed", metadata: { lang } }),
    }).catch(() => {});
  }, []);

  const t = useCallback(
    (key: string, params?: TParams) => translate(language, key, params),
    [language],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({ language, setLanguage, t }),
    [language, setLanguage, t],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error("useLanguage must be used inside <LanguageProvider>");
  }
  return ctx;
}

/**
 * Convenience hook for components that only need the t() helper.
 */
export function useT(): LanguageContextValue["t"] {
  return useLanguage().t;
}
