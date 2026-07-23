import { describe, expect, it, vi } from "vitest";
import { createCompanionEvent } from "./companionTypes";
import { createCompanionEventBus } from "./PetContext";

describe("createCompanionEventBus", () => {
  it("delivers typed events until the handler unsubscribes", () => {
    const bus = createCompanionEventBus();
    const handler = vi.fn();
    const unsubscribe = bus.subscribe(handler);
    const event = createCompanionEvent({ id: "return-1", type: "app_returned", payload: {},
      occurredAt: new Date("2026-07-19T12:00:00.000Z") });

    bus.emit(event);
    unsubscribe();
    bus.emit(createCompanionEvent({ id: "return-2", type: "app_returned", payload: {} }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
  });
});
