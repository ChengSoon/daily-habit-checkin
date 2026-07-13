export const DEFAULT_ISLAND_THEME_KEYS = [
  "lighthouse",
  "forest",
  "market",
  "camp",
  "bridge",
  "summit"
] as const;

export type DefaultIslandThemeKey = (typeof DEFAULT_ISLAND_THEME_KEYS)[number];

export const FALLBACK_ISLAND_THEME: DefaultIslandThemeKey = "lighthouse";

export function resolveDefaultIslandThemeKey(
  mapThemeKey: string | null | undefined
): DefaultIslandThemeKey {
  if (mapThemeKey && (DEFAULT_ISLAND_THEME_KEYS as readonly string[]).includes(mapThemeKey)) {
    return mapThemeKey as DefaultIslandThemeKey;
  }
  return FALLBACK_ISLAND_THEME;
}
