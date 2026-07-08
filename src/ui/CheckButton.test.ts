import { describe, expect, it } from "vitest";
import { getCheckButtonPressAction } from "./checkButtonPress";

describe("CheckButton press behavior", () => {
  it("undoes a completed check-in when it is still undoable", () => {
    expect(getCheckButtonPressAction({ disabled: false, checked: true, canUndo: true })).toBe("undo");
  });

  it("does nothing for a completed check-in after the undo window expires", () => {
    expect(getCheckButtonPressAction({ disabled: false, checked: true, canUndo: false })).toBe("none");
  });
});
