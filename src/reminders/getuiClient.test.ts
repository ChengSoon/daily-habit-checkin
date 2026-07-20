import { describe, expect, it, vi } from "vitest";
import { waitForGetuiClientId, type GetuiNativeModule } from "./getuiClient";

function fakeModule(initialClientId: string | null): {
  module: GetuiNativeModule;
  emit(clientId: string): void;
  remove: ReturnType<typeof vi.fn>;
} {
  let listener: ((event: { clientId?: string }) => void) | null = null;
  const remove = vi.fn();
  return {
    module: {
      initialize: vi.fn(async () => undefined),
      getClientId: vi.fn(async () => initialClientId),
      addListener: vi.fn((_eventName, nextListener) => {
        listener = nextListener;
        return { remove };
      })
    },
    emit(clientId) {
      listener?.({ clientId });
    },
    remove
  };
}

describe("waitForGetuiClientId", () => {
  it("returns a cached CID and removes the listener", async () => {
    const fake = fakeModule("cid-cached-123456");

    await expect(waitForGetuiClientId(fake.module, 100)).resolves.toBe("cid-cached-123456");
    expect(fake.remove).toHaveBeenCalledOnce();
  });

  it("waits for the native CID event", async () => {
    const fake = fakeModule(null);
    const pending = waitForGetuiClientId(fake.module, 100);

    fake.emit("cid-event-123456");

    await expect(pending).resolves.toBe("cid-event-123456");
    expect(fake.remove).toHaveBeenCalledOnce();
  });
});
