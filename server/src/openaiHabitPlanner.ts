import OpenAI from "openai";
import { HabitPlanRequestSchema, HabitPlanResponse, HabitPlanResponseSchema } from "./habitPlanSchema.js";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function generateHabitPlan(rawInput: unknown): Promise<HabitPlanResponse> {
  const input = HabitPlanRequestSchema.parse(rawInput);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const response = await client.responses.create({
    model: input.model ?? process.env.OPENAI_MODEL ?? "gpt-5.5",
    instructions:
      "你是习惯计划助手。只生成温和、可执行、低压力的习惯入门计划。输出的 durationDays 必须等于用户输入的 durationDays。必须输出 JSON，不要输出 Markdown。",
    input: JSON.stringify(input),
    text: {
      format: {
        type: "json_schema",
        name: "habit_plan",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          required: [
            "habitName",
            "description",
            "durationDays",
            "dailyActions",
            "recommendedReminderTime",
            "recommendedTrackType",
            "numericUnit",
            "fallbackAdvice",
            "safetyNote"
          ],
          properties: {
            habitName: { type: "string" },
            description: { type: "string" },
            durationDays: { enum: [7, 21] },
            dailyActions: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["day", "action", "targetValue"],
                properties: {
                  day: { type: "number" },
                  action: { type: "string" },
                  targetValue: { type: ["number", "null"] }
                }
              }
            },
            recommendedReminderTime: { type: "string" },
            recommendedTrackType: { enum: ["check", "numeric"] },
            numericUnit: { type: ["string", "null"] },
            fallbackAdvice: { type: "string" },
            safetyNote: { type: ["string", "null"] }
          }
        }
      }
    }
  });

  const content = response.output_text;

  if (!content) {
    throw new Error("AI returned empty content");
  }

  return HabitPlanResponseSchema.parse(JSON.parse(content));
}
