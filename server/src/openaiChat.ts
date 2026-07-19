import type { Response } from "express";
import OpenAI from "openai";
import { z } from "zod";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });
  }
  return client;
}

export const ChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.union([z.literal("system"), z.literal("user"), z.literal("assistant")]),
        content: z.string().min(1).max(8000)
      })
    )
    .min(1)
    .max(40),
  model: z.string().min(1).max(128).optional(),
  stream: z.boolean().optional()
});

export async function chatWithModel(rawInput: unknown): Promise<{ content: string }> {
  const input = ChatRequestSchema.parse(rawInput);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = input.model ?? process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("OPENAI_MODEL is required");
  }

  const response = await getClient().chat.completions.create({
    model,
    temperature: 0.7,
    messages: input.messages
  });

  const content = response.choices[0]?.message?.content?.trim();
  if (!content) {
    throw new Error("AI returned empty content");
  }
  return { content };
}

/** 以 OpenAI 兼容 SSE 写出流式对话。 */
export async function streamChatWithModel(rawInput: unknown, response: Response): Promise<void> {
  const input = ChatRequestSchema.parse(rawInput);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = input.model ?? process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("OPENAI_MODEL is required");
  }

  response.status(200);
  response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  response.setHeader("Cache-Control", "no-cache, no-transform");
  response.setHeader("Connection", "keep-alive");
  response.flushHeaders?.();

  const stream = await getClient().chat.completions.create({
    model,
    temperature: 0.7,
    stream: true,
    messages: input.messages
  });

  for await (const chunk of stream) {
    response.write(`data: ${JSON.stringify(chunk)}\n\n`);
  }
  response.write("data: [DONE]\n\n");
  response.end();
}
