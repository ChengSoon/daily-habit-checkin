import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Alert, Animated, Easing, Pressable, TextInput, View, ViewStyle } from "react-native";
import {
  Account,
  changePassword,
  deleteMyAccount,
  getCurrentAccount,
  joinSpace,
  leaveSpace,
  login,
  logout,
  refreshAccount,
  register,
  updateMyAvatar
} from "../src/sync/authService";
import { getAuthToken } from "../src/sync/localSettings";
import { PickedImage } from "../src/rewards/rewardImage";
import { uploadImage } from "../src/sync/uploadClient";
import { AnimatedReveal } from "../src/ui/AnimatedReveal";
import { AppButton, AppText, Badge, Card, Divider, HelperText, ListRow, SectionCard, SegmentedControl, TextField } from "../src/ui/Controls";
import { CoupleAvatars } from "../src/ui/Avatar";
import { AvatarPicker } from "../src/ui/AvatarPicker";
import { useCouple } from "../src/ui/useCouple";
import { Screen } from "../src/ui/Screen";
import { sceneTint } from "../src/ui/theme";
import { useTheme } from "../src/ui/ThemeContext";
import { refreshScheduledReminders } from "../src/reminders/reminderService";
import { registerDevicePushToken } from "../src/reminders/pushTokenService";

type Mode = "login" | "register";
type AccountLoadState = "checking" | "ready";

