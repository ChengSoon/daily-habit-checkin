import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "./theme";
import { useTheme } from "./ThemeContext";

export function Screen({
  children,
  scroll = true
}: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingBottom: spacing.xxl + insets.bottom,
    paddingHorizontal: spacing.lg,
    // 顶部留白叠加安全区，避免标题被状态栏 / 灵动岛遮挡
    paddingTop: spacing.lg + insets.top
  };

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={[styles.content, styles.flex, padding]}>{children}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, padding]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg
  }
});
