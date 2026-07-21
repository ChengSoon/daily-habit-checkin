import { MemoryConfirmationSchema, type CompanionRiskLevel, type MemoryProposal } from "./companionSchemas.js";
import {
  CompanionActionCommandSchema,
  CompanionActionSchema,
  type CompanionAction,
  type CompanionActionCommand
} from "./companionActionSchemas.js";
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
  action_id?: string | null;
  action_type?: string | null;
  action_arguments_json?: unknown;
  action_summary?: string | null;
  action_status?: string | null;
  action_requested_by?: string | null;
  action_timezone_offset_minutes?: number | null;
  action_expires_at?: string | Date | null;
  action_result_message?: string | null;
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
  action?: CompanionAction | null;
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
  const action = parseAction(row);
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    senderAccountId: row.sender_account_id,
    senderName: row.sender_name,
    riskLevel: row.risk_level,
    memoryProposal: proposal(row.memory_proposal_json),
    memoryConfirmed: row.memory_confirmed === true,
    createdAt: timestamp(row.created_at),
    action
  };
}

function parseAction(row: MessageRow): CompanionAction | null {
  if (!row.action_id || !row.action_type || !row.action_status || !row.action_requested_by || !row.action_expires_at) {
    return null;
  }
  let rawArguments = row.action_arguments_json;
  if (typeof rawArguments === "string") {
    try {
      rawArguments = JSON.parse(rawArguments);
    } catch {
      return null;
    }
  }
  const command = CompanionActionCommandSchema.safeParse({
    type: row.action_type,
    arguments: rawArguments
  });
  const parsed = CompanionActionSchema.safeParse({
    id: row.action_id,
    command: command.success ? command.data : null,
    summary: row.action_summary,
    status: row.action_status,
    requestedBy: row.action_requested_by,
    timezoneOffsetMinutes: row.action_timezone_offset_minutes ?? 0,
    expiresAt: timestamp(row.action_expires_at),
    resultMessage: row.action_result_message ?? null
  });
  return parsed.success ? parsed.data : null;
}

const MESSAGE_SELECT = `SELECT m.id, m.role, m.content, m.sender_account_id,
  a.display_name AS sender_name, m.risk_level, m.memory_proposal_json, m.created_at,
  EXISTS (
    SELECT 1 FROM companion_memories cm
    WHERE cm.space_id = m.space_id AND cm.source_message_id = m.id
  ) AS memory_confirmed,
  ca.id AS action_id, ca.action_type, ca.arguments_json AS action_arguments_json,
  ca.summary AS action_summary, ca.status AS action_status,
  ca.requested_by AS action_requested_by,
  ca.timezone_offset_minutes AS action_timezone_offset_minutes,
  ca.expires_at AS action_expires_at,
  ca.result_message AS action_result_message
  FROM companion_messages m
  LEFT JOIN accounts a ON a.id = m.sender_account_id AND a.space_id = m.space_id
  LEFT JOIN companion_actions ca ON ca.source_message_id = m.id AND ca.space_id = m.space_id`;

export function createCompanionMessageRepository(input: {
  db: CompanionDb;
  transact: TransactionRunner;
}) {
  return {
    async listRecentMessages(spaceId: string, limit: number): Promise<CompanionMessage[]> {
      const result = await input.db.query<MessageRow>(
        `${MESSAGE_SELECT}
         WHERE m.space_id = $1 AND m.expires_at > now()
         ORDER BY m.created_at DESC,
           CASE m.role WHEN 'assistant' THEN 0 WHEN 'user' THEN 1 ELSE 2 END,
           m.id DESC
         LIMIT $2`,
        [spaceId, limit]
      );
      return result.rows.reverse().map(mapMessage);
    },

    async listMessagePage(spaceId: string, limit: number, cursor: string | null) {
      const page = await input.db.query<MessageRow>(
        `${MESSAGE_SELECT}
         WHERE m.space_id = $1 AND m.expires_at > now()
           AND ($2::timestamptz IS NULL OR m.created_at < $2)
         ORDER BY m.created_at DESC,
           CASE m.role WHEN 'assistant' THEN 0 WHEN 'user' THEN 1 ELSE 2 END,
           m.id DESC
         LIMIT $3`,
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
        action?: {
          id: string;
          command: CompanionActionCommand;
          summary: string;
          expiresAt: string;
          timezoneOffsetMinutes: number;
        };
      }
    ): Promise<void> {
      // 同一事务里默认 now() 常得到相同时间戳；排序时会把用户消息排到助手后面。
      // 显式错开 1ms，保证「先用户、后助手」。
      const userCreatedAt = new Date();
      const assistantCreatedAt = new Date(userCreatedAt.getTime() + 1);
      await input.transact(async (client) => {
        await client.query(
          `INSERT INTO companion_messages
             (id, space_id, sender_account_id, role, content, risk_level, created_at)
           VALUES ($1, $2, $3, 'user', $4, $5, $6)`,
          [
            exchange.userMessageId,
            spaceId,
            accountId,
            exchange.userText,
            exchange.riskLevel,
            userCreatedAt.toISOString()
          ]
        );
        await client.query(
          `INSERT INTO companion_messages
             (id, space_id, sender_account_id, role, content, risk_level, memory_proposal_json, created_at)
           VALUES ($1, $2, NULL, 'assistant', $3, $4, $5::jsonb, $6)`,
          [
            exchange.assistantMessageId,
            spaceId,
            exchange.assistantText,
            exchange.riskLevel,
            exchange.memoryProposal ? JSON.stringify(exchange.memoryProposal) : null,
            assistantCreatedAt.toISOString()
          ]
        );
        if (exchange.action) {
          await client.query(
            `INSERT INTO companion_actions
               (id, space_id, requested_by, source_message_id, action_type,
                arguments_json, summary, timezone_offset_minutes, expires_at)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
            [
              exchange.action.id,
              spaceId,
              accountId,
              exchange.assistantMessageId,
              exchange.action.command.type,
              JSON.stringify(exchange.action.command.arguments),
              exchange.action.summary,
              exchange.action.timezoneOffsetMinutes,
              exchange.action.expiresAt
            ]
          );
        }
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
