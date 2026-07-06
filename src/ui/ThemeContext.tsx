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
    // 主题在根布局启动时加载，早于登录。未登录时 getAppSettings 会抛
    // UnauthorizedError，这里降级为系统默认主题，不能让它变成未处理的 rejection。
    getAppSettings()
      .then((settings) => setModeState(settings.themeMode))
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    getAppSettings()
      .then((settings) => saveAppSettings({ ...settings, themeMode: next }))
      .catch(() => undefined);
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
