import type { VoxelMaterialKey } from "./voxelIslandRecipes";

export type ThemePalette = Record<VoxelMaterialKey, string> & {
  sky: string; fogColor: string; sunColor: string; hemiSky: string; hemiGround: string;
};

const BASE_LIGHT: Record<VoxelMaterialKey, string> = {
  grass: "#8fdc9f", grassAlt: "#a5e6b1", dirt: "#c9a189", rock: "#b7a8cc",
  trunk: "#9a6b4f", leaf: "#4fb07a", leafAlt: "#6ecb96", blossom: "#f7bcd4",
  water: "#6ec6f5", path: "#eadfc8", wall: "#f4eee2", roof: "#f0907c",
  roofAlt: "#b478e8", snow: "#f2f4fa", flower: "#ffd166"
};

const THEME_TINTS: { sky: string; fogColor: string; sunColor: string; hemiSky: string; hemiGround: string }[] = [
  { sky: "#dceefb", fogColor: "#dceefb", sunColor: "#ffe9c9", hemiSky: "#cde4ff", hemiGround: "#b8e6c2" }, // 春樱·晨光
  { sky: "#cfeef7", fogColor: "#cfeef7", sunColor: "#fff3d1", hemiSky: "#c2ecff", hemiGround: "#a9dcf0" }, // 夏湖·正午
  { sky: "#fbe3cf", fogColor: "#fbe3cf", sunColor: "#ffc9a1", hemiSky: "#ffd9b8", hemiGround: "#e8c9a0" }, // 秋林·日暮
  { sky: "#e4ecf7", fogColor: "#e4ecf7", sunColor: "#eef4ff", hemiSky: "#d8e6f7", hemiGround: "#cfd8ea" }, // 雪山·清冽
  { sky: "#2a2440", fogColor: "#2a2440", sunColor: "#b9c8ff", hemiSky: "#5d5a8f", hemiGround: "#3d3763" }  // 星空·月夜
];

export function paletteFor(themeIndex: number, dark: boolean): ThemePalette {
  const tint = THEME_TINTS[themeIndex % THEME_TINTS.length];
  const nightTint = THEME_TINTS[4];
  const env = dark ? nightTint : tint;
  return { ...BASE_LIGHT, ...env };
}
