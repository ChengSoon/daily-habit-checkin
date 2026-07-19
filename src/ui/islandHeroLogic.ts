/**
 * IslandHero（共同岛屿卡）纯逻辑辅助。
 * 刻意不 import react-native / mapAssets（后者 require PNG，在 node 测试环境会炸）。
 * 组件 IslandHero.tsx 里才做真实岛图解析与渲染。
 */

/** 有主题 key 或自定义岛图时显示真实岛图；否则回退抽象柔光态。 */
export function shouldUseIslandImage(
  islandKey?: string | null,
  islandImageKey?: string | null
): boolean {
  return Boolean((islandKey && islandKey.trim()) || (islandImageKey && islandImageKey.trim()));
}

/** 岛屿等级标签："Lv.4"；缺失/非正数返回空串。 */
export function formatIslandLevel(level?: number | null): string {
  return typeof level === "number" && level > 0 ? `Lv.${level}` : "";
}
