type AudioApi = typeof import("react-native-audio-api");

declare const require: (moduleName: string) => unknown;

export type CompanionAudioApi = Pick<AudioApi, "AudioManager">;

function loadAudioApi(): CompanionAudioApi | null {
  try {
    return require("react-native-audio-api") as CompanionAudioApi;
  } catch {
    return null;
  }
}

/**
 * 录音结束后切到媒体播放：申请 STREAM_MUSIC 焦点，
 * 缓解部分 Android 厂商（含 vivo）“状态在说话但没声音”。
 */
export function prepareCompanionAudioPlayback(api: CompanionAudioApi | null = loadAudioApi()): void {
  if (!api) return;
  try {
    // Android：内部映射为 requestAudioFocus(STREAM_MUSIC)
    api.AudioManager.observeAudioInterruptions("gain");
    api.AudioManager.setAudioSessionOptions({
      iosCategory: "playback",
      iosMode: "spokenAudio",
      iosOptions: ["defaultToSpeaker", "duckOthers"]
    });
  } catch {
    // 厂商/构建差异下尽力而为，失败时仍尝试直接播
  }
}

/** 激活会话后再创建 AudioContext，避免焦点尚未就绪时静音。 */
export async function activateCompanionAudioPlayback(
  api: CompanionAudioApi | null = loadAudioApi()
): Promise<void> {
  prepareCompanionAudioPlayback(api);
  if (!api) return;
  try {
    await api.AudioManager.setAudioSessionActivity(true);
  } catch {
    // Android 上 setAudioSessionActivity 多为空实现
  }
}
