import { claimAdventureChapter, fetchAdventureState } from "./adventureClient";
import type { AdventureState } from "./types";

export async function loadAdventureState(): Promise<AdventureState> {
  return fetchAdventureState();
}

export async function claimChapter(chapterId: string): Promise<AdventureState> {
  return claimAdventureChapter(chapterId);
}
