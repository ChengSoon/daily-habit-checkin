import { describe, expect, it } from "vitest";
import { memoryProposalFromExplicitRequest } from "./companionMemory.js";

describe("memoryProposalFromExplicitRequest", () => {
  it("creates a categorized proposal only for an explicit remember request", () => {
    expect(memoryProposalFromExplicitRequest("请记住，我们想每周一起散步三次")).toEqual({
      category: "shared_goal",
      content: "我们想每周一起散步三次"
    });
    expect(memoryProposalFromExplicitRequest("我今天去散步了")).toBeNull();
  });

  it("rejects credentials, precise locations, and empty proposals", () => {
    expect(memoryProposalFromExplicitRequest("记住我的密码是 abc123")).toBeNull();
    expect(memoryProposalFromExplicitRequest("记住我住在幸福路 18 号 302 室")).toBeNull();
    expect(memoryProposalFromExplicitRequest("记住")).toBeNull();
  });
});
