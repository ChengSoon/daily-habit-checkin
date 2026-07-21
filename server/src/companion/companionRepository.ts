import { randomUUID } from "node:crypto";
import type { QueryResult, QueryResultRow } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import {
  CompanionReplySchema,
  type CompanionEvent,
  type CompanionReply,
  type MemoryConfirmation,
  type MemoryProposal
} from "./companionSchemas.js";
import { createCompanionMessageRepository } from "./companionMessageRepository.js";
import { createCompanionActionRepository } from "./companionActionRepository.js";

export type { CompanionMessage } from "./companionMessageRepository.js";

export type CompanionDb = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>;
};

type TransactionRunner = <T>(run: (client: CompanionDb) => Promise<T>) => Promise<T>;

export type CompanionMemory = MemoryProposal & {
  id: string;
  createdBy: string | null;
  creatorName: string | null;
  sourceMessageId: string | null;
  createdAt: string;
};

type RepositoryOptions = {
  db?: CompanionDb;
  transact?: TransactionRunner;
  createId?: () => string;
};

function defaultTransaction<T>(run: (client: CompanionDb) => Promise<T>): Promise<T> {
  return withTransaction((client) => run(client as CompanionDb));
}

function parseCachedReply(raw: unknown): CompanionReply | null {
  const candidate = typeof raw === "string" ? JSON.parse(raw) : raw;
  const parsed = CompanionReplySchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function timestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

export function createCompanionRepository(options: RepositoryOptions = {}) {
  const db = options.db ?? (getPool() as CompanionDb);
  const transact = options.transact ?? defaultTransaction;
  const createId = options.createId ?? randomUUID;
  const messages = createCompanionMessageRepository({ db, transact });
  const actions = createCompanionActionRepository({ db, transact });

  return {
    ...messages,
    actions,
    async claimEvent(
      spaceId: string,
      accountId: string,
      event: CompanionEvent
    ): Promise<{ claimed: boolean; cachedReply: CompanionReply | null }> {
      const inserted = await db.query<{ event_id: string }>(
        `INSERT INTO companion_events (
           space_id, event_id, account_id, event_type, payload_json, occurred_at,
           timezone_offset_minutes
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         ON CONFLICT (space_id, event_id) DO NOTHING
         RETURNING event_id`,
        [
          spaceId,
          event.id,
          accountId,
          event.type,
          JSON.stringify(event.payload),
          event.occurredAt,
          event.timezoneOffsetMinutes
        ]
      );
      if (inserted.rows.length > 0) return { claimed: true, cachedReply: null };

      const cached = await db.query<{ response_json: unknown }>(
        `SELECT response_json FROM companion_events
         WHERE space_id = $1 AND event_id = $2`,
        [spaceId, event.id]
      );
      return {
        claimed: false,
        cachedReply: cached.rows[0]?.response_json
          ? parseCachedReply(cached.rows[0].response_json)
          : null
      };
    },

    async completeEvent(spaceId: string, eventId: string, reply: CompanionReply): Promise<void> {
      await db.query(
        `UPDATE companion_events
         SET status = 'completed', response_json = $3::jsonb, completed_at = now()
         WHERE space_id = $1 AND event_id = $2`,
        [spaceId, eventId, JSON.stringify(reply)]
      );
    },

    async listMemories(spaceId: string): Promise<CompanionMemory[]> {
      const result = await db.query<{
        id: string;
        category: MemoryProposal["category"];
        content: string;
        created_by: string | null;
        creator_name: string | null;
        source_message_id: string | null;
        created_at: string | Date;
      }>(
        `SELECT m.id, m.category, m.content, m.created_by,
                a.display_name AS creator_name, m.source_message_id, m.created_at
         FROM companion_memories m
         LEFT JOIN accounts a ON a.id = m.created_by AND a.space_id = m.space_id
         WHERE m.space_id = $1
         ORDER BY m.created_at DESC`,
        [spaceId]
      );
      return result.rows.map((row) => ({
        id: row.id,
        category: row.category,
        content: row.content,
        createdBy: row.created_by,
        creatorName: row.creator_name,
        sourceMessageId: row.source_message_id,
        createdAt: timestamp(row.created_at)
      }));
    },

    async saveMemory(
      spaceId: string,
      accountId: string,
      proposal: MemoryConfirmation
    ): Promise<CompanionMemory> {
      const result = await db.query<{
        id: string;
        category: MemoryProposal["category"];
        content: string;
        created_by: string | null;
        creator_name: string | null;
        source_message_id: string | null;
        created_at: string | Date;
      }>(
        `WITH inserted AS (
           INSERT INTO companion_memories
             (id, space_id, category, content, created_by, source_message_id)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (space_id, source_message_id) DO UPDATE SET
             source_message_id = excluded.source_message_id
           RETURNING id, space_id, category, content, created_by, source_message_id, created_at
         )
         SELECT i.id, i.category, i.content, i.created_by,
                a.display_name AS creator_name, i.source_message_id, i.created_at
         FROM inserted i LEFT JOIN accounts a
           ON a.id = i.created_by AND a.space_id = i.space_id`,
        [
          createId(),
          spaceId,
          proposal.category,
          proposal.content,
          accountId,
          proposal.sourceMessageId ?? null
        ]
      );
      const row = result.rows[0];
      if (!row) throw new Error("共同记忆保存失败");
      return {
        id: row.id,
        category: row.category,
        content: row.content,
        createdBy: row.created_by,
        creatorName: row.creator_name,
        sourceMessageId: row.source_message_id,
        createdAt: timestamp(row.created_at)
      };
    },

    async deleteMemory(spaceId: string, memoryId: string): Promise<boolean> {
      const deleted = await db.query<{ id: string }>(
        `DELETE FROM companion_memories
         WHERE space_id = $1 AND id = $2
         RETURNING id`,
        [spaceId, memoryId]
      );
      return deleted.rows.length > 0;
    }
  };
}

export type CompanionRepository = ReturnType<typeof createCompanionRepository>;
