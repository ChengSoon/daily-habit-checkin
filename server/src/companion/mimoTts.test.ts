import { afterEach, describe, expect, it, vi } from "vitest";
import { createMimoTtsService } from "./mimoTts.js";

afterEach(() => vi.unstubAllGlobals());

describe("MiMo TTS provider", () => {
  it("sends the provider api-key and streams PCM chunks in order", async () => {
    const encoder = new TextEncoder();
    const chunks = [
      'data: {"choices":[{"delta":{"audio":{"data":"AAE="}}}]}\n\n',
      'data: {"choices":[{"delta":{"audio":{"data":"AgM="}}}]}\n\n',
      "data: [DONE]\n\n"
    ];
    const fetchMock = vi.fn(async (_url, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
          controller.close();
        }
      });
      expect(init?.headers).toMatchObject({ "api-key": "mimo-secret" });
      const requestBody = JSON.parse(String(init?.body)) as {
        messages: Array<{ content: string }>;
      };
      expect(requestBody).toMatchObject({
        model: "mimo-v2.5-tts",
        audio: { format: "pcm16", voice: "冰糖" },
        stream: true
      });
      expect(requestBody.messages[0]?.content).toContain("面对面聊日常");
      expect(requestBody.messages[1]?.content).toBe("(自然聊天，松弛，温柔)你好");
      return new Response(body, { status: 200 });
    });
    const service = createMimoTtsService({ fetch: fetchMock, apiKey: "mimo-secret" });
    const received: string[] = [];

    await service.stream({ text: "你好" }, (chunk) => received.push(chunk.data));

    expect(received).toEqual(["AAE=", "AgM="]);
  });

  it("rejects invalid upstream audio data", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"audio":{"data":"?"}}}]}\n\n'));
        controller.close();
      }
    });
    const service = createMimoTtsService({
      fetch: vi.fn(async () => new Response(body, { status: 200 })),
      apiKey: "mimo-secret"
    });

    await expect(service.stream({ text: "你好" }, () => undefined)).rejects.toThrow("无效音频");
  });
});
