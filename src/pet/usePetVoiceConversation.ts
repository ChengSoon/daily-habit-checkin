import * as Speech from "expo-speech";
import { useCallback, useEffect, useReducer, useRef } from "react";
import {
  initialVoiceConversationState,
  voiceConversationReducer
} from "./voiceConversationState";
import type { PcmPlayer } from "./pcmPlayer";
import type { TtsStreamFn } from "./ttsClient";
import { loadSpeechRecognitionPackage } from "./speechRecognition";
import { useNativeSpeechEvents } from "./useNativeSpeechEvents";
import { buildNativeSpeechStartOptions } from "./nativeSpeechStart";
import { listenOnceWithCloudAsr } from "./cloudVoiceListen";
import { CLOUD_CONVERSATION_RECORD_OPTIONS } from "./cloudVoiceRecordOptions";
import { prepareVoiceSession, USE_CLOUD_ASR } from "./prepareVoiceSession";
import { useStopVoiceOnBackground } from "./useStopVoiceOnBackground";
import { speakReplyText, stopSpeechPlayback } from "./voiceReplyPlayer";

const RESTART_DELAY_MS = 850;
type VoiceConversationOptions = {
  disabled: boolean;
  sendMessage: (text: string) => Promise<string | null>;
  streamTts?: TtsStreamFn;
  createPlayer?: () => PcmPlayer;
};
export type VoiceConversationStartOptions = {
  initialTranscript?: string;
  /** 只喊唤醒词时先本地应答再进入收听，不请求模型。 */
  wakeGreeting?: string;
};

