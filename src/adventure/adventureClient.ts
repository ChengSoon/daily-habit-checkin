import { apiRequest } from "../sync/apiClient";
import type { AdventureState } from "./types";

export function fetchAdventureState(): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/state");
}

export function claimAdventureChapter(chapterId: string): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/claim", {
    method: "POST",
    body: { chapterId }
  });
}
