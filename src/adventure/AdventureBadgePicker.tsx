import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from "react-native";
import { AppText, Label } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { pickAdventureBadgeFromLibrary, type PickedBadgeImage } from "./adventureBadgeImage";

export function AdventureBadgePicker({
  previewUri,
  disabled = false,
  onChange
}: {
  previewUri: string | null;
  disabled?: boolean;
  onChange: (image: PickedBadgeImage | null) => void;
}) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);

  async function choose() {
    setBusy(true);
    try {
      const result = await pickAdventureBadgeFromLibrary();
      if (result.status === "picked") onChange(result.image);
      if (result.status === "denied") {
        Alert.alert("需要权限", "请在系统设置中允许访问相册后再试。");
      }
    } catch (error) {
      Alert.alert("无法使用图片", error instanceof Error ? error.message : "请选择其他图片后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <Label>勋章设计</Label>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={previewUri ? "更换勋章图片" : "上传勋章图片"}
        disabled={busy || disabled}
        onPress={choose}
        style={({ pressed }) => [
          styles.picker,
          { backgroundColor: colors.surfaceMuted, borderColor: colors.line },
          pressed && !busy && !disabled ? { opacity: 0.84 } : null
        ]}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} contentFit="cover" style={styles.image} />
        ) : (
          <View style={styles.placeholder}>
            <Ionicons name="cloud-upload-outline" size={30} color={colors.primaryInk} />
            <AppText variant="bodyStrong" tone="primary">上传自己的勋章</AppText>
            <AppText variant="small" tone="muted">JPEG、PNG、WebP · 最大 5 MB</AppText>
          </View>
        )}
        {busy ? (
          <View style={[StyleSheet.absoluteFill, styles.busy, { backgroundColor: colors.overlay }] }>
            <ActivityIndicator color={colors.onPrimary} />
          </View>
        ) : null}
      </Pressable>
      {previewUri ? (
        <View style={styles.actions}>
          <Pressable onPress={choose} disabled={busy || disabled} hitSlop={6}>
            <AppText variant="small" tone="primary">替换图片</AppText>
          </Pressable>
          <Pressable onPress={() => onChange(null)} disabled={busy || disabled} hitSlop={6}>
            <AppText variant="small" tone="danger">移除图片</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: {
    alignItems: "center",
    aspectRatio: 1,
    alignSelf: "flex-start",
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: "center",
    maxWidth: 220,
    overflow: "hidden",
    width: "62%"
  },
  image: { height: "100%", width: "100%" },
  placeholder: { alignItems: "center", gap: spacing.xs, padding: spacing.md },
  busy: { alignItems: "center", justifyContent: "center" },
  actions: { flexDirection: "row", gap: spacing.lg }
});
