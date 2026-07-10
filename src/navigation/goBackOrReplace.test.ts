import { describe, expect, it, vi } from "vitest";
import { goBackOrReplace } from "./goBackOrReplace";

describe("goBackOrReplace", () => {
  it("goes back when navigation history exists", () => {
    const navigation = {
      canGoBack: () => true,
      back: vi.fn(),
      replace: vi.fn()
    };

    goBackOrReplace(navigation, "/adventure");

    expect(navigation.back).toHaveBeenCalledOnce();
    expect(navigation.replace).not.toHaveBeenCalled();
  });

  it("replaces with the fallback when opened from a deep link", () => {
    const navigation = {
      canGoBack: () => false,
      back: vi.fn(),
      replace: vi.fn()
    };

    goBackOrReplace(navigation, "/adventure");

    expect(navigation.back).not.toHaveBeenCalled();
    expect(navigation.replace).toHaveBeenCalledWith("/adventure");
  });
});
