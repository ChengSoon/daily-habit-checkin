import { useCallback, useState } from "react";
import type { PickedImage } from "../rewards/rewardImage";
import { publicUrl, uploadImage } from "../sync/uploadClient";
import { useSyncScreen } from "../ui/SyncScreen";
import {
  changeAdminChapterStatus,
  loadAdminChapters,
  moveAdminChapter,
  saveAdminChapter
} from "./adventureService";
import { statusLabel } from "./AdminAdventureList";
import type { AdminAdventureChapter, AdventureChapterStatus, AdventureRewardType } from "./types";

type AdventureFormState = {
  editingId: string | null;
  title: string;
  subtitle: string;
  storyText: string;
  thresholdLifetimeXp: string;
  badgeName: string;
  badgeDescription: string;
  badgeEmoji: string;
  rewardType: AdventureRewardType;
  status: AdventureChapterStatus;
  badgeImageKey: string | null;
  nodeImageKey: string | null;
  backgroundImageKey: string | null;
  mapThemeKey: string;
  badgePicked: PickedImage | null;
  nodePicked: PickedImage | null;
  backgroundPicked: PickedImage | null;
};

function emptyForm(threshold: number): AdventureFormState {
  return {
    editingId: null,
    title: "",
    subtitle: "",
    storyText: "",
    thresholdLifetimeXp: String(threshold),
    badgeName: "",
    badgeDescription: "",
    badgeEmoji: "🏅",
    rewardType: "badge_story",
    status: "published",
    badgeImageKey: null,
    nodeImageKey: null,
    backgroundImageKey: null,
    mapThemeKey: "lighthouse",
    badgePicked: null,
    nodePicked: null,
    backgroundPicked: null
  };
}

function formFromChapter(chapter: AdminAdventureChapter): AdventureFormState {
  return {
    editingId: chapter.id,
    title: chapter.title,
    subtitle: chapter.subtitle ?? "",
    storyText: chapter.storyText,
    thresholdLifetimeXp: String(chapter.thresholdLifetimeXp),
    badgeName: chapter.badgeName,
    badgeDescription: chapter.badgeDescription ?? "",
    badgeEmoji: chapter.badgeEmoji ?? "🏅",
    rewardType: chapter.rewardType === "real_pending" ? "real_pending" : "badge_story",
    status: chapter.status,
    badgeImageKey: chapter.badgeImageKey,
    nodeImageKey: chapter.nodeImageKey,
    backgroundImageKey: chapter.backgroundImageKey,
    mapThemeKey: chapter.mapThemeKey ?? "lighthouse",
    badgePicked: null,
    nodePicked: null,
    backgroundPicked: null
  };
}

async function uploadFormImages(form: AdventureFormState) {
  const badgeImageKey = form.badgePicked ? await uploadImage("adventure", form.badgePicked) : form.badgeImageKey;
  const nodeImageKey = form.nodePicked ? await uploadImage("adventure", form.nodePicked) : form.nodeImageKey;
  const backgroundImageKey = form.backgroundPicked
    ? await uploadImage("adventure", form.backgroundPicked) : form.backgroundImageKey;
  return { badgeImageKey, nodeImageKey, backgroundImageKey };
}

async function persistForm(form: AdventureFormState) {
  const threshold = Number(form.thresholdLifetimeXp);
  if (!Number.isFinite(threshold) || threshold < 0) throw new Error("门槛 XP 必须是非负数字");
  const images = await uploadFormImages(form);
  await saveAdminChapter({
    title: form.title,
    subtitle: form.subtitle || null,
    storyText: form.storyText,
    thresholdLifetimeXp: Math.trunc(threshold),
    badgeName: form.badgeName,
    badgeDescription: form.badgeDescription || null,
    badgeEmoji: form.badgeEmoji || null,
    ...images,
    mapThemeKey: form.mapThemeKey || null,
    rewardType: form.rewardType,
    status: form.status
  }, form.editingId ?? undefined);
}

function useAdventureForm(chapters: AdminAdventureChapter[]) {
  const [form, setForm] = useState(() => emptyForm(50));
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reset = () => {
    const threshold = (chapters[chapters.length - 1]?.thresholdLifetimeXp ?? 0) + 100;
    setForm(emptyForm(threshold));
    setMessage(null);
    setError(null);
  };
  const edit = (chapter: AdminAdventureChapter) => {
    setForm(formFromChapter(chapter));
    setMessage(null);
    setError(null);
  };
  const change = <Key extends keyof AdventureFormState>(key: Key) => (value: AdventureFormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const changeImage = (pickedKey: "badgePicked" | "nodePicked" | "backgroundPicked",
    imageKey: "badgeImageKey" | "nodeImageKey" | "backgroundImageKey") => (image: PickedImage | null) => {
    setForm((current) => ({ ...current, [pickedKey]: image, ...(image ? {} : { [imageKey]: null }) }));
  };
  const previews = {
    badge: form.badgePicked?.uri ?? publicUrl(form.badgeImageKey),
    node: form.nodePicked?.uri ?? publicUrl(form.nodeImageKey),
    background: form.backgroundPicked?.uri ?? publicUrl(form.backgroundImageKey)
  };
  return { form, setForm, message, setMessage, error, setError, reset, edit, change, changeImage, previews };
}

type AdventureFormController = ReturnType<typeof useAdventureForm>;

function useAdminCommands(options: {
  chapters: AdminAdventureChapter[];
  setChapters: (chapters: AdminAdventureChapter[]) => void;
  form: AdventureFormController;
  reload: () => Promise<void>;
}) {
  const { chapters, setChapters, form, reload } = options;
  const [busy, setBusy] = useState(false);
  const runBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    form.setError(null);
    try {
      await action();
    } catch (caught) {
      form.setError(caught instanceof Error ? caught.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  const save = () => runBusy(async () => {
    form.setMessage(null);
    const editing = form.form.editingId !== null;
    await persistForm(form.form);
    const threshold = (chapters[chapters.length - 1]?.thresholdLifetimeXp ?? 0) + 100;
    form.setForm(emptyForm(threshold));
    form.setMessage(editing ? "章节已更新" : "章节已创建");
    await reload();
  });
  const move = async (chapterId: string, direction: "up" | "down") => runBusy(async () => {
    setChapters(await moveAdminChapter(chapters, chapterId, direction));
    form.setMessage("排序已更新");
  });
  const changeStatus = async (chapter: AdminAdventureChapter, next: AdventureChapterStatus) => {
    if (chapter.status === next) return;
    await runBusy(async () => {
      await changeAdminChapterStatus(chapter.id, next);
      form.setMessage(`已设为${statusLabel(next)}`);
      await reload();
    });
  };
  return { busy, save, move, changeStatus };
}

export function useAdminAdventureController() {
  const [chapters, setChapters] = useState<AdminAdventureChapter[]>([]);
  const load = useCallback(async () => setChapters(await loadAdminChapters()), []);
  const sync = useSyncScreen(load);
  const form = useAdventureForm(chapters);
  const commands = useAdminCommands({ chapters, setChapters, form, reload: sync.reload });
  return { chapters, ...form, ...commands, sync };
}

export type AdminAdventureController = ReturnType<typeof useAdminAdventureController>;
