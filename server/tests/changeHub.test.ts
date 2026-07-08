import { describe, expect, it } from "vitest";
import { SyncChangeHub } from "../src/sync/changeHub.js";

function createConnection() {
  const messages: string[] = [];
  return {
    connection: {
      send(message: string) {
        messages.push(message);
      }
    },
    messages
  };
}

describe("SyncChangeHub", () => {
  it("broadcasts changes only to clients in the changed space", () => {
    const hub = new SyncChangeHub();
    const first = createConnection();
    const second = createConnection();

    hub.addConnection("space_a", first.connection);
    hub.addConnection("space_b", second.connection);
    const event = hub.notifyChange("space_a", "rewards");

    expect(event).toMatchObject({ type: "data_changed", resource: "rewards", version: 1 });
    expect(first.messages).toHaveLength(1);
    expect(JSON.parse(first.messages[0])).toMatchObject({ resource: "rewards", version: 1 });
    expect(second.messages).toHaveLength(0);
  });

  it("stops broadcasting after a connection unsubscribes", () => {
    const hub = new SyncChangeHub();
    const client = createConnection();

    const unsubscribe = hub.addConnection("space_a", client.connection);
    unsubscribe();
    hub.notifyChange("space_a", "habits");

    expect(client.messages).toHaveLength(0);
  });

  it("drops a connection when sending to it fails", () => {
    const hub = new SyncChangeHub();
    const healthy = createConnection();
    const broken = {
      send() {
        throw new Error("socket closed");
      }
    };

    hub.addConnection("space_a", broken);
    hub.addConnection("space_a", healthy.connection);

    expect(() => hub.notifyChange("space_a", "habits")).not.toThrow();
    expect(healthy.messages).toHaveLength(1);
    hub.notifyChange("space_a", "rewards");
    expect(healthy.messages).toHaveLength(2);
  });
});
