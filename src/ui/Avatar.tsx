import { Ionicons } from "@expo/vector-icons";
import { Image, View } from "react-native";
import { toDataUri } from "../rewards/rewardImage";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

/**
 * 情侣双人分色头像。当前登录者=you（粉），另一半=partner（紫）。
 * 上传过头像则显示图片，否则用昵称首字生成圆形字母头像。
 */
export type AvatarTone = "you" | "partner";

/** 取昵称的首个可见字符作为头像文字（中文取首字，英文取首字母大写）。 */
function initial(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "?";
  }
  const first = [...trimmed][0];
  return first.toUpperCase();
}

export function Avatar({
  name,
  tone,
  size = 32,
  showRing = false,
  imageData,
  imageMime
}: {
  name: string;
  tone: AvatarTone;
  size?: number;
  showRing?: boolean;
  /** 自定义头像 base64；有则显示图片，无则回退字母头像。 */
  imageData?: string | null;
  imageMime?: string | null;
}) {
  const { colors } = useTheme();
  const bg = tone === "you" ? colors.primary : colors.partner;
  const fg = tone === "you" ? colors.onPrimary : colors.onPartner;
  const imageUri = imageData && imageMime ? toDataUri(imageData, imageMime) : null;

  return (
    <View
      accessibilityLabel={name}
      style={{
        width: size,
        height: size,
        borderRadius: radius.pill,
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        borderWidth: showRing ? 2 : 0,
        borderColor: colors.surface
      }}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={{ width: size, height: size }} />
      ) : (
        <AppText style={{ color: fg, fontSize: size * 0.42, fontWeight: "700", lineHeight: size * 0.5 }}>
          {initial(name)}
        </AppText>
      )}
    </View>
  );
}

export type CouplePerson = {
  name: string;
  tone: AvatarTone;
  imageData?: string | null;
  imageMime?: string | null;
};

/**
 * 成对头像：两个头像重叠，下方一条「粉→紫」双色丝带 + 中心爱心，营造「你们俩连着心」。
 * 只有一个人时显示单个头像 + 虚线占位圈，暗示「邀请另一半」，丝带隐藏。
 */
export function CoupleAvatars({
  people,
  size = 32,
  showRibbon = true
}: {
  people: CouplePerson[];
  size?: number;
  /** 是否显示连心丝带。紧凑场景（如列表）可关掉只保留重叠头像。 */
  showRibbon?: boolean;
}) {
  const { colors } = useTheme();
  const overlap = size * 0.3;
  const hasPartner = people.length >= 2;

  if (people.length === 0) {
    return null;
  }

  return (
    <View style={{ alignItems: "center", gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        {people.map((person, index) => (
          <View key={`${person.tone}-${index}`} style={{ marginLeft: index === 0 ? 0 : -overlap, zIndex: 2 - index }}>
            <Avatar
              name={person.name}
              tone={person.tone}
              size={size}
              showRing
              imageData={person.imageData}
              imageMime={person.imageMime}
            />
          </View>
        ))}
        {!hasPartner ? (
          <View
            style={{
              width: size,
              height: size,
              marginLeft: -overlap,
              borderRadius: radius.pill,
              borderWidth: 2,
              borderColor: colors.lineStrong,
              borderStyle: "dashed",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: colors.surfaceMuted
            }}
          >
            <AppText style={{ color: colors.faint, fontSize: size * 0.42, fontWeight: "700", lineHeight: size * 0.5 }}>
              +
            </AppText>
          </View>
        ) : null}
      </View>

      {showRibbon && hasPartner ? <HeartRibbon width={size * 1.7} /> : null}
    </View>
  );
}

/**
 * 连心丝带：一条左粉右紫的双色圆角条，中心叠一个爱心。
 * 不依赖渐变库，用两个半宽色块拼接实现「你→TA」的分色过渡感。
 */
function HeartRibbon({ width }: { width: number }) {
  const { colors } = useTheme();
  const height = 8;
  const heartSize = 14;

  return (
    <View style={{ width, height: heartSize, alignItems: "center", justifyContent: "center" }}>
      <View
        style={{
          position: "absolute",
          flexDirection: "row",
          width,
          height,
          borderRadius: radius.pill,
          overflow: "hidden"
        }}
      >
        <View style={{ flex: 1, backgroundColor: colors.primary }} />
        <View style={{ flex: 1, backgroundColor: colors.partner }} />
      </View>
      <Ionicons name="heart" size={heartSize} color={colors.primary} style={{ textShadowColor: colors.surface, textShadowRadius: 2 }} />
    </View>
  );
}

/** 头像 + 昵称的横向组合，用于账号/资料页。 */
export function AvatarWithName({
  name,
  tone,
  subtitle,
  size = 40,
  imageData,
  imageMime
}: {
  name: string;
  tone: AvatarTone;
  subtitle?: string;
  size?: number;
  imageData?: string | null;
  imageMime?: string | null;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <Avatar name={name} tone={tone} size={size} imageData={imageData} imageMime={imageMime} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{name}</AppText>
        {subtitle ? (
          <AppText variant="small" tone="muted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}
