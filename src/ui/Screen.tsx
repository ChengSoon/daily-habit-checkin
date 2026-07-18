import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { spacing } from "./theme";
import { useTheme } from "./ThemeContext";

/** 页面壳：浅灰白底 + 角落糖果色光晕，贴近设计稿氛围。 */
export function Screen({
  children,
  scroll = true
}: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const padding = {
    paddingBottom: spacing.xxl + insets.bottom,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg + insets.top
  };

  const ambience =
    scheme === "dark" ? null : (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View
          style={{
            position: "absolute",
            top: -40,
            left: -30,
            width: 180,
            height: 180,
            borderRadius: 999,
            backgroundColor: colors.candySun,
            opacity: 0.12
          }}
        />
        <View
          style={{
            position: "absolute",
            top: 20,
            right: -50,
            width: 200,
            height: 200,
            borderRadius: 999,
            backgroundColor: colors.partner,
            opacity: 0.1
          }}
        />
        <View
          style={{
            position: "absolute",
            bottom: 80,
            left: 40,
            width: 220,
            height: 220,
            borderRadius: 999,
            backgroundColor: colors.success,
            opacity: 0.08
          }}
        />
      </View>
    );

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        {ambience}
        <View style={[styles.content, styles.flex, padding]}>{children}</View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {ambience}
      <ScrollView
        style={{ backgroundColor: "transparent" }}
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
    gap: spacing.md + 2
  }
});
