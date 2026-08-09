import { useCallback, useEffect, useState } from "react";
import type { ThemePref } from "../lib/types";

const LS_THEME = "veil.theme";

function load(): ThemePref {
  const v = localStorage.getItem(LS_THEME);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function apply(theme: ThemePref) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

/** Theme preference persisted in localStorage (non-sensitive, so it works pre-unlock). */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePref>(() => load());

  useEffect(() => {
    apply(theme);
  }, [theme]);

  const setTheme = useCallback((t: ThemePref) => {
    localStorage.setItem(LS_THEME, t);
    setThemeState(t);
  }, []);

  const cycle = useCallback(() => {
    setTheme(theme === "system" ? "light" : theme === "light" ? "dark" : "system");
  }, [theme, setTheme]);

  return { theme, setTheme, cycle };
}
