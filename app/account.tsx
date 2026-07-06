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
  register
} from "../src/sync/authService";
import { getSyncServerUrl, setSyncServerUrl } from "../src/sync/localSettings";
import { AppButton, AppText, Badge, HelperText, Label, SectionCard, SegmentedControl, TextField } from "../src/ui/Controls";
import { Screen } from "../src/ui/Screen";
import { spacing } from "../src/ui/theme";

type Mode = "login" | "register";

export default function AccountScreen() {
  const [account, setAccount] = useState<Account | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setServerUrl((await getSyncServerUrl()) ?? "");
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
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function saveServer() {
    await setSyncServerUrl(serverUrl.trim() || null);
    setMessage("同步服务器地址已保存");
    setError(null);
  }

  async function submit() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      // 提交前确保服务器地址已保存
      await setSyncServerUrl(serverUrl.trim() || null);
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
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">{account.displayName}</AppText>
            <AppText variant="small" tone="muted">
              {account.email}
            </AppText>
          </View>
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

      <SectionCard title="同步服务器">
        <TextField
          label="服务器地址"
          value={serverUrl}
          onChangeText={setServerUrl}
          placeholder="https://your-server.com:8787"
          onBlur={saveServer}
        />
        <AppText variant="small" tone="faint">
          填你自己部署的服务器地址，离开输入框即保存
        </AppText>
      </SectionCard>

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
          disabled={busy || !serverUrl.trim() || !email.trim() || password.length < 6 || (mode === "register" && !displayName.trim())}
        />
      </SectionCard>
    </Screen>
  );
}
