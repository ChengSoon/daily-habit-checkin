import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

/**
 * 全屏图片预览：点击遮罩或关闭按钮退出。
 * 仅展示，不负责业务逻辑。
 */
export function ImagePreviewModal({
  uri,
  title,
  visible,
  onClose
}: {
  uri: string | null;
  title?: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  if (!uri) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { backgroundColor: "rgba(12, 16, 28, 0.92)" }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭预览" />

        <View
          pointerEvents="box-none"
          style={[
            styles.header,
            {
              paddingTop: Math.max(insets.top, 12) + 4,
              paddingHorizontal: 16
            }
          ]}
        >
          <View style={{ flex: 1, paddingRight: 12 }}>
            {title ? (
              <AppText variant="bodyStrong" numberOfLines={1} style={{ color: "#FFFFFF" }}>
                {title}
              </AppText>
            ) : (
              <AppText variant="small" style={{ color: "rgba(255,255,255,0.7)" }}>
                图片预览
              </AppText>
            )}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="关闭"
            onPress={onClose}
            hitSlop={10}
            style={({ pressed }) => [
              styles.closeBtn,
              {
                backgroundColor: pressed ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.14)"
              }
            ]}
          >
            <Ionicons name="close" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        <View
          pointerEvents="box-none"
          style={[
            styles.stage,
            {
              paddingBottom: Math.max(insets.bottom, 16) + 8
            }
          ]}
        >
          <Image
            source={{ uri }}
            style={{
              width: width - 32,
              height: Math.min(height * 0.72, width * 1.15),
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.04)"
            }}
            contentFit="contain"
            transition={160}
          />
          <AppText variant="small" style={{ color: "rgba(255,255,255,0.55)", marginTop: 14 }}>
            轻触空白处关闭
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 2
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center"
  },
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  }
});
