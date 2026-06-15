import { useEffect, useState } from "react";

// Tiny theme hook: persists the choice in localStorage, falls back to the OS
// preference, and toggles the `.dark` class on <html> (Tailwind class strategy).
type Theme = "light" | "dark";

const STORAGE_KEY = "pulsecrm-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  // Default to the light theme; the user opts into the deep-navy dark theme
  // (the NeuroBank look) via the toggle.
  return "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitial);

  useEffect(() => {
    apply(theme);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  return { theme, toggle };
}
