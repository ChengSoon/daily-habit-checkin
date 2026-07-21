import * as Speech from "expo-speech";
import type { ExpoSpeechRecognitionErrorEvent } from "expo-speech-recognition";
import { AppState, Platform } from "react-native";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  commandAfterWakePhrase,
  initialVoiceWakeState,
  isRecoverableVoiceWakeError,
  voiceWakeErrorMessage,
  voiceWakeReducer
} from "./voiceWakeState";
import {
  loadSpeechRecognitionPackage,
  useSafeSpeechRecognitionEvent
} from "./speechRecognition";
import {
  androidSpeechStartOptions,
  inspectSpeechRecognition
} from "./speechRecognitionSupport";
import { listenOnceForWakePhrase } from "./cloudVoiceWake";
import { requestMicrophonePermission } from "./voiceRecorder";

const NATIVE_RESTART_DELAY_MS = 850;
/** 云端唤醒轮次之间尽量贴紧，减少“正在识别时说卡卡没人听”的空窗感。 */
const CLOUD_RESTART_DELAY_MS = 120;
/** Android 无系统语音服务时，回退到应用内录音 + 服务端 ASR。 */
const ALLOW_CLOUD_WAKE_FALLBACK = Platform.OS === "android";

type VoiceWakeOptions = {
  enabled: boolean;
  onWake: (command: string) => void;
};

type WakeEngine = "native" | "cloud";

