import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { pickRewardImageFromLibrary, PickedImage, toDataUri } from "../rewards/rewardImage";
import { AppText } from "./Controls";
import { AvatarTone } from "./Avatar";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

/**
 * 圆形头像选择器，用于账号页上传/更换自己的头像。
 * 复用奖励图片的选择+压缩链路（pickRewardImageFromLibrary：内部含权限、最长边缩放、
 * JPEG 0.7、base64）。上传/移除都通过 onChange 回调交给页面调用后端。
 */
export function AvatarPicker({
  name,
  tone,
  imageData,
  imageMime,
  onChange,
  size = 84
}: {
  name: string;
  tone: AvatarTone;
  imageData?: string | null;
  imageMime?: string | null;
  /** 传 PickedImage 上传新头像，传 null 移除头像。 */
  onChange: (image: PickedImage | null) => Promise<void> | void;
  size?: number;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bg = tone === "you" ? colors.primary : colors.partner;
  const fg = tone === "you" ? colors.onPrimary : colors.onPartner;
  const currentUri = toDataUri(imageData ?? null, imageMime ?? null);
  const first = [...name.trim()][0]?.toUpperCase() ?? "?";

  async function pick() {
    setError(null);
    setBusy(true);
    try {
      const result = await pickRewardImageFromLibrary();
      if (result.status === "denied") {
        setError("需要相册权限才能选择头像");
        return;
      }
      if (result.status === "cancelled") {
        return;
      }
      await onChange(result.image);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "头像上传失败");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setError(null);
    setBusy(true);
    try {
      await onChange(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "移除头像失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <Pressable
          onPress={pick}
          disabled={busy}
          accessibilityLabel="更换头像"
          style={({ pressed }) => [{ opacity: pressed || busy ? 0.7 : 1 }]}
        >
          <View
            style={{
              width: size,
              height: size,
              borderRadius: radius.pill,
              backgroundColor: bg,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden"
            }}
          >
            {currentUri ? (
              <Image source={{ uri: currentUri }} style={{ width: size, height: size }} />
            ) : (
              <AppText style={{ color: fg, fontSize: size * 0.4, fontWeight: "700", lineHeight: size * 0.48 }}>
                {first}
              </AppText>
            )}
          </View>
          {/* 相机角标，提示可点按更换 */}
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 28,
              height: 28,
              borderRadius: radius.pill,
              backgroundColor: colors.surface,
              borderWidth: 1,
              borderColor: colors.line,
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <Ionicons name="camera" size={15} color={colors.primaryInk} />
          </View>
        </Pressable>

        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="bodyStrong">我的头像</AppText>
          <AppText variant="small" tone="muted">
            {busy ? "处理中…" : currentUri ? "点按头像更换" : "点按头像，从相册选一张"}
          </AppText>
          {currentUri ? (
            <Pressable onPress={remove} disabled={busy} hitSlop={6} style={{ alignSelf: "flex-start" }}>
              <AppText variant="small" tone="danger">
                移除头像
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </View>
      {error ? (
        <AppText variant="small" style={{ color: colors.danger }}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
}
