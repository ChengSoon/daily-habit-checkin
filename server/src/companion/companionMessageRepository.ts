import { MemoryConfirmationSchema, type CompanionRiskLevel, type MemoryProposal } from "./companionSchemas.js";
import type { CompanionDb } from "./companionRepository.js";

type TransactionRunner = <T>(run: (client: CompanionDb) => Promise<T>) => Promise<T>;
type MessageRow = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sender_account_id: string | null;
  sender_name: string | null;
  risk_level: CompanionRiskLevel;
  memory_proposal_json?: unknown;
  memory_confirmed?: boolean;
  created_at: string | Date;
};

export type CompanionMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  senderAccountId: string | null;
  senderName: string | null;
  riskLevel: CompanionRiskLevel;
  memoryProposal: MemoryProposal | null;
  memoryConfirmed: boolean;
  createdAt: string;
};

function timestamp(value: unknown): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function proposal(value: unknown): MemoryProposal | null {
  if (!value) return null;
  let candidate = value;
  if (typeof value === "string") {
    try {
      candidate = JSON.parse(value);
    } catch {
      return null;
    }
  }
  const parsed = MemoryConfirmationSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

function mapMessage(row: MessageRow): CompanionMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    senderAccountId: row.sender_account_id,
    senderName: row.sender_name,
    riskLevel: row.risk_level,
    memoryProposal: proposal(row.memory_proposal_json),
    memoryConfirmed: row.memory_confirmed === true,
    createdAt: timestamp(row.created_at)
  };
}

const MESSAGE_SELECT = `SELECT m.id, m.role, m.content, m.sender_account_id,
  a.display_name AS sender_name, m.risk_level, m.memory_proposal_json, m.created_at,
  EXISTS (
    SELECT 1 FROM companion_memories cm
    WHERE cm.space_id = m.space_id AND cm.source_message_id = m.id
  ) AS memory_confirmed
  FROM companion_messages m
  LEFT JOIN accounts a ON a.id = m.sender_account_id AND a.space_id = m.space_id`;

export function createCompanionMessageRepository(input: {
  db: CompanionDb;
  transact: TransactionRunner;
}) {
  return {
    async listRecentMessages(spaceId: string, limit: number): Promise<CompanionMessage[]> {
      const result = await input.db.query<MessageRow>(
        `${MESSAGE_SELECT}
         WHERE m.space_id = $1 AND m.expires_at > now()
         ORDER BY m.created_at DESC LIMIT $2`,
        [spaceId, limit]
      );
      return result.rows.reverse().map(mapMessage);
    },

    async listMessagePage(spaceId: string, limit: number, cursor: string | null) {
      const page = await input.db.query<MessageRow>(
        `${MESSAGE_SELECT}
         WHERE m.space_id = $1 AND m.expires_at > now()
           AND ($2::timestamptz IS NULL OR m.created_at < $2)
         ORDER BY m.created_at DESC LIMIT $3`,
        [spaceId, cursor, limit + 1]
      );
      const rows = page.rows.slice(0, limit);
      return {
        items: rows.reverse().map(mapMessage),
        nextCursor: page.rows.length > limit ? timestamp(rows[0].created_at) : null
      };
    },

    async appendExchange(
      spaceId: string,
      accountId: string,
      exchange: {
        userMessageId: string;
        userText: string;
        assistantMessageId: string;
        assistantText: string;
        riskLevel: CompanionRiskLevel;
        memoryProposal: MemoryProposal | null;
      }
    ): Promise<void> {
      await input.transact(async (client) => {
        await client.query(
          `INSERT INTO companion_messages
             (id, space_id, sender_account_id, role, content, risk_level)
           VALUES ($1, $2, $3, 'user', $4, $5)`,
          [exchange.userMessageId, spaceId, accountId, exchange.userText, exchange.riskLevel]
        );
        await client.query(
          `INSERT INTO companion_messages
             (id, space_id, sender_account_id, role, content, risk_level, memory_proposal_json)
           VALUES ($1, $2, NULL, 'assistant', $3, $4, $5::jsonb)`,
          [
            exchange.assistantMessageId,
            spaceId,
            exchange.assistantText,
            exchange.riskLevel,
            exchange.memoryProposal ? JSON.stringify(exchange.memoryProposal) : null
          ]
        );
      });
    },

    async appendAssistantMessage(
      spaceId: string,
      message: { id: string; eventId: string; content: string; riskLevel: CompanionRiskLevel }
    ): Promise<void> {
      await input.db.query(
        `INSERT INTO companion_messages
           (id, space_id, sender_account_id, role, content, event_id, risk_level)
         VALUES ($1, $2, NULL, 'assistant', $3, $4, $5)`,
        [message.id, spaceId, message.content, message.eventId, message.riskLevel]
      );
    },

    async pruneExpiredMessages(spaceId: string): Promise<void> {
      await input.db.query(
        "DELETE FROM companion_messages WHERE space_id = $1 AND expires_at <= now()",
        [spaceId]
      );
    },

    async clearMessages(spaceId: string): Promise<void> {
      await input.db.query("DELETE FROM companion_messages WHERE space_id = $1", [spaceId]);
    }
  };
}
