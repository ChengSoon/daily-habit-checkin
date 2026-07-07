import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Animated, Easing, Pressable, TextInput, View, ViewStyle } from "react-native";
import {
  Account,
  getCurrentAccount,
  joinSpace,
  login,
  logout,
  refreshAccount,
  register,
  updateMyAvatar
} from "../src/sync/authService";
import { PickedImage } from "../src/rewards/rewardImage";
import { uploadImage } from "../src/sync/uploadClient";
import { AppButton, AppText, Badge, HelperText, Label, SectionCard, SegmentedControl, TextField } from "../src/ui/Controls";
import { CoupleAvatars } from "../src/ui/Avatar";
import { AvatarPicker } from "../src/ui/AvatarPicker";
import { useCouple } from "../src/ui/useCouple";
import { Screen } from "../src/ui/Screen";
import { radius, spacing } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeContext";

type Mode = "login" | "register";

export default function AccountScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const couple = useCouple();
  const reloadCouple = couple.reload;
  const { reloadTheme } = useTheme();

  const load = useCallback(async () => {
    const current = await getCurrentAccount();
    setAccount(current);
    if (current) {
      // 后台刷新一次，拿到最新邀请码/空间
      refreshAccount().then((fresh) => {
        if (fresh) {
          setAccount(fresh);
        }
      });
    }
    reloadCouple();
  }, [reloadCouple]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function submit() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result =
        mode === "register"
          ? await register({ email: email.trim(), displayName: displayName.trim(), password })
          : await login({ email: email.trim(), password });
      setAccount(result);
      setMessage(mode === "register" ? "注册成功，已创建你们的空间" : "登录成功");
      setPassword("");
      // 登录态刚建立，把该账号已保存的主题从服务端拉回来，否则会停在默认主题。
      reloadTheme();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function doJoinSpace() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await joinSpace(inviteCode.trim());
      setAccount(result);
      setInviteCode("");
      setMessage("已加入对方的空间，数据将开始共享");
      // 空间变了，主题也可能不同，重新拉取。
      reloadTheme();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "加入失败");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    await logout();
    setAccount(null);
    setMessage("已退出登录");
    // 已登出，未登录时 getAppSettings 会抛错被 catch，主题自然回退到默认。
    reloadTheme();
  }

  async function handleAvatarChange(image: PickedImage | null) {
    setError(null);
    setMessage(null);
    try {
      // 有图先直传 R2 拿到 key，再把 key 提交给后端；移除则传 null 清空。
      const key = image ? await uploadImage("avatar", image) : null;
      await updateMyAvatar(key);
      reloadCouple();
      setMessage(image ? "头像已更新" : "已移除头像");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "更新头像失败");
    }
  }

  // couple.you 携带当前账号的头像数据（来自成员接口）。
  const myTone = couple.you?.tone ?? "you";

  if (account) {
    const paired = !!couple.partner;
    return (
      <Screen>
        <AppText variant="display">账号与同步</AppText>

        <SectionCard title="当前账号">
          <AvatarPicker
            name={account.displayName}
            tone={myTone}
            imageUri={couple.you?.avatarUrl}
            onChange={handleAvatarChange}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ gap: spacing.xs, flex: 1 }}>
              <AppText variant="bodyStrong">{account.displayName}</AppText>
              <AppText variant="small" tone="muted">
                {account.email}
              </AppText>
            </View>
            {couple.people.length > 0 ? (
              <CoupleAvatars
                people={couple.people.map((person) => ({
                  name: person.name,
                  tone: person.tone,
                  imageUri: person.avatarUrl
                }))}
                size={40}
              />
            ) : null}
          </View>
          {paired ? (
            <AppText variant="small" tone="muted">
              你和 {couple.partner!.name} 正在共享同一个空间 💞
            </AppText>
          ) : (
            <View style={{ gap: spacing.xs }}>
              <Label>邀请码 · 发给另一半即可同步</Label>
              <Badge label={account.inviteCode ?? "—"} tone="primary" />
            </View>
          )}
        </SectionCard>

        {!paired ? (
          <SectionCard title="加入对方的空间">
            <AppText variant="small" tone="muted">
              填入对方的邀请码共享数据，当前空间数据会被替换。
            </AppText>
            <TextField label="邀请码" value={inviteCode} onChangeText={setInviteCode} placeholder="输入 8 位邀请码" />
            <AppButton title="加入空间" onPress={doJoinSpace} disabled={busy || inviteCode.trim().length < 4} />
          </SectionCard>
        ) : null}

        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}

        <AppButton title="退出登录" variant="ghost" onPress={doLogout} disabled={busy} />
      </Screen>
    );
  }

  const isRegister = mode === "register";
  const canSubmit = !busy && !!email.trim() && password.length >= 6 && (!isRegister || !!displayName.trim());

  return (
    <Screen>
      {/* 头部：可点击的心跳连心头像作品牌标识，点一下会心跳并飘出爱心。 */}
      <View style={{ alignItems: "center", gap: spacing.md, paddingTop: spacing.xl, paddingBottom: spacing.lg }}>
        <HeartBeatBrand />
        <ModeCrossfade mode={mode}>
          <AppText variant="title" style={{ textAlign: "center" }}>
            {isRegister ? "创建你们的空间" : "欢迎回来"}
          </AppText>
          <AppText variant="small" tone="muted" style={{ textAlign: "center" }}>
            {isRegister ? "注册账号，和另一半一起打卡" : "登录以继续你们的打卡"}
          </AppText>
        </ModeCrossfade>
      </View>

      {/* 登录/注册表单——本页主角，设计感集中在这里 */}
      <View style={{ gap: spacing.lg }}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { label: "登录", value: "login" },
            { label: "注册", value: "register" }
          ]}
        />

        <ModeCrossfade mode={mode} style={{ gap: spacing.md }}>
          <AuthField
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {isRegister ? (
            <AuthField
              icon="person-outline"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="昵称（想让对方怎么称呼你）"
            />
          ) : null}
          <AuthField
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            placeholder="密码（至少 6 位）"
            secureToggle
          />
        </ModeCrossfade>

        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}

        <AppButton
          title={isRegister ? "注册并创建空间" : "登录"}
          onPress={submit}
          disabled={!canSubmit}
        />
      </View>
    </Screen>
  );
}

