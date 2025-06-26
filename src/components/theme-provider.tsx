import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "dark",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Extension-compatible storage functions
const getThemeFromStorage = async (
  storageKey: string,
  defaultTheme: Theme
): Promise<Theme> => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      const result = await chrome.storage.local.get(storageKey);
      return (result[storageKey] as Theme) || defaultTheme;
    }

    // Fallback to localStorage for development
    return (localStorage.getItem(storageKey) as Theme) || defaultTheme;
  } catch (error) {
    console.error("Failed to get theme from storage:", error);
    return defaultTheme;
  }
};

const saveThemeToStorage = async (
  storageKey: string,
  theme: Theme
): Promise<void> => {
  try {
    if (typeof chrome !== "undefined" && chrome.storage) {
      await chrome.storage.local.set({ [storageKey]: theme });
    } else {
      // Fallback to localStorage for development
      localStorage.setItem(storageKey, theme);
    }
  } catch (error) {
    console.error("Failed to save theme to storage:", error);
  }
};

export function ThemeProvider({
  children,
  defaultTheme = "dark",
  storageKey = "lancer-ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load theme from storage on mount
  useEffect(() => {
    const loadTheme = async () => {
      const savedTheme = await getThemeFromStorage(storageKey, defaultTheme);
      setTheme(savedTheme);
      setIsLoaded(true);
    };

    loadTheme();
  }, [storageKey, defaultTheme]);

  useEffect(() => {
    // Don't apply theme until it's loaded from storage
    if (!isLoaded) return;

    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
        .matches
        ? "dark"
        : "light";

      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme, isLoaded]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      setTheme(newTheme);
      saveThemeToStorage(storageKey, newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};
