import { apiRequest, SyncError } from "../sync/apiClient";

export type AsrMimeType = "audio/m4a" | "audio/mp4" | "audio/mpeg" | "audio/wav" | "audio/webm";

export type TranscribeAudioInput = {
  audioBase64: string;
  mimeType: AsrMimeType;
  language?: "zh" | "en";
};

/** 调用服务端应用内 ASR，不依赖手机 Google 语音识别。 */
export async function transcribeCompanionAudio(input: TranscribeAudioInput): Promise<string> {
  try {
    const result = await apiRequest<{ text?: unknown }>("/api/companion/asr", {
      method: "POST",
      body: {
        audioBase64: input.audioBase64,
        mimeType: input.mimeType,
        language: input.language ?? "zh"
      }
    });
    const text = typeof result.text === "string" ? result.text.trim() : "";
    if (!text) throw new SyncError("没听清，请再说一次");
    return text;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError("语音识别暂时不可用，请稍后再试");
  }
}
