import { deleteObjectForScope } from "../r2/r2Client.js";

export type AdventureImageKeys = {
  badgeImageKey: string | null;
  nodeImageKey: string | null;
  backgroundImageKey: string | null;
};

export function replacedAdventureImageKeys(
  previous: AdventureImageKeys,
  next: AdventureImageKeys
): string[] {
  return [
    [previous.badgeImageKey, next.badgeImageKey],
    [previous.nodeImageKey, next.nodeImageKey],
    [previous.backgroundImageKey, next.backgroundImageKey]
  ].flatMap(([oldKey, nextKey]) => oldKey && oldKey !== nextKey ? [oldKey] : []);
}

export async function cleanupReplacedAdventureImages(
  spaceId: string,
  previous: AdventureImageKeys,
  next: AdventureImageKeys
): Promise<void> {
  for (const key of replacedAdventureImageKeys(previous, next)) {
    await deleteObjectForScope("adventure", spaceId, key);
  }
}
