import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getAppSettings, saveAppSettings, ThemeMode } from "../settings/settingsRepository";
import { ColorScheme, Palette, palettes } from "./theme";

export type { ThemeMode };

export type Theme = {
  mode: ThemeMode;
  scheme: ColorScheme;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
};

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");

  useEffect(() => {
    getAppSettings().then((settings) => setModeState(settings.themeMode));
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    getAppSettings().then((settings) => saveAppSettings({ ...settings, themeMode: next }));
  }, []);

  const scheme: ColorScheme = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<Theme>(
    () => ({ mode, scheme, colors: palettes[scheme], setMode }),
    [mode, scheme, setMode]
  );

  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

export function useTheme(): Theme {
  const value = useContext(ThemeCtx);
  if (!value) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return value;
}
