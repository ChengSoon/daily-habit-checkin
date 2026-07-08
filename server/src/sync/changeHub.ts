export type SyncChangeEvent = {
  type: "data_changed";
  resource: string;
  version: number;
  changedAt: string;
};

export type SyncConnection = {
  send(message: string): void;
};

export class SyncChangeHub {
  private readonly connectionsBySpace = new Map<string, Set<SyncConnection>>();
  private readonly versionsBySpace = new Map<string, number>();

  addConnection(spaceId: string, connection: SyncConnection): () => void {
    const connections = this.connectionsBySpace.get(spaceId) ?? new Set<SyncConnection>();
    connections.add(connection);
    this.connectionsBySpace.set(spaceId, connections);

    return () => {
      connections.delete(connection);
      if (connections.size === 0) {
        this.connectionsBySpace.delete(spaceId);
      }
    };
  }

  getVersion(spaceId: string): number {
    return this.versionsBySpace.get(spaceId) ?? 0;
  }

  notifyChange(spaceId: string, resource: string): SyncChangeEvent {
    const version = this.getVersion(spaceId) + 1;
    this.versionsBySpace.set(spaceId, version);

    const event: SyncChangeEvent = {
      type: "data_changed",
      resource,
      version,
      changedAt: new Date().toISOString()
    };
    const payload = JSON.stringify(event);

    const connections = this.connectionsBySpace.get(spaceId);
    for (const connection of connections ?? []) {
      try {
        connection.send(payload);
      } catch {
        connections?.delete(connection);
      }
    }

    return event;
  }
}

export const syncChangeHub = new SyncChangeHub();
