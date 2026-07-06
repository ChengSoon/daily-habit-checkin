import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { getAppSettings, saveAppSettings, ThemeMode } from "../settings/settingsRepository";
import { ColorScheme, DEFAULT_THEME, Palette, ThemeName, themes } from "./theme";

export type { ThemeMode };

export type Theme = {
  mode: ThemeMode;
  themeName: ThemeName;
  scheme: ColorScheme;
  colors: Palette;
  setMode: (mode: ThemeMode) => void;
  setThemeName: (name: ThemeName) => void;
};

const ThemeCtx = createContext<Theme | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>("system");
  const [themeName, setThemeNameState] = useState<ThemeName>(DEFAULT_THEME);

  useEffect(() => {
    // 主题在根布局启动时加载，早于登录。未登录时 getAppSettings 会抛
    // UnauthorizedError，这里降级为默认主题，不能让它变成未处理的 rejection。
    getAppSettings()
      .then((settings) => {
        setModeState(settings.themeMode);
        setThemeNameState(settings.themeName);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    getAppSettings()
      .then((settings) => saveAppSettings({ ...settings, themeMode: next }))
      .catch(() => undefined);
  }, []);

  const setThemeName = useCallback((next: ThemeName) => {
    setThemeNameState(next);
    getAppSettings()
      .then((settings) => saveAppSettings({ ...settings, themeName: next }))
      .catch(() => undefined);
  }, []);

  const scheme: ColorScheme = mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;

  const value = useMemo<Theme>(
    () => ({ mode, themeName, scheme, colors: themes[themeName][scheme], setMode, setThemeName }),
    [mode, themeName, scheme, setMode, setThemeName]
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
