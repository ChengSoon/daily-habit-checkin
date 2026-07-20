import { describe, expect, it } from "vitest";
import { classifyRisk, crisisSupportMessage, mergeRisk } from "./companionSafety.js";

describe("companion safety", () => {
  it("classifies normal, distress, and crisis signals", () => {
    expect(classifyRisk("今天完成打卡很开心")).toBe("normal");
    expect(classifyRisk("我今天真的很难过，快撑不住了")).toBe("distress");
    expect(classifyRisk("我想自杀，不想活了")).toBe("crisis");
  });

  it("uses the more conservative risk when signals disagree", () => {
    expect(mergeRisk("normal", "distress")).toBe("distress");
    expect(mergeRisk("crisis", "normal")).toBe("crisis");
  });

  it("returns direct crisis support without cute roleplay", () => {
    const message = crisisSupportMessage();

    expect(message).toContain("联系");
    expect(message).toContain("紧急");
    expect(message).not.toMatch(/[～~]|卡卡|可爱|撒娇/);
  });
});