export function usePetVoiceWake({ enabled, onWake }: VoiceWakeOptions) {
  const [state, dispatch] = useReducer(voiceWakeReducer, initialVoiceWakeState);
  const enabledRef = useRef(enabled);
  const activeRef = useRef(false);
  const recognitionRef = useRef(false);
  const onWakeRef = useRef(onWake);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const androidServicePackageRef = useRef<string | undefined>(undefined);
  const engineRef = useRef<WakeEngine>("native");
  const cloudAbortRef = useRef<AbortController | null>(null);
  const cloudFallbackNotifiedRef = useRef(false);
  const scheduleRestartRef = useRef(() => undefined as void);
  const startCloudRecognitionRef = useRef(async () => undefined as void);

  useEffect(() => {
    enabledRef.current = enabled;
    onWakeRef.current = onWake;
  }, [enabled, onWake]);

  const clearRestartTimer = useCallback(() => {
    if (!restartTimer.current) return;
    clearTimeout(restartTimer.current);
    restartTimer.current = null;
  }, []);

  const abortCloudListen = useCallback(() => {
    cloudAbortRef.current?.abort();
    cloudAbortRef.current = null;
  }, []);

  const finishWakeWithCommand = useCallback(
    (command: string) => {
      activeRef.current = false;
      recognitionRef.current = false;
      clearRestartTimer();
      abortCloudListen();
      try {
        loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
      } catch {
        // 唤醒交接时忽略原生中止异常。
      }
      dispatch({ type: "stopped" });
      onWakeRef.current(command);
    },
    [abortCloudListen, clearRestartTimer]
  );

  const startNativeRecognition = useCallback(() => {
    if (!activeRef.current || recognitionRef.current || engineRef.current !== "native") return;
    const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
    if (!module) {
      activeRef.current = false;
      dispatch({
        type: "failed",
        active: false,
        message: "当前 App 没有包含语音唤醒模块，请重新安装 development build"
      });
      return;
    }

    clearRestartTimer();
    recognitionRef.current = true;
    dispatch({ type: "listening" });
    try {
      module.start({
        lang: "zh-CN",
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
        contextualStrings: ["卡卡", "咔咔", "喀喀", "咖咖", "唤醒卡卡"],
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 650
        },
        iosTaskHint: "dictation",
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
          mode: "voiceChat"
        },
        iosVoiceProcessingEnabled: true,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 160 },
        ...androidSpeechStartOptions(androidServicePackageRef.current)
      });
    } catch {
      recognitionRef.current = false;
      activeRef.current = false;
      dispatch({
        type: "failed",
        active: false,
        message: "语音唤醒模块尚未装入当前开发构建"
      });
    }
  }, [clearRestartTimer]);

  const startCloudRecognition = useCallback(async () => {
    if (!activeRef.current || recognitionRef.current || engineRef.current !== "cloud") return;
    clearRestartTimer();
    abortCloudListen();
    recognitionRef.current = true;
    const controller = new AbortController();
    cloudAbortRef.current = controller;

    await listenOnceForWakePhrase(controller.signal, {
      active: () => activeRef.current,
      onListening: () => {
        if (activeRef.current) dispatch({ type: "listening" });
      },
      onVolume: (volume) => {
        if (activeRef.current) dispatch({ type: "volume_changed", volume });
      },
      onWake: (command) => {
        recognitionRef.current = false;
        finishWakeWithCommand(command);
      },
      onNoMatch: () => {
        recognitionRef.current = false;
        scheduleRestartRef.current();
      },
      onError: (message) => {
        recognitionRef.current = false;
        if (!activeRef.current) return;
        // 网络类错误保持监听，短暂提示后重试。
        dispatch({ type: "failed", active: true, message });
        scheduleRestartRef.current();
      }
    });

    if (cloudAbortRef.current === controller) cloudAbortRef.current = null;
    if (recognitionRef.current) recognitionRef.current = false;
  }, [abortCloudListen, clearRestartTimer, finishWakeWithCommand]);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    if (!activeRef.current) return;
    const delay =
      engineRef.current === "cloud" ? CLOUD_RESTART_DELAY_MS : NATIVE_RESTART_DELAY_MS;
    restartTimer.current = setTimeout(() => {
      if (engineRef.current === "cloud") void startCloudRecognitionRef.current();
      else startNativeRecognition();
    }, delay);
  }, [clearRestartTimer, startNativeRecognition]);

  useEffect(() => {
    scheduleRestartRef.current = scheduleRestart;
    startCloudRecognitionRef.current = startCloudRecognition;
  }, [scheduleRestart, startCloudRecognition]);

  const switchToCloudFallback = useCallback(
    async (notice?: string) => {
      if (!ALLOW_CLOUD_WAKE_FALLBACK || !activeRef.current) return false;
      engineRef.current = "cloud";
      recognitionRef.current = false;
      try {
        loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
      } catch {
        // 切换引擎时忽略原生中止异常。
      }
      const granted = await requestMicrophonePermission();
      if (!activeRef.current) return false;
      if (!granted) {
        activeRef.current = false;
        dispatch({
          type: "failed",
          active: false,
          message: "需要麦克风权限才能唤醒卡卡"
        });
        return false;
      }
      if (notice && !cloudFallbackNotifiedRef.current) {
        cloudFallbackNotifiedRef.current = true;
        // 先提示再监听：保持 active，避免被 stop。
        dispatch({ type: "failed", active: true, message: notice });
      }
      await startCloudRecognition();
      return true;
    },
    [startCloudRecognition]
  );

  const start = useCallback(async () => {
    if (!enabledRef.current || activeRef.current) return;
    activeRef.current = true;
    recognitionRef.current = false;
    androidServicePackageRef.current = undefined;
    engineRef.current = "native";
    cloudFallbackNotifiedRef.current = false;
    dispatch({ type: "started" });
    await Speech.stop();

    try {
      const readiness = inspectSpeechRecognition();
      if (!readiness.ok) {
        const switched = await switchToCloudFallback(
          "当前手机没有系统语音识别服务，已改用应用内识别，请确保网络畅通"
        );
        if (!switched && activeRef.current) {
          activeRef.current = false;
          dispatch({
            type: "failed",
            active: false,
            message: readiness.message
          });
        }
        return;
      }
      androidServicePackageRef.current = readiness.androidServicePackage;
      const permission = await readiness.module.requestPermissionsAsync();
      if (!activeRef.current) return;
      if (!permission.granted) {
        activeRef.current = false;
        dispatch({
          type: "failed",
          active: false,
          message: "需要麦克风和语音识别权限才能唤醒卡卡"
        });
        return;
      }
      engineRef.current = "native";
      startNativeRecognition();
    } catch {
      const switched = await switchToCloudFallback(
        "系统语音识别暂不可用，已改用应用内识别，请确保网络畅通"
      );
      if (!switched && activeRef.current) {
        activeRef.current = false;
        dispatch({
          type: "failed",
          active: false,
          message: "语音唤醒暂不可用，可点卡卡开始对话"
        });
      }
    }
  }, [startNativeRecognition, switchToCloudFallback]);

  const stop = useCallback(() => {
    activeRef.current = false;
    recognitionRef.current = false;
    clearRestartTimer();
    abortCloudListen();
    try {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // 当前开发构建没有原生模块时，忽略退出监听的异常。
    }
    void Speech.stop();
    dispatch({ type: "stopped" });
  }, [abortCloudListen, clearRestartTimer]);

  useSafeSpeechRecognitionEvent("start", () => {
    if (activeRef.current && engineRef.current === "native") {
      dispatch({ type: "listening" });
    }
  });

  useSafeSpeechRecognitionEvent("result", (event) => {
    if (
      !activeRef.current ||
      !recognitionRef.current ||
      engineRef.current !== "native" ||
      !event.isFinal
    ) {
      return;
    }
    recognitionRef.current = false;
    const transcript = event.results[0]?.transcript ?? "";
    const command = commandAfterWakePhrase(transcript);
    if (command === null) {
      scheduleRestart();
      return;
    }
    finishWakeWithCommand(command);
  });

  useSafeSpeechRecognitionEvent("volumechange", (event) => {
    if (activeRef.current && engineRef.current === "native") {
      dispatch({ type: "volume_changed", volume: event.value });
    }
  });

  useSafeSpeechRecognitionEvent("end", () => {
    if (engineRef.current !== "native") return;
    recognitionRef.current = false;
    if (activeRef.current) scheduleRestart();
  });

  useSafeSpeechRecognitionEvent("error", (event: ExpoSpeechRecognitionErrorEvent) => {
    if (engineRef.current !== "native") return;
    recognitionRef.current = false;
    if (!activeRef.current || event.error === "aborted") return;

    // 系统识别服务不可用时，切到应用内识别继续唤醒。
    if (
      ALLOW_CLOUD_WAKE_FALLBACK &&
      (event.error === "service-not-allowed" || event.error === "language-not-supported")
    ) {
      void switchToCloudFallback(
        "系统语音识别暂不可用，已改用应用内识别，请确保网络畅通"
      );
      return;
    }

    const recoverable = isRecoverableVoiceWakeError(event.error);
    if (!recoverable) activeRef.current = false;
    dispatch({
      type: "failed",
      active: activeRef.current,
      message: voiceWakeErrorMessage(event.error)
    });
    if (recoverable) scheduleRestart();
  });

  useEffect(() => {
    if (enabled && AppState.currentState === "active") void start();
    if (!enabled) stop();
    return () => {
      if (!enabled) stop();
    };
  }, [enabled, start, stop]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active" && enabledRef.current) {
        void start();
      } else if (nextState !== "active") {
        stop();
      }
    });
    return () => subscription.remove();
  }, [start, stop]);

  useEffect(
    () => () => {
      activeRef.current = false;
      recognitionRef.current = false;
      clearRestartTimer();
      abortCloudListen();
      try {
        loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
      } catch {
        // 卸载时忽略缺失的原生模块。
      }
      void Speech.stop();
    },
    [abortCloudListen, clearRestartTimer]
  );

  return { ...state, start, stop };
}