export function usePetVoiceConversation({
  disabled,
  sendMessage,
  streamTts,
  createPlayer
}: VoiceConversationOptions) {
  const [state, dispatch] = useReducer(voiceConversationReducer, initialVoiceConversationState);
  const activeRef = useRef(false);
  const processingRef = useRef(false);
  const stateRef = useRef(state);
  const sendMessageRef = useRef(sendMessage);
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ttsControllerRef = useRef<AbortController | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const androidServicePackageRef = useRef<string | undefined>(undefined);
  const cloudAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    sendMessageRef.current = sendMessage;
  }, [sendMessage]);

  const clearRestartTimer = useCallback(() => {
    if (!restartTimer.current) return;
    clearTimeout(restartTimer.current);
    restartTimer.current = null;
  }, []);

  const abortCloudListen = useCallback(() => {
    cloudAbortRef.current?.abort();
    cloudAbortRef.current = null;
  }, []);

  const resumeListeningRef = useRef(() => undefined as void);
  const scheduleRestartRef = useRef(() => undefined as void);
  const submitTranscriptRef = useRef(async (_text: string) => undefined as void);

  const startNativeRecognition = useCallback(() => {
    if (!activeRef.current || processingRef.current || USE_CLOUD_ASR) return;
    const module = loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule;
    if (!module) {
      dispatch({ type: "failed", message: "当前 App 没有原生语音模块，请重装 development build" });
      return;
    }
    clearRestartTimer();
    dispatch({ type: "listening" });
    try {
      module.start(buildNativeSpeechStartOptions(androidServicePackageRef.current));
    } catch {
      dispatch({ type: "failed", message: "原生语音模块尚未装入当前开发构建" });
    }
  }, [clearRestartTimer]);

  const startCloudRecognition = useCallback(async () => {
    if (!activeRef.current || processingRef.current || !USE_CLOUD_ASR) return;
    clearRestartTimer();
    abortCloudListen();
    const controller = new AbortController();
    cloudAbortRef.current = controller;
    await listenOnceWithCloudAsr(
      controller.signal,
      {
        active: () => activeRef.current,
        processing: () => processingRef.current,
        onListening: () => dispatch({ type: "listening" }),
        onVolume: (volume) => dispatch({ type: "volume_changed", volume }),
        onNoSpeech: () => {
          dispatch({ type: "failed", message: "我没听清，再说一次吧" });
          scheduleRestartRef.current();
        },
        onRecognizing: () => {
          processingRef.current = true;
          dispatch({ type: "thinking", transcript: "正在听懂你…" });
        },
        onTranscript: async (text) => submitTranscriptRef.current(text),
        onError: (message) => {
          processingRef.current = false;
          dispatch({ type: "failed", message });
          scheduleRestartRef.current();
        }
      },
      CLOUD_CONVERSATION_RECORD_OPTIONS
    );
    if (cloudAbortRef.current === controller) cloudAbortRef.current = null;
  }, [abortCloudListen, clearRestartTimer]);

  const resumeListening = useCallback(() => {
    processingRef.current = false;
    if (!activeRef.current) return;
    if (USE_CLOUD_ASR) void startCloudRecognition();
    else startNativeRecognition();
  }, [startCloudRecognition, startNativeRecognition]);

  const scheduleRestart = useCallback(() => {
    clearRestartTimer();
    restartTimer.current = setTimeout(resumeListening, RESTART_DELAY_MS);
  }, [clearRestartTimer, resumeListening]);

  useEffect(() => {
    resumeListeningRef.current = resumeListening;
    scheduleRestartRef.current = scheduleRestart;
  }, [resumeListening, scheduleRestart]);

  const speakReply = useCallback(
    (reply: string) => {
      speakReplyText(reply, {
        active: () => activeRef.current,
        createPlayer,
        streamTts,
        onSpeaking: () => dispatch({ type: "speaking" }),
        onResumeListening: () => resumeListeningRef.current(),
        onStreamInterrupted: () => {
          processingRef.current = false;
          dispatch({ type: "failed", message: "语音流中断了，我再听一次" });
          scheduleRestartRef.current();
        },
        setTtsController: (value) => {
          ttsControllerRef.current = value;
        },
        setPlayer: (value) => {
          playerRef.current = value;
        },
        getPlayer: () => playerRef.current,
        getTtsController: () => ttsControllerRef.current
      });
    },
    [createPlayer, streamTts]
  );

  const submitTranscript = useCallback(
    async (transcript: string) => {
      processingRef.current = true;
      dispatch({ type: "thinking", transcript });
      const reply = await sendMessageRef.current(transcript);
      if (!activeRef.current) return;
      if (reply) {
        speakReply(reply);
        return;
      }
      processingRef.current = false;
      dispatch({ type: "failed", message: "卡卡暂时没接上话，我再听一次" });
      scheduleRestart();
    },
    [scheduleRestart, speakReply]
  );

  useEffect(() => {
    submitTranscriptRef.current = submitTranscript;
  }, [submitTranscript]);

  useNativeSpeechEvents({
    enabled: !USE_CLOUD_ASR,
    isActive: () => activeRef.current,
    isProcessing: () => processingRef.current,
    isListeningPhase: () => stateRef.current.phase === "listening",
    onListening: () => dispatch({ type: "listening" }),
    onTranscript: (transcript, isFinal) => {
      dispatch({ type: "transcript_changed", transcript });
      if (!isFinal) return;
      if (!transcript) {
        dispatch({ type: "failed", message: "我没听清，再说一次吧" });
        scheduleRestart();
        return;
      }
      processingRef.current = true;
      void submitTranscript(transcript);
    },
    onVolume: (volume) => dispatch({ type: "volume_changed", volume }),
    onEndWhileListening: scheduleRestart,
    onError: (message, recoverable) => {
      processingRef.current = false;
      dispatch({ type: "failed", message });
      if (recoverable) scheduleRestart();
    }
  });

  const failStart = useCallback((message: string) => {
    activeRef.current = true;
    processingRef.current = false;
    dispatch({ type: "started" });
    dispatch({ type: "failed", message });
  }, []);

  const start = useCallback(
    async ({ initialTranscript, wakeGreeting }: VoiceConversationStartOptions = {}) => {
      if (activeRef.current) return;
      if (disabled) {
        failStart("卡卡正忙，稍后再叫我一声");
        return;
      }
      try {
        // 从唤醒词交接而来时权限已批过；加载消息不应阻断会话启动。
        const prep = await prepareVoiceSession({
          skipPermission: Boolean(initialTranscript?.trim() || wakeGreeting?.trim())
        });
        if (!prep.ok) {
          failStart(prep.message);
          return;
        }
        if (disabled) {
          failStart("卡卡正忙，稍后再叫我一声");
          return;
        }
        activeRef.current = true;
        processingRef.current = false;
        androidServicePackageRef.current = prep.androidServicePackage;
        dispatch({ type: "started" });
        await Speech.stop();
        if (!activeRef.current) return;
        if (initialTranscript?.trim()) {
          await submitTranscript(initialTranscript.trim());
          return;
        }
        if (wakeGreeting?.trim()) {
          processingRef.current = true;
          speakReply(wakeGreeting.trim());
          return;
        }
        if (USE_CLOUD_ASR) await startCloudRecognition();
        else startNativeRecognition();
      } catch {
        failStart("启动语音识别失败，请稍后重试");
      }
    },
    [
      disabled,
      failStart,
      speakReply,
      startCloudRecognition,
      startNativeRecognition,
      submitTranscript
    ]
  );

  const stop = useCallback(() => {
    activeRef.current = false;
    processingRef.current = false;
    clearRestartTimer();
    abortCloudListen();
    void stopSpeechPlayback(playerRef.current, ttsControllerRef.current);
    ttsControllerRef.current = null;
    playerRef.current = null;
    try {
      loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
    } catch {
      // ignore
    }
    dispatch({ type: "stopped" });
  }, [abortCloudListen, clearRestartTimer]);

  const isActive = useCallback(() => activeRef.current, []);
  useStopVoiceOnBackground(stop, isActive);

  const interrupt = useCallback(() => {
    if (!activeRef.current) return;
    if (stateRef.current.phase === "speaking") {
      void stopSpeechPlayback(playerRef.current, ttsControllerRef.current);
      ttsControllerRef.current = null;
      playerRef.current = null;
      resumeListening();
      return;
    }
    if (stateRef.current.phase === "error") resumeListening();
  }, [resumeListening]);

  useEffect(
    () => () => {
      activeRef.current = false;
      clearRestartTimer();
      abortCloudListen();
      void stopSpeechPlayback(playerRef.current, ttsControllerRef.current);
      try {
        loadSpeechRecognitionPackage()?.ExpoSpeechRecognitionModule.abort();
      } catch {
        // ignore
      }
    },
    [abortCloudListen, clearRestartTimer]
  );

  return { ...state, start, stop, interrupt };
}
