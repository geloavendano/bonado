import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/context/AuthContext";

export type ThemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "bonado:theme";

function readStoredPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "light" || stored === "dark" ? stored : "system";
}

function systemPrefersDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyResolvedTheme(preference: ThemePreference) {
  const root = document.documentElement;
  const dark = preference === "dark" || (preference === "system" && systemPrefersDark());
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", preference === "light");
  root.style.colorScheme = dark ? "dark" : "light";
}

interface ThemeContextValue {
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

/**
 * Resolves to the device's prefers-color-scheme by default ("system"), with
 * an explicit "light"/"dark" override persisted to bonado.users so it
 * follows a signed-in user across devices. Cached in localStorage (and
 * applied by a blocking inline script in index.html) so there's no flash
 * of the wrong theme before this provider mounts.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateProfile } = useAuth();
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference);

  useEffect(() => {
    applyResolvedTheme(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyResolvedTheme("system");
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [preference]);

  useEffect(() => {
    if (user && user.theme_preference !== preference) {
      setPreferenceState(user.theme_preference);
      localStorage.setItem(STORAGE_KEY, user.theme_preference);
    }
    // Only react to the signed-in user's stored value changing (e.g. after
    // login, or switching accounts) -- not to local `preference` edits,
    // which are already the source of truth until the server round-trips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.theme_preference]);

  const setPreference = useCallback(
    (next: ThemePreference) => {
      setPreferenceState(next);
      localStorage.setItem(STORAGE_KEY, next);
      if (user) void updateProfile({ themePreference: next });
    },
    [user, updateProfile],
  );

  const value = useMemo(() => ({ preference, setPreference }), [preference, setPreference]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
