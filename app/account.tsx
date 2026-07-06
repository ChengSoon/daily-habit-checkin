import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
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
import { AppButton, AppText, Badge, HelperText, Label, SectionCard, SegmentedControl, TextField } from "../src/ui/Controls";
import { CoupleAvatars } from "../src/ui/Avatar";
import { AvatarPicker } from "../src/ui/AvatarPicker";
import { useCouple } from "../src/ui/useCouple";
import { Screen } from "../src/ui/Screen";
import { spacing } from "../src/ui/theme";

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
    couple.reload();
  }, [couple.reload]);

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
  }

  async function handleAvatarChange(image: PickedImage | null) {
    setError(null);
    setMessage(null);
    try {
      await updateMyAvatar(image);
      couple.reload();
      setMessage(image ? "头像已更新" : "已移除头像");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "更新头像失败");
    }
  }

  // couple.you 携带当前账号的头像数据（来自成员接口）。
  const myTone = couple.you?.tone ?? "you";

  if (account) {
    return (
      <Screen>
        <View style={{ gap: spacing.xs }}>
          <AppText variant="display">账号与同步</AppText>
          <AppText variant="body" tone="muted">
            登录后，两台设备共享同一份数据
          </AppText>
        </View>

        <SectionCard title="当前账号">
          <AvatarPicker
            name={account.displayName}
            tone={myTone}
            imageData={couple.you?.avatarData}
            imageMime={couple.you?.avatarMime}
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
                  imageData: person.avatarData,
                  imageMime: person.avatarMime
                }))}
                size={40}
              />
            ) : null}
          </View>
          <AppText variant="small" tone="muted">
            {couple.partner
              ? `你和 ${couple.partner.name} 正在共享同一个空间 💞`
              : "还差另一半 —— 把下面的邀请码发给 TA。"}
          </AppText>
          <View style={{ gap: spacing.xs }}>
            <Label>邀请码（发给另一半，让 TA 加入你们的空间）</Label>
            <Badge label={account.inviteCode ?? "—"} tone="primary" />
          </View>
        </SectionCard>

        <SectionCard title="加入对方的空间">
          <AppText variant="small" tone="muted">
            如果对方已经创建了空间，填入 TA 的邀请码即可共享数据。注意：加入后你当前空间的数据将不再显示。
          </AppText>
          <TextField label="邀请码" value={inviteCode} onChangeText={setInviteCode} placeholder="输入 8 位邀请码" />
          <AppButton title="加入空间" onPress={doJoinSpace} disabled={busy || inviteCode.trim().length < 4} />
        </SectionCard>

        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}

        <AppButton title="退出登录" variant="ghost" onPress={doLogout} disabled={busy} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">账号与同步</AppText>
        <AppText variant="body" tone="muted">
          登录后，你和另一半可以在两台设备共享习惯、积分和奖励
        </AppText>
      </View>

      <SectionCard title={mode === "register" ? "注册" : "登录"}>
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { label: "登录", value: "login" },
            { label: "注册", value: "register" }
          ]}
        />
        <TextField label="邮箱" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" />
        {mode === "register" ? (
          <TextField label="昵称" value={displayName} onChangeText={setDisplayName} placeholder="你的昵称" />
        ) : null}
        <TextField label="密码" value={password} onChangeText={setPassword} placeholder="至少 6 位" />
        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}
        <AppButton
          title={mode === "register" ? "注册并创建空间" : "登录"}
          onPress={submit}
          disabled={busy || !email.trim() || password.length < 6 || (mode === "register" && !displayName.trim())}
        />
      </SectionCard>
    </Screen>
  );
}
