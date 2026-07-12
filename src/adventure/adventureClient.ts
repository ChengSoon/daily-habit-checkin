import { apiRequest } from "../sync/apiClient";
import type {
  AdminAdventureChapter,
  AdventureChapterAdminInput,
  AdventureChapterStatus,
  AdventureState
} from "./types";

export function fetchAdventureState(): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/state");
}

export function claimAdventureChapter(chapterId: string): Promise<AdventureState> {
  return apiRequest<AdventureState>("/api/adventure/claim", {
    method: "POST",
    body: { chapterId }
  });
}

export async function fetchAdminChapters(): Promise<AdminAdventureChapter[]> {
  const result = await apiRequest<{ chapters: AdminAdventureChapter[] }>("/api/adventure/admin/chapters");
  return result.chapters;
}

export function createAdminChapter(input: AdventureChapterAdminInput): Promise<AdminAdventureChapter> {
  return apiRequest<AdminAdventureChapter>("/api/adventure/admin/chapters", {
    method: "POST",
    body: input
  });
}

export function updateAdminChapter(
  chapterId: string,
  input: AdventureChapterAdminInput
): Promise<AdminAdventureChapter> {
  return apiRequest<AdminAdventureChapter>(`/api/adventure/admin/chapters/${chapterId}`, {
    method: "PUT",
    body: input
  });
}

export function setAdminChapterStatus(
  chapterId: string,
  status: AdventureChapterStatus
): Promise<AdminAdventureChapter> {
  return apiRequest<AdminAdventureChapter>(`/api/adventure/admin/chapters/${chapterId}/status`, {
    method: "POST",
    body: { status }
  });
}

export async function reorderAdminChapters(orderedIds: string[]): Promise<AdminAdventureChapter[]> {
  const result = await apiRequest<{ chapters: AdminAdventureChapter[] }>("/api/adventure/admin/chapters/reorder", {
    method: "POST",
    body: { orderedIds }
  });
  return result.chapters;
}
