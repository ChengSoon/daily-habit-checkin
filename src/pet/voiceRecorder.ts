import { File } from "expo-file-system";
import { Alert, PermissionsAndroid, Platform } from "react-native";

type AudioApi = typeof import("react-native-audio-api");

declare const require: (moduleName: string) => unknown;

function loadAudioApi(): AudioApi | null {
  try {
    return require("react-native-audio-api") as AudioApi;
  } catch {
    return null;
  }
}

export type VoiceRecordResult = {
  uri: string;
  mimeType: "audio/m4a";
  durationSec: number;
  audioBase64: string;
};

export type VoiceRecordOptions = {
  onVolume?: (volume: number) => void;
  maxDurationMs?: number;
  silenceDurationMs?: number;
  minSpeechMs?: number;
  /** RMS 人声门限，越小越灵敏。 */
  speechThreshold?: number;
  signal?: AbortSignal;
};

function rmsToVolume(rms: number): number {
  // 把 0~0.25 的 RMS 映射到 UI 使用的 -2~10
  const scaled = Math.log10(1 + rms * 40) * 8 - 2;
  return Math.max(-2, Math.min(10, scaled));
}

function bufferRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

export type MicrophonePermissionResult = {
  granted: boolean;
  /** 系统不再弹窗（永久拒绝），需引导去设置 */
  blocked?: boolean;
};

function requestAndroidMicPermission(): Promise<MicrophonePermissionResult> {
  return new Promise((resolve) => {
    // 全 Android：对话面板是 Modal 时，直接 request 系统授权框常被挡住或吞掉；
    // 先用应用内 Alert 抢焦点，用户确认后再调系统授权。
    Alert.alert("需要麦克风权限", "和卡卡语音对话需要使用麦克风。", [
      { text: "取消", style: "cancel", onPress: () => resolve({ granted: false }) },
      {
        text: "去授权",
        onPress: () => {
          void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
            .then((status) => {
              if (status === PermissionsAndroid.RESULTS.GRANTED) {
                resolve({ granted: true });
                return;
              }
              if (status === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
                resolve({ granted: false, blocked: true });
                return;
              }
              resolve({ granted: false });
            })
            .catch(() => resolve({ granted: false }));
        }
      }
    ]);
  });
}

/** 全 Android 统一权限入口：已授权直接通过；未授权先应用确认再弹系统授权框。 */
export async function ensureMicrophonePermission(): Promise<MicrophonePermissionResult> {
  if (Platform.OS === "android") {
    try {
      if (await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)) {
        return { granted: true };
      }
      return await requestAndroidMicPermission();
    } catch {
      return { granted: false };
    }
  }

  const api = loadAudioApi();
  if (!api) return { granted: false };
  try {
    const current = await api.AudioManager.checkRecordingPermissions();
    if (current === "Granted") return { granted: true };
    const status = await api.AudioManager.requestRecordingPermissions();
    return { granted: status === "Granted" };
  } catch {
    return { granted: false };
  }
}

export async function requestMicrophonePermission(): Promise<boolean> {
  return (await ensureMicrophonePermission()).granted;
}

/** 录制一句用户语音：有声后静音自动结束，并返回 base64 m4a。 */
export async function recordUtterance(
  options: VoiceRecordOptions = {}
): Promise<VoiceRecordResult | null> {
  const api = loadAudioApi();
  if (!api) throw new Error("RECORDER_UNAVAILABLE");

  const maxDurationMs = options.maxDurationMs ?? 12_000;
  const silenceDurationMs = options.silenceDurationMs ?? 1_100;
  const minSpeechMs = options.minSpeechMs ?? 450;
  const speechThreshold = options.speechThreshold ?? 0.02;

  const recorder = new api.AudioRecorder();
  const enabled = recorder.enableFileOutput({
    format: api.FileFormat.M4A,
    channelCount: 1,
    directory: api.FileDirectory.Cache,
    subDirectory: "kaka-voice",
    fileNamePrefix: "utterance",
    preset: api.FilePreset.Medium
  });
  if (enabled.status === "error") {
    throw new Error(enabled.message || "RECORDER_UNAVAILABLE");
  }

  let settled = false;
  let speechStartedAt: number | null = null;
  let lastSpeechAt: number | null = null;
  let startedAt = 0;
  let finishing = false;

  const cleanup = () => {
    try {
      recorder.clearOnAudioReady();
      recorder.clearOnError();
      recorder.disableFileOutput();
    } catch {
      // 忽略清理异常
    }
  };

  const finish = async (): Promise<VoiceRecordResult | null> => {
    if (settled) return null;
    settled = true;
    try {
      const info = await recorder.stop();
      cleanup();
      if (info.status === "error") return null;
      const path = info.paths[0];
      // 超时结束但从未检测到有效人声时，不要当作一句有效语音上传。
      if (!path || speechStartedAt === null || info.duration < minSpeechMs / 1000) return null;
      const uri = path.startsWith("file://") ? path : `file://${path}`;
      const audioBase64 = await new File(uri).base64();
      if (!audioBase64 || audioBase64.length < 32) return null;
      return {
        uri,
        mimeType: "audio/m4a",
        durationSec: info.duration,
        audioBase64
      };
    } catch {
      cleanup();
      return null;
    }
  };

  return await new Promise<VoiceRecordResult | null>((resolve, reject) => {
    const onAbort = () => {
      if (settled || finishing) return;
      finishing = true;
      void finish().then(resolve, reject);
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });

    recorder.onError(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("RECORDER_ERROR"));
    });

    const maybeStop = () => {
      if (settled || finishing) return;
      finishing = true;
      void finish().then(resolve, reject);
    };

    recorder.onAudioReady(
      {
        sampleRate: 16_000,
        bufferLength: 1600,
        channelCount: 1
      },
      ({ buffer }) => {
        if (settled || finishing) return;
        const samples = buffer.getChannelData(0);
        const rms = bufferRms(samples);
        options.onVolume?.(rmsToVolume(rms));
        const now = Date.now();
        if (rms >= speechThreshold) {
          if (speechStartedAt === null) speechStartedAt = now;
          lastSpeechAt = now;
        }
        if (
          speechStartedAt !== null &&
          lastSpeechAt !== null &&
          now - speechStartedAt >= minSpeechMs &&
          now - lastSpeechAt >= silenceDurationMs
        ) {
          maybeStop();
        } else if (startedAt > 0 && now - startedAt >= maxDurationMs) {
          maybeStop();
        }
      }
    );

    void recorder
      .start()
      .then((result) => {
        if (result.status === "error") {
          settled = true;
          cleanup();
          reject(new Error(result.message || "RECORDER_UNAVAILABLE"));
          return;
        }
        startedAt = Date.now();
      })
      .catch((error) => {
        settled = true;
        cleanup();
        reject(error instanceof Error ? error : new Error("RECORDER_UNAVAILABLE"));
      });
  });
}
