import { describe, expect, it } from "vitest";
import { extractDeltaContent, parseSseDataLines } from "./sse";

describe("parseSseDataLines", () => {
  it("splits complete events and keeps remainder", () => {
    const { events, rest } = parseSseDataLines('data: {"a":1}\n\ndata: {"b":2}\n\ndata: {"c"');
    expect(events).toEqual(['{"a":1}', '{"b":2}']);
    expect(rest).toBe('data: {"c"');
  });
});

describe("extractDeltaContent", () => {
  it("reads openai delta content", () => {
    expect(extractDeltaContent('{"choices":[{"delta":{"content":"你好"}}]}')).toBe("你好");
  });

  it("returns null for done", () => {
    expect(extractDeltaContent("[DONE]")).toBeNull();
  });
});
