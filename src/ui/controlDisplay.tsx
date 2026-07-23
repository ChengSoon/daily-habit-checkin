import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { AppText } from "./controlText";
import { numberLetterSpacing, radius } from "./theme";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

export function Label({ children }: PropsWithChildren) {
  return (
    <AppText variant="small" tone="soft" style={{ fontWeight: "800", fontSize: 13 }}>
      {children}
    </AppText>
  );
}

export function HelperText({ children, tone = "muted" }: PropsWithChildren<{
  tone?: "muted" | "danger" | "success";
}>) {
  const { colors } = useTheme();
  const color = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.muted;
  return <AppText variant="small" style={{ color }}>{children}</AppText>;
}

export function StatTile({ label, value, tint, labelColor, valueColor }: {
  label: string;
  value: string;
  tint?: string;
  labelColor?: string;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  const foreground = valueColor ?? colors.primaryInk;
  return (
    <View style={{
      flex: 1,
      minWidth: 96,
      borderRadius: 15,
      backgroundColor: tint ?? colors.surfaceTint,
      paddingHorizontal: 12,
      paddingVertical: 11,
      gap: 4
    }}>
      <AppText variant="small" style={{
        color: labelColor ?? foreground,
        fontWeight: "800",
        fontSize: 12,
        lineHeight: 16
      }}>
        {label}
      </AppText>
      <AppText variant="title" style={{
        color: foreground,
        fontSize: 26,
        lineHeight: 32,
        letterSpacing: numberLetterSpacing,
        fontFamily: "Outfit_800ExtraBold"
      }}>
        {value}
      </AppText>
    </View>
  );
}

export function Badge({ label, tone = "neutral" }: {
  label: string;
  tone?: "neutral" | "success" | "primary" | "danger" | "muted";
}) {
  const { colors } = useTheme();
  const tones = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkSoft },
    success: { bg: colors.successSurface, fg: colors.candyMintInk },
    primary: { bg: colors.surfaceTint, fg: colors.primaryInk },
    danger: { bg: colors.dangerSurface, fg: colors.danger },
    muted: { bg: colors.surfaceMuted, fg: colors.muted }
  } as const;
  const { bg, fg } = tones[tone];
  return (
    <View style={{
      alignSelf: "flex-start",
      borderRadius: radius.pill,
      backgroundColor: bg,
      paddingHorizontal: 9,
      paddingVertical: 4
    }}>
      <Text style={{
        fontSize: 12,
        lineHeight: 16,
        fontWeight: "800",
        fontFamily: "Nunito_800ExtraBold",
        color: fg
      }}>
        {label}
      </Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
}

export function ListRow({ onPress, children, right, icon, iconBg, iconColor }: PropsWithChildren<{
  onPress?: () => void;
  right?: ReactNode;
  icon?: IoniconName;
  iconBg?: string;
  iconColor?: string;
}>) {
  const { colors } = useTheme();
  const body = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 }}>
      {icon ? (
        <View style={{
          width: 38,
          height: 38,
          borderRadius: 13,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: iconBg ?? colors.surfaceMuted
        }}>
          <Ionicons name={icon} size={16} color={iconColor ?? colors.primaryInk} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={15} color={colors.faint} /> : null)}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.6 } : null}>
      {body}
    </Pressable>
  );
}
