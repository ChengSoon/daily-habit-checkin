import type { TtsAudioChunk } from "./ttsClient";

type AudioApi = typeof import("react-native-audio-api");
type AudioContext = import("react-native-audio-api").AudioContext;
type AudioBufferQueueSourceNode = import("react-native-audio-api").AudioBufferQueueSourceNode;

declare const require: (moduleName: string) => unknown;

function loadAudioApi(): AudioApi | null {
  try {
    return require("react-native-audio-api") as AudioApi;
  } catch {
    return null;
  }
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const normalized = value.replace(/\s+/gu, "");
  const bytes = new Uint8Array(Math.floor((normalized.length * 3) / 4));
  let output = 0;
  let buffer = 0;
  let bits = 0;
  for (const char of normalized) {
    if (char === "=") break;
    const index = alphabet.indexOf(char);
    if (index < 0) throw new Error("音频 Base64 数据不正确");
    buffer = (buffer << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      bytes[output++] = (buffer >> bits) & 0xff;
    }
  }
  return bytes.slice(0, output);
}

export type PcmPlayer = {
  start(): Promise<void>;
  enqueue(chunk: TtsAudioChunk): void;
  finish(): Promise<void>;
  stop(): Promise<void>;
};

class AudioApiPcmPlayer implements PcmPlayer {
  private context: AudioContext | null = null;
  private source: AudioBufferQueueSourceNode | null = null;
  private pendingBuffers = 0;
  private finishing = false;
  private finishResolver: (() => void) | null = null;
  private generation = 0;

  async start(): Promise<void> {
    const generation = ++this.generation;
    const api = loadAudioApi();
    if (!api) throw new Error("当前 App 没有包含原生音频模块");
    const context = new api.AudioContext({ sampleRate: 24000 });
    const source = context.createBufferQueueSource({ pitchCorrection: false });
    source.connect(context.destination);
    source.onBufferEnded = () => {
      this.pendingBuffers = Math.max(0, this.pendingBuffers - 1);
      this.resolveIfDrained();
    };
    await context.resume();
    if (generation !== this.generation) {
      await context.close().catch(() => undefined);
      throw new Error("PCM 播放器已停止");
    }
    source.start();
    this.context = context;
    this.source = source;
  }

  enqueue(chunk: TtsAudioChunk): void {
    if (!this.context || !this.source) throw new Error("PCM 播放器尚未启动");
    if (chunk.sampleRate !== 24000 || chunk.channels !== 1 || chunk.encoding !== "pcm_s16le") {
      throw new Error("音频格式不受支持");
    }
    const bytes = decodeBase64(chunk.data);
    if (bytes.byteLength < 2 || bytes.byteLength % 2 !== 0) return;
    const samples = new Float32Array(bytes.byteLength / 2);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = view.getInt16(index * 2, true) / 32768;
    }
    const buffer = this.context.createBuffer(1, samples.length, 24000);
    buffer.copyToChannel(samples, 0);
    this.source.enqueueBuffer(buffer);
    this.pendingBuffers += 1;
  }

  finish(): Promise<void> {
    this.finishing = true;
    return new Promise((resolve) => {
      this.finishResolver = resolve;
      this.resolveIfDrained();
    });
  }

  async stop(): Promise<void> {
    this.generation += 1;
    this.finishing = false;
    this.pendingBuffers = 0;
    this.source?.clearBuffers();
    try {
      this.source?.stop();
    } catch {
      // 播放器已经停止时忽略原生异常。
    }
    const context = this.context;
    this.source = null;
    this.context = null;
    this.finishResolver?.();
    this.finishResolver = null;
    if (context) await context.close().catch(() => undefined);
  }

  private resolveIfDrained(): void {
    if (!this.finishing || this.pendingBuffers > 0 || !this.finishResolver) return;
    const resolve = this.finishResolver;
    this.finishResolver = null;
    resolve();
  }
}

export function createPcmPlayer(): PcmPlayer {
  return new AudioApiPcmPlayer();
}
