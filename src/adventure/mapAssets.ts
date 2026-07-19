/**
 * 默认主题岛资源。
 * 自定义上传优先于默认主题岛（nodeImageKey）。
 */
import { ImageSourcePropType } from "react-native";
import { publicUrl } from "../sync/publicUrl";
import {
  FALLBACK_ISLAND_THEME,
  resolveDefaultIslandThemeKey,
  type DefaultIslandThemeKey
} from "./mapThemeKeys";

export {
  DEFAULT_ISLAND_THEME_KEYS,
  FALLBACK_ISLAND_THEME,
  resolveDefaultIslandThemeKey
} from "./mapThemeKeys";
export type { DefaultIslandThemeKey } from "./mapThemeKeys";

export const DEFAULT_ISLAND_IMAGES: Record<DefaultIslandThemeKey, number> = {
  lighthouse: require("../../assets/images/adventure/islands/lighthouse.png"),
  forest: require("../../assets/images/adventure/islands/forest.png"),
  market: require("../../assets/images/adventure/islands/market.png"),
  camp: require("../../assets/images/adventure/islands/camp.png"),
  bridge: require("../../assets/images/adventure/islands/bridge.png"),
  summit: require("../../assets/images/adventure/islands/summit.png")
};

export const FALLBACK_ISLAND_IMAGE = DEFAULT_ISLAND_IMAGES[FALLBACK_ISLAND_THEME];

export function resolveDefaultIslandSource(mapThemeKey: string | null | undefined): number {
  return DEFAULT_ISLAND_IMAGES[resolveDefaultIslandThemeKey(mapThemeKey)];
}

/** 章节岛图：自定义 nodeImageKey 优先，否则回退默认主题岛。 */
export function resolveChapterIslandSource(chapter: {
  nodeImageKey?: string | null;
  mapThemeKey?: string | null;
}): ImageSourcePropType {
  const customUri = publicUrl(chapter.nodeImageKey);
  if (customUri) {
    return { uri: customUri };
  }
  return resolveDefaultIslandSource(chapter.mapThemeKey);
}
