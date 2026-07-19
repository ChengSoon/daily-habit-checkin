import { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "./ThemeContext";

/** 页面壳：board 干净 --bg，内边距贴近 .screen。 */
export function Screen({
  children,
  scroll = true
}: PropsWithChildren<{ scroll?: boolean }>) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  // board .screen: padding 10px 16px 18px（安全区外再贴 board 节奏）
  const padding = {
    paddingBottom: 24 + insets.bottom,
    paddingHorizontal: 16,
    paddingTop: 10 + insets.top
  };

  // board 手机壳内是干净 --bg，不做全页装饰光晕
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
    gap: 12 // board 8-12 节奏
  }
});
