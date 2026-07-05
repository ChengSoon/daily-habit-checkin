import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Button, Switch, Text, TextInput, View } from "react-native";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { Screen } from "../../src/ui/Screen";

export default function ProfileScreen() {
  const [settings, setSettings] = useState<AppSettings>({
    isEveningSummaryEnabled: false,
    eveningSummaryTime: "21:30"
  });

  useFocusEffect(
    useCallback(() => {
      getAppSettings().then(setSettings);
    }, [])
  );

  async function save(next: AppSettings) {
    setSettings(next);
    await saveAppSettings(next);
  }

  return (
    <Screen>
      <Text style={{ fontSize: 28, fontWeight: "800" }}>我的</Text>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>提醒设置</Text>
        <Text>晚间未完成汇总提醒</Text>
        <Switch
          value={settings.isEveningSummaryEnabled}
          onValueChange={(value) => save({ ...settings, isEveningSummaryEnabled: value })}
        />
        <TextInput
          value={settings.eveningSummaryTime}
          onChangeText={(value) => setSettings({ ...settings, eveningSummaryTime: value })}
          style={{ borderWidth: 1, borderColor: "#CCC", padding: 12, borderRadius: 8 }}
        />
        <Button title="保存提醒时间" onPress={() => save(settings)} />
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>AI 数据使用说明</Text>
        <Text>AI 只接收你输入的目标、基础情况、可投入时间、频率偏好和必要完成统计。</Text>
        <Text>本地完整打卡日志不会发送给 AI。AI 建议不会自动修改你的习惯设置。</Text>
      </View>
      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>隐私策略</Text>
        <Text>首版数据优先保存在本机，不强制登录，也不做多设备同步。</Text>
      </View>
    </Screen>
  );
}
