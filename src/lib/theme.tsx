import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
const ThemeContext = createContext<{ theme: Theme; setTheme: (t: Theme) => void }>({
  theme: "system",
  setTheme: () => {},
});

function apply(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");

  useEffect(() => {
    const stored = (localStorage.getItem("crm-theme") as Theme | null) ?? "system";
    setThemeState(stored);
    apply(stored);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => apply((localStorage.getItem("crm-theme") as Theme | null) ?? "system");
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  function setTheme(next: Theme) {
    localStorage.setItem("crm-theme", next);
    setThemeState(next);
    apply(next);
  }

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
