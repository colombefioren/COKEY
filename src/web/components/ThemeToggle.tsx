import { useEffect, useState } from "react";
import { IconMoon, IconSun } from "./Icons.js";

type Theme = "light" | "dark";

const THEME_KEY = "cokey.theme";

function current(): Theme {
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Light/dark switch.
 *
 * The whole palette is token-driven and the dark theme only re-points the
 * tokens, so the switch is one attribute on <html>. The choice is remembered in
 * localStorage; on a first visit the OS preference decides.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>(() => current());

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const next = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      className={`theme-toggle${className ? ` ${className}` : ""}`}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {theme === "dark" ? <IconMoon size={15} /> : <IconSun size={15} />}
      <span>{theme === "dark" ? "Dark" : "Light"}</span>
    </button>
  );
}
