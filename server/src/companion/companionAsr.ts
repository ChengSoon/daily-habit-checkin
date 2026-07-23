import { asr } from "tencentcloud-sdk-nodejs";
import type { CompanionAsrRequest } from "./companionSchemas.js";

export type CompanionAsrService = {
  transcribe(input: CompanionAsrRequest): Promise<{ text: string }>;
};

export type TencentSentenceRecognitionFn = (params: {
  EngSerViceType: string;
  SourceType: number;
  VoiceFormat: string;
  Data: string;
  DataLen: number;
  FilterDirty?: number;
  FilterModal?: number;
  ConvertNumMode?: number;
}) => Promise<{ Result?: string | null }>;

type CompanionAsrOptions = {
  /** 测试可注入；默认走腾讯云一句话识别。 */
  recognize?: TencentSentenceRecognitionFn;
  secretId?: string;
  secretKey?: string;
  region?: string;
  engineModelType?: string;
};

const MIME_TO_VOICE_FORMAT: Record<CompanionAsrRequest["mimeType"], string> = {
  "audio/mp4": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/webm": "m4a"
};

function normalizeText(value: string): string {
  return value.replace(/\s+/gu, " ").trim();
}

function resolveCredentials(options: CompanionAsrOptions): { secretId: string; secretKey: string } {
  const secretId = (options.secretId ?? process.env.TENCENT_SECRET_ID ?? "").trim();
  const secretKey = (options.secretKey ?? process.env.TENCENT_SECRET_KEY ?? "").trim();
  if (!secretId || !secretKey) {
    throw new Error("ASR_UNAVAILABLE");
  }
  return { secretId, secretKey };
}

function createTencentRecognizer(options: CompanionAsrOptions): TencentSentenceRecognitionFn {
  const { secretId, secretKey } = resolveCredentials(options);
  const region = (options.region ?? process.env.TENCENT_ASR_REGION ?? "ap-guangzhou").trim();
  const AsrClient = asr.v20190614.Client;
  const client = new AsrClient({
    credential: { secretId, secretKey },
    region,
    profile: {
      httpProfile: { endpoint: "asr.tencentcloudapi.com" }
    }
  });
  return async (params) => client.SentenceRecognition(params);
}

async function transcribeAudio(options: {
  input: CompanionAsrRequest;
  recognize: TencentSentenceRecognitionFn;
  engineModelType: string;
}): Promise<{ text: string }> {
  const bytes = Buffer.from(options.input.audioBase64, "base64");
  if (bytes.length < 256) throw new Error("ASR_EMPTY_AUDIO");
  if (bytes.length > 3_000_000) throw new Error("ASR_TOO_LARGE");
  let result: { Result?: string | null };
  try {
    result = await options.recognize({
      EngSerViceType: options.engineModelType,
      SourceType: 1,
      VoiceFormat: MIME_TO_VOICE_FORMAT[options.input.mimeType],
      Data: options.input.audioBase64,
      DataLen: bytes.length,
      FilterDirty: 0,
      FilterModal: 1,
      ConvertNumMode: 1
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/AuthFailure|UnauthorizedOperation|SecretId|SecretKey|InvalidCredential/i.test(message)) {
      throw new Error("ASR_UNAVAILABLE");
    }
    throw error;
  }
  const text = normalizeText(result.Result ?? "");
  if (!text) throw new Error("ASR_NO_SPEECH");
  return { text };
}

export function createCompanionAsrService(options: CompanionAsrOptions = {}): CompanionAsrService {
  const engineModelType = (
    options.engineModelType ??
    process.env.TENCENT_ASR_ENGINE ??
    "16k_zh"
  ).trim();
  const recognize =
    options.recognize ??
    // 延迟创建，避免缺密钥时 import 即炸
    null;

  return {
    async transcribe(input) {
      const run = recognize ?? createTencentRecognizer(options);
      return transcribeAudio({ input, recognize: run, engineModelType });
    }
  };
}
