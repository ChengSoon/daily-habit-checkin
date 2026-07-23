import { useCallback, useState } from "react";
import { publicUrl, uploadImage } from "../sync/uploadClient";
import { useSyncScreen } from "../ui/SyncScreen";
import { createReward, listRewards, updateReward } from "./rewardRepository";
import type { PickedImage } from "./rewardImage";
import type { Reward, RewardType, VirtualRewardKind } from "./types";

type RewardForm = {
  editing: Reward | null;
  title: string;
  description: string;
  type: RewardType;
  priceXp: string;
  virtualKind: VirtualRewardKind;
  imageKey: string | null;
  picked: PickedImage | null;
};

const EMPTY_FORM: RewardForm = {
  editing: null,
  title: "",
  description: "",
  type: "real_world",
  priceXp: "300",
  virtualKind: "none",
  imageKey: null,
  picked: null
};

function useRewardForm() {
  const [form, setForm] = useState<RewardForm>(EMPTY_FORM);
  const reset = () => setForm(EMPTY_FORM);
  const edit = (reward: Reward) => setForm({
    editing: reward,
    title: reward.title,
    description: reward.description ?? "",
    type: reward.type,
    priceXp: String(reward.priceXp),
    virtualKind: reward.virtualKind,
    imageKey: reward.imageKey,
    picked: null
  });
  const change = <Key extends keyof RewardForm>(key: Key) => (value: RewardForm[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const pickImage = (image: PickedImage | null) => {
    setForm((current) => ({ ...current, picked: image, ...(image ? {} : { imageKey: null }) }));
  };
  return { form, setForm, reset, edit, change, pickImage };
}

type RewardFormController = ReturnType<typeof useRewardForm>;

async function saveRewardForm(form: RewardForm) {
  const imageKey = form.picked ? await uploadImage("reward", form.picked) : form.imageKey;
  const input = {
    title: form.title,
    description: form.description || null,
    type: form.type,
    priceXp: Number(form.priceXp),
    status: form.editing?.status ?? "active",
    virtualKind: form.type === "virtual" ? form.virtualKind : "none",
    inventoryLimit: null,
    imageKey
  } as const;
  if (form.editing) return updateReward(form.editing.id, input);
  return createReward(input);
}

function useRewardCommands(options: {
  form: RewardFormController;
  reload: () => Promise<void>;
  setMessage: (message: string | null) => void;
  setError: (error: string | null) => void;
}) {
  const { form, reload, setMessage, setError } = options;
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await action();
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  };
  const save = () => run(async () => {
    const editing = form.form.editing !== null;
    await saveRewardForm(form.form);
    setMessage(editing ? "奖励已更新" : "奖励已新增");
    form.reset();
    await reload();
  });
  const toggleArchived = (reward: Reward) => run(async () => {
    await updateReward(reward.id, {
      title: reward.title,
      description: reward.description,
      type: reward.type,
      priceXp: reward.priceXp,
      status: reward.status === "active" ? "archived" : "active",
      virtualKind: reward.virtualKind,
      inventoryLimit: reward.inventoryLimit,
      imageKey: reward.imageKey
    });
    setMessage(reward.status === "active" ? "奖励已下架" : "奖励已重新上架");
    await reload();
  });
  return { busy, save, toggleArchived };
}

export function useAdminRewardsController() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => setRewards(await listRewards({ includeArchived: true })), []);
  const sync = useSyncScreen(load);
  const form = useRewardForm();
  const commands = useRewardCommands({ form, reload: sync.reload, setMessage, setError });
  const previewUri = form.form.picked?.uri ?? publicUrl(form.form.imageKey);
  const edit = (reward: Reward) => {
    form.edit(reward);
    setMessage(null);
    setError(null);
  };
  return { rewards, message, error, sync, previewUri, ...form, ...commands, edit };
}

export type AdminRewardsController = ReturnType<typeof useAdminRewardsController>;
