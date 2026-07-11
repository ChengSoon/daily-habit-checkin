import { describe, expect, it } from "vitest";
import {
  createIslandRecipe,
  landmarkForIsland,
  MAX_BLOCKS_PER_ISLAND,
  type IslandRecipe
} from "./voxelIslandRecipes";

function allBlocks(recipe: IslandRecipe) {
  return [...recipe.ground, ...recipe.foliage, ...recipe.water];
}

describe("createIslandRecipe", () => {
  it("同参数输出深度相等（确定性）", () => {
    expect(createIslandRecipe(3, 1, false)).toEqual(createIslandRecipe(3, 1, false));
  });

  it("不同岛序号输出不同", () => {
    expect(JSON.stringify(createIslandRecipe(0, 0, false)))
      .not.toBe(JSON.stringify(createIslandRecipe(1, 0, false)));
  });

  it.each([0, 1, 2, 3, 4, 7, 15])("岛 %i 方块总数不超过预算", (islandIndex) => {
    const recipe = createIslandRecipe(islandIndex, islandIndex % 5, false);
    expect(allBlocks(recipe).length).toBeLessThanOrEqual(MAX_BLOCKS_PER_ISLAND);
    expect(allBlocks(recipe).length).toBeGreaterThan(100);
  });

  it("方块位置无重复", () => {
    const recipe = createIslandRecipe(2, 1, false);
    const keys = allBlocks(recipe).map((b) => b.position.join(","));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("包含平台草地与泥土层", () => {
    const recipe = createIslandRecipe(0, 0, false);
    const materials = new Set(recipe.ground.map((b) => b.material));
    expect(materials.has("grass")).toBe(true);
    expect(materials.has("dirt")).toBe(true);
    expect(materials.has("rock")).toBe(true);
    expect(materials.has("path")).toBe(true);
  });

  it("雪主题顶层是雪", () => {
    const recipe = createIslandRecipe(9, 3, false);
    const topLayer = recipe.ground.filter((b) => b.position[1] === 0);
    expect(topLayer.some((b) => b.material === "snow")).toBe(true);
    expect(topLayer.some((b) => b.material === "grass")).toBe(false);
  });

  it("有树（trunk + 树冠）", () => {
    const recipe = createIslandRecipe(1, 1, false);
    expect(recipe.ground.some((b) => b.material === "trunk")).toBe(true);
    expect(recipe.foliage.length).toBeGreaterThan(0);
  });

  it("teaser 岛只有平台和一棵树", () => {
    const recipe = createIslandRecipe(5, 1, true);
    expect(recipe.ground.some((b) => b.material === "path")).toBe(false);
    expect(recipe.water).toHaveLength(0);
    expect(recipe.ground.filter((b) => b.material === "trunk").length).toBeLessThanOrEqual(2);
  });
});

describe("landmarkForIsland", () => {
  it("按岛序号循环五种地标", () => {
    expect(landmarkForIsland(0)).toBe("castle");
    expect(landmarkForIsland(1)).toBe("lighthouse");
    expect(landmarkForIsland(2)).toBe("windmill");
    expect(landmarkForIsland(3)).toBe("greenhouse");
    expect(landmarkForIsland(4)).toBe("observatory");
    expect(landmarkForIsland(5)).toBe("castle");
  });
});