export default function AccountScreen() {
  const { colors, scheme } = useTheme();
  const [account, setAccount] = useState<Account | null>(null);
  const [accountLoadState, setAccountLoadState] = useState<AccountLoadState>("checking");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 修改密码卡片：默认收起，点开才显示输入，避免占用主视图。
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [showAccountTools, setShowAccountTools] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const couple = useCouple();
  const reloadCouple = couple.reload;
  const { reloadTheme } = useTheme();

  const load = useCallback(async () => {
    const current = await getCurrentAccount();
    setAccount(current);
    setAccountLoadState("ready");
    if (current) {
      // 后台刷新一次，拿到最新邀请码/空间
      refreshAccount().then(async (fresh) => {
        if (fresh) {
          setAccount((visibleAccount) => (visibleAccount?.id === fresh.id ? fresh : visibleAccount));
          return;
        }
        if (!(await getAuthToken())) {
          setAccount(null);
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
      setAccountLoadState("ready");
      setMessage(mode === "register" ? "注册成功，已创建你们的空间" : "登录成功");
      setPassword("");
      // 登录态刚建立，把该账号已保存的主题从服务端拉回来，否则会停在默认主题。
      reloadTheme();
      // 登录后才能拉到习惯列表，这里补一次本地通知调度
      void refreshScheduledReminders().catch(() => undefined);
      void registerDevicePushToken();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitJoinSpace() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await joinSpace(inviteCode.trim());
      setAccount(result);
      setAccountLoadState("ready");
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

  function doJoinSpace() {
    Alert.alert("确认加入空间？", "加入后当前账号会切换到对方空间，当前个人空间数据不会再显示。", [
      { text: "取消", style: "cancel" },
      { text: "确认加入", style: "destructive", onPress: () => void submitJoinSpace() }
    ]);
  }

  async function submitChangePassword() {
    setError(null);
    setMessage(null);
    if (newPassword.length < 6) {
      setError("新密码至少 6 位");
      return;
    }
    setBusy(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setMessage("密码已更新");
      setCurrentPassword("");
      setNewPassword("");
      setShowPasswordForm(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "修改密码失败");
    } finally {
      setBusy(false);
    }
  }

  async function submitLeaveSpace() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await leaveSpace();
      setAccount(result);
      setMessage("已退出共享空间，你现在有了独立的个人空间");
      // 空间变了，主题、成员关系都要重拉。
      reloadTheme();
      reloadCouple();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "退出空间失败");
    } finally {
      setBusy(false);
    }
  }

  function doLeaveSpace() {
    Alert.alert(
      "退出共享空间？",
      "退出后你会拥有一个全新的独立空间，当前共享的习惯、积分和奖励都留给对方，不会带走。",
      [
        { text: "取消", style: "cancel" },
        { text: "确认退出", style: "destructive", onPress: () => void submitLeaveSpace() }
      ]
    );
  }

  async function submitDeleteAccount() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await deleteMyAccount();
      setAccount(null);
      setAccountLoadState("ready");
      setMessage("账号已删除");
      reloadTheme();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "删除账号失败");
      setBusy(false);
    }
  }

  function doDeleteAccount() {
    Alert.alert(
      "删除账号？",
      "此操作不可撤销。若你是空间里唯一的人，全部习惯、打卡、积分和奖励都会一并永久删除。",
      [
        { text: "取消", style: "cancel" },
        { text: "永久删除", style: "destructive", onPress: () => void submitDeleteAccount() }
      ]
    );
  }

  async function doLogout() {
    await logout();
    setAccount(null);
    setAccountLoadState("ready");
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

  if (accountLoadState === "checking") {
    return (
      <Screen>
        <AppText variant="body" tone="muted">
          账号加载中…
        </AppText>
      </Screen>
    );
  }

  if (account) {
    const paired = couple.loaded && !!couple.partner;
    return (
      <Screen>
        <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
          <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
          <AppText variant="small" tone="soft">返回</AppText>
        </Pressable>
        <View style={{ gap: 6 }}>
          <AppText variant="display">账号与同步</AppText>
          <AppText variant="body" tone="muted">
            同一空间，实时共享习惯与奖励
          </AppText>
        </View>

        <Card elevated={false} style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <AvatarPicker
              name={account.displayName}
              tone={myTone}
              imageUri={couple.you?.avatarUrl}
              onChange={handleAvatarChange}
              size={46}
              compact
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                {account.displayName || account.email}
              </AppText>
              <AppText variant="small" tone="muted">
                {account.role === "owner" ? "Owner" : "Member"} · {account.email}
              </AppText>
            </View>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: colors.successSurface,
                paddingHorizontal: 9,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 5
              }}
            >
              <View style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: colors.success }} />
              <AppText variant="small" style={{ color: colors.candyMintInk, fontWeight: "800" }}>
                在线
              </AppText>
            </View>
          </View>
        </Card>

        <Card elevated={false} style={{ paddingVertical: 2, gap: 0 }}>
          <ListRow
            icon="link-outline"
            iconBg={colors.candySkySurface}
            iconColor={colors.candySkyInk}
            onPress={paired ? undefined : () => setShowInviteForm((v) => !v)}
          >
            <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
              邀请 TA 加入
            </AppText>
            <AppText variant="small" tone="muted">
              {paired ? "已与另一半连接" : `分享邀请码即可同步 · ${account.inviteCode ?? "—"}`}
            </AppText>
          </ListRow>
          <Divider />
          <ListRow
            icon="flash-outline"
            iconBg={colors.successSurface}
            iconColor={colors.candyMintInk}
            right={<View style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: colors.success }} />}
          >
            <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
              实时同步
            </AppText>
            <AppText variant="small" tone="muted">
              WebSocket 已连接
            </AppText>
          </ListRow>
          <Divider />
          <ListRow icon="shield-outline" iconBg={colors.partnerSurface} iconColor={colors.partnerInk}>
            <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
              权限
            </AppText>
            <AppText variant="small" tone="muted">
              {account.role === "owner" ? "Owner 可管理奖励与兑现" : "成员可打卡与兑换"}
            </AppText>
          </ListRow>
        </Card>

        {paired ? (
          <Card {...sceneTint("lavender", scheme)} elevated={false} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <CoupleAvatars
              people={couple.people.map((person) => ({
                name: person.name,
                tone: person.tone,
                imageUri: person.avatarUrl
              }))}
              size={28}
              showRibbon={false}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                你和 {couple.partner!.name} 已连接
              </AppText>
              <AppText variant="body" tone="muted">
                共同经营 · 数据实时同步
              </AppText>
            </View>
            <Ionicons name="heart" size={18} color={colors.primary} />
          </Card>
        ) : (
          <>
            {/* board 10：主 CTA；表单仅在展开时出现 */}
            <AppButton
              title={showInviteForm ? "收起邀请" : "邀请另一半"}
              icon="link-outline"
              fullWidth
              onPress={() => setShowInviteForm((v) => !v)}
            />
            {showInviteForm ? (
              <AnimatedReveal>
              <Card elevated={false} style={{ gap: 10, padding: 13 }}>
                <AppText variant="small" tone="muted">
                  把邀请码发给 TA，或输入对方邀请码加入同一空间。
                </AppText>
                <Badge label={account.inviteCode ?? "—"} tone="primary" />
                <TextField label="对方邀请码" value={inviteCode} onChangeText={setInviteCode} placeholder="输入 8 位邀请码" />
                <AppButton
                  title="加入对方空间"
                  variant="secondary"
                  onPress={doJoinSpace}
                  disabled={busy || inviteCode.trim().length < 4}
                />
              </Card>
              </AnimatedReveal>
            ) : null}
          </>
        )}

        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}

        <AppButton
          title={showAccountTools ? "收起账号管理" : "账号管理"}
          variant="ghost"
          onPress={() => setShowAccountTools((v) => !v)}
        />

        {showAccountTools ? (
        <AnimatedReveal style={{ gap: 12 }}>
        <SectionCard title="账号">
          {showPasswordForm ? (
            <AnimatedReveal variant="inline" style={{ gap: 12 }}>
              <TextField
                label="当前密码"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="输入当前密码"
                secureTextEntry
              />
              <TextField
                label="新密码"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="至少 6 位"
                secureTextEntry
              />
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="取消"
                    variant="secondary"
                    onPress={() => {
                      setShowPasswordForm(false);
                      setCurrentPassword("");
                      setNewPassword("");
                    }}
                    disabled={busy}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <AppButton
                    title="确认修改"
                    onPress={submitChangePassword}
                    disabled={busy || !currentPassword || newPassword.length < 6}
                  />
                </View>
              </View>
            </AnimatedReveal>
          ) : (
            <>
              <AppButton
                title="修改密码"
                variant="secondary"
                icon="key-outline"
                onPress={() => setShowPasswordForm(true)}
              />
              <AppButton title="退出登录" variant="ghost" icon="log-out-outline" onPress={doLogout} disabled={busy} />
            </>
          )}
        </SectionCard>

        {!showPasswordForm ? (
          <AnimatedReveal variant="inline">
          <SectionCard title="危险区域">
            {paired ? (
              <AppButton
                title="退出当前空间"
                variant="ghost"
                icon="exit-outline"
                onPress={doLeaveSpace}
                disabled={busy}
              />
            ) : (
              <AppButton
                title="删除账号"
                variant="ghost"
                icon="trash-outline"
                onPress={doDeleteAccount}
                disabled={busy}
              />
            )}
          </SectionCard>
          </AnimatedReveal>
        ) : null}
        </AnimatedReveal>
        ) : null}
      </Screen>
    );
  }

  const isRegister = mode === "register";
  const canSubmit = !busy && !!email.trim() && password.length >= 6 && (!isRegister || !!displayName.trim());

  return (
    <Screen>
      {/* 头部：可点击的心跳连心头像作品牌标识，点一下会心跳并飘出爱心。 */}
      <View style={{ alignItems: "center", gap: 12, paddingTop: 24, paddingBottom: 16 }}>
        <HeartBeatBrand />
        <ModeCrossfade mode={mode}>
          <AppText variant="title" style={{ textAlign: "center" }}>
            {isRegister ? "创建你们的小岛" : "欢迎回小岛"}
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            {isRegister ? "注册后，和另一半一起经营共同小岛" : "登录后同步习惯、积分与奖励"}
          </AppText>
        </ModeCrossfade>
      </View>

      {/* 登录/注册表单——本页主角，设计感集中在这里 */}
      <View style={{ gap: 16 }}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { label: "登录", value: "login" },
            { label: "注册", value: "register" }
          ]}
        />

        <ModeCrossfade mode={mode} style={{ gap: 12 }}>
          <AuthField
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            placeholder="邮箱"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {isRegister ? (
            <AnimatedReveal variant="inline">
              <AuthField
                icon="person-outline"
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="昵称（想让对方怎么称呼你）"
              />
            </AnimatedReveal>
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
        gap: 8,
        minHeight: 48,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: focused ? colors.primary : colors.line,
        backgroundColor: colors.inputBackground,
        paddingHorizontal: 14
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
          fontSize: 15,
          color: colors.ink,
          paddingVertical: 12
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
    const animation = Animated.parallel([
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
    ]);
    animation.start();
    // 兜底：避免切换登录/注册时动画被打断导致表单一直透明
    const failsafe = setTimeout(() => {
      opacity.setValue(1);
      translateY.setValue(0);
    }, 400);
    return () => {
      animation.stop();
      clearTimeout(failsafe);
      opacity.setValue(1);
      translateY.setValue(0);
    };
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
