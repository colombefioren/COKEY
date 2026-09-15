import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { getStoredLang, setStoredLang, type Lang } from "./i18n.js";
import { FR } from "./translations.js";

interface LangContextValue {
  lang: Lang;
  toggleLang: () => void;

  t: (text: string) => string;
}

const LangContext = createContext<LangContextValue>({
  lang: "en",
  toggleLang: () => {},
  t: (text) => text,
});

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