/**
 * 登录页专用输入框：左侧图标 + 聚焦时高亮边框 + 密码显隐切换。
 * 比通用 TextField 更强调「聚焦感」，让表单成为页面视觉焦点。
 */
function AuthField({
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  secureToggle = false
}: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?: "email-address" | "default";
  autoCapitalize?: "none" | "sentences";
  secureToggle?: boolean;
}) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(secureToggle);

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        minHeight: 54,
        borderRadius: radius.md,
        borderWidth: 1.5,
        borderColor: focused ? colors.primary : colors.line,
        backgroundColor: colors.inputBackground,
        paddingHorizontal: spacing.md
      }}
    >
      <Ionicons name={icon} size={20} color={focused ? colors.primaryInk : colors.faint} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        secureTextEntry={hidden}
        style={{
          flex: 1,
          fontSize: 16,
          color: colors.ink,
          paddingVertical: spacing.md
        }}
      />
      {secureToggle ? (
        <Pressable onPress={() => setHidden((prev) => !prev)} hitSlop={8} accessibilityLabel={hidden ? "显示密码" : "隐藏密码"}>
          <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={20} color={colors.faint} />
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * 登录/注册切换时的过渡：mode 每次变化，子内容淡入 + 轻微上移，
 * 让「登录 ↔ 注册」的切换有柔和的呼吸感，而不是硬切。
 */
function ModeCrossfade({
  mode,
  children,
  style
}: {
  mode: Mode;
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    opacity.setValue(0);
    translateY.setValue(8);
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start();
  }, [mode, opacity, translateY]);

  return <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>{children}</Animated.View>;
}

/**
 * 可点击的心跳连心头像：点一下头像会「心跳」弹一下，并从中心飘出几颗爱心，
 * 呼应「两个人一起」的软件特点，给登录页一个有情绪的小彩蛋。
 */
function HeartBeatBrand() {
  const { colors } = useTheme();
  const [scale] = useState(() => new Animated.Value(1));
  // 三颗飘心，各自的动画进度 0→1。
  const [hearts] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));

  function celebrate() {
    // 头像心跳：快速放大再回弹。
    Animated.sequence([
      Animated.timing(scale, { toValue: 1.18, duration: 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, tension: 140, useNativeDriver: true })
    ]).start();

    // 飘心：三颗依次上飘并淡出。
    hearts.forEach((heart, index) => {
      heart.setValue(0);
      Animated.timing(heart, {
        toValue: 1,
        duration: 900,
        delay: index * 90,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }).start();
    });
  }

  return (
    <Pressable onPress={celebrate} accessibilityRole="button" accessibilityLabel="心动一下">
      <View style={{ alignItems: "center", justifyContent: "center" }}>
        {/* 飘心层：绝对定位在头像上方，点击时向上飘散。 */}
        {hearts.map((heart, index) => {
          const offset = (index - 1) * 26; // 左中右散开
          return (
            <Animated.View
              key={index}
              pointerEvents="none"
              style={{
                position: "absolute",
                opacity: heart.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 1, 0] }),
                transform: [
                  { translateX: offset },
                  { translateY: heart.interpolate({ inputRange: [0, 1], outputRange: [0, -60] }) },
                  { scale: heart.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.1] }) }
                ]
              }}
            >
              <Ionicons name="heart" size={18} color={index % 2 === 0 ? colors.primary : colors.partner} />
            </Animated.View>
          );
        })}
        <Animated.View style={{ transform: [{ scale }] }}>
          <CoupleAvatars
            people={[
              { name: "你", tone: "you" },
              { name: "TA", tone: "partner" }
            ]}
            size={52}
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}
