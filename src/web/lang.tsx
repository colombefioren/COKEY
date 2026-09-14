import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getStoredLang, setStoredLang, type Lang } from "./i18n.js";
import { FR } from "./translations.js";

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;
  /** Looks a static string up in the French dictionary; English is a no-op. */
  t: (text: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  toggleLang: () => {},
  t: (text) => text,
});

/**
 * The one place the site's current language lives.
 *
 * Every page reads it from here instead of receiving it as a prop, because
 * a toggle in the topbar affecting a page ten components deep is exactly the
 * case prop-drilling makes painful — every intermediate component would need
 * to accept and forward a `lang` prop it never otherwise cares about.
 */
export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => getStoredLang());

  const toggleLang = useCallback(() => {
    setLang((current) => {
      const next = current === "en" ? "fr" : "en";
      setStoredLang(next);
      return next;
    });
  }, []);

  const t = useCallback((text: string) => (lang === "fr" ? (FR[text] ?? text) : text), [lang]);

  const value = useMemo(() => ({ lang, toggleLang, t }), [lang, toggleLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): LangContextValue {
  return useContext(LangContext);
}
