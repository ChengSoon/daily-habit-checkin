import {
  claimAdventureChapter,
  createAdminChapter,
  fetchAdminChapters,
  fetchAdventureState,
  reorderAdminChapters,
  setAdminChapterStatus,
  updateAdminChapter
} from "./adventureClient";
import type {
  AdminAdventureChapter,
  AdventureChapterAdminInput,
  AdventureChapterStatus,
  AdventureState
} from "./types";

export async function loadAdventureState(): Promise<AdventureState> {
  return fetchAdventureState();
}

export async function claimChapter(chapterId: string): Promise<AdventureState> {
  return claimAdventureChapter(chapterId);
}

export async function loadAdminChapters(): Promise<AdminAdventureChapter[]> {
  return fetchAdminChapters();
}

export async function saveAdminChapter(
  input: AdventureChapterAdminInput,
  chapterId?: string
): Promise<AdminAdventureChapter> {
  if (chapterId) {
    return updateAdminChapter(chapterId, input);
  }
  return createAdminChapter(input);
}

export async function changeAdminChapterStatus(
  chapterId: string,
  status: AdventureChapterStatus
): Promise<AdminAdventureChapter> {
  return setAdminChapterStatus(chapterId, status);
}

export async function moveAdminChapter(
  chapters: AdminAdventureChapter[],
  chapterId: string,
  direction: "up" | "down"
): Promise<AdminAdventureChapter[]> {
  const index = chapters.findIndex((chapter) => chapter.id === chapterId);
  if (index < 0) {
    return chapters;
  }
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= chapters.length) {
    return chapters;
  }
  const ordered = chapters.map((chapter) => chapter.id);
  const [removed] = ordered.splice(index, 1);
  ordered.splice(target, 0, removed);
  return reorderAdminChapters(ordered);
}
