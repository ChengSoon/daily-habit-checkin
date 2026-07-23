import { describe, expect, it } from "vitest";
import { replacedAdventureImageKeys } from "./adventureImageCleanup.js";

describe("adventure image cleanup", () => {
  it("returns only image keys replaced or removed by an update", () => {
    expect(replacedAdventureImageKeys(
      {
        badgeImageKey: "adventure/space-1/old-badge.png",
        nodeImageKey: "adventure/space-1/same-node.png",
        backgroundImageKey: "adventure_badges/space-1/old-background.jpg"
      },
      {
        badgeImageKey: "adventure/space-1/new-badge.png",
        nodeImageKey: "adventure/space-1/same-node.png",
        backgroundImageKey: null
      }
    )).toEqual([
      "adventure/space-1/old-badge.png",
      "adventure_badges/space-1/old-background.jpg"
    ]);
  });
});
