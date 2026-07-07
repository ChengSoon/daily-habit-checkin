import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, View } from "react-native";
import {
  captureRewardImage,
  PickedImage,
  pickRewardImageFromLibrary,
  PickResult
} from "../rewards/rewardImage";
import { RewardType } from "../rewards/types";
import { AppText, Label } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

function placeholderIcon(type: RewardType): IoniconName {
  return type === "virtual" ? "sparkles-outline" : "gift-outline";
}

/**
 * 奖励图片展示。无图时用主题色背景 + 类型图标占位，保证卡片视觉统一。
 */
export function RewardImage({
  uri,
  type,
  height = 150,
  radiusToken = radius.lg
}: {
  uri: string | null;
  type: RewardType;
  height?: number;
  radiusToken?: number;
}) {
  const { colors } = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: "100%", height, borderRadius: radiusToken }}
        contentFit="cover"
        transition={180}
      />
    );
  }

  return (
    <View
      style={{
        width: "100%",
        height,
        borderRadius: radiusToken,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceTint
      }}
    >
      <Ionicons name={placeholderIcon(type)} size={Math.min(height * 0.32, 44)} color={colors.primaryInk} />
    </View>
  );
}

/**
 * 兑换记录等处使用的小缩略图。
 */
export function RewardThumb({
  uri,
  type,
  size = 48
}: {
  uri: string | null;
  type: RewardType;
  size?: number;
}) {
  const { colors } = useTheme();

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius.md }}
        contentFit="cover"
        transition={180}
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.md,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.surfaceTint
      }}
    >
      <Ionicons name={placeholderIcon(type)} size={size * 0.44} color={colors.primaryInk} />
    </View>
  );
}

/**
 * 管理页选图控件。点击后询问相册或拍照，选中后把压缩好的本地图（PickedImage）回传父组件；
 * 上传到 R2 与落库交给父组件在保存时处理。展示用 previewUri（可能是本地图或已有远程图）。
 */
export function ImagePickerField({
  label = "商品图片",
  type,
  previewUri,
  onChange
}: {
  label?: string;
  type: RewardType;
  /** 当前预览地址：新选的本地图 uri，或已有远程图的公开 URL，无图为 null。 */
  previewUri: string | null;
  /** 回传选中的本地图；传 null 表示移除。 */
  onChange: (image: PickedImage | null) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  async function run(picker: () => Promise<PickResult>) {
    setBusy(true);
    try {
      const result = await picker();
      if (result.status === "picked") {
        onChange(result.image);
      } else if (result.status === "denied") {
        Alert.alert("需要权限", "请在系统设置中允许访问相册或相机后再试。");
      }
    } catch {
      Alert.alert("选择失败", "读取图片时出错，请重试。");
    } finally {
      setBusy(false);
    }
  }

  function choose() {
    Alert.alert("添加图片", undefined, [
      { text: "从相册选择", onPress: () => run(pickRewardImageFromLibrary) },
      { text: "拍照", onPress: () => run(captureRewardImage) },
      { text: "取消", style: "cancel" }
    ]);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Label>{label}</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previewUri ? "更换图片" : "添加图片"}
        onPress={choose}
        disabled={busy}
        style={({ pressed }) => [
          {
            height: 150,
            borderRadius: radius.lg,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surfaceMuted,
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden"
          },
          pressed && !busy ? { opacity: 0.85 } : null
        ]}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
        ) : (
          <View style={{ alignItems: "center", gap: spacing.xs }}>
            <Ionicons name="image-outline" size={30} color={colors.muted} />
            <AppText variant="small" tone="muted">
              点击添加图片
            </AppText>
          </View>
        )}
        {busy ? (
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.overlay
            }}
          >
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : null}
      </Pressable>
      {previewUri ? (
        <View style={{ flexDirection: "row", gap: spacing.md }}>
          <Pressable onPress={choose} disabled={busy} hitSlop={6}>
            <AppText variant="small" tone="primary">
              更换
            </AppText>
          </Pressable>
          <Pressable onPress={() => onChange(null)} disabled={busy} hitSlop={6}>
            <AppText variant="small" tone="danger">
              移除
            </AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
