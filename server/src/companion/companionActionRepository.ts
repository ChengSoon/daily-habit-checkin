import type { QueryResultRow } from "pg";
import {
  CompanionActionCommandSchema,
  CompanionActionSchema,
  type CompanionAction,
  type CompanionActionCommand
} from "./companionActionSchemas.js";
import type { CompanionDb } from "./companionRepository.js";

type TransactionRunner = <T>(run: (client: CompanionDb) => Promise<T>) => Promise<T>;

type ActionRow = QueryResultRow & {
  id: string;
  action_type: string;
  arguments_json: unknown;
  summary: string;
  status: string;
  requested_by: string;
  timezone_offset_minutes: number;
  expires_at: string | Date;
  result_message: string | null;
};

export class CompanionActionNotFoundError extends Error {
  constructor() {
    super("动作不存在");
    this.name = "CompanionActionNotFoundError";
  }
}

export class CompanionActionForbiddenError extends Error {
  constructor() {
    super("无权确认这个动作");
    this.name = "CompanionActionForbiddenError";
  }
}

function timestamp(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function parseArguments(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function mapAction(row: ActionRow): CompanionAction | null {
  const command = CompanionActionCommandSchema.safeParse({
    type: row.action_type,
    arguments: parseArguments(row.arguments_json)
  });
  if (!command.success) return null;
  const action = CompanionActionSchema.safeParse({
    id: row.id,
    command: command.data,
    summary: row.summary,
    status: row.status,
    requestedBy: row.requested_by,
    timezoneOffsetMinutes: row.timezone_offset_minutes,
    expiresAt: timestamp(row.expires_at),
    resultMessage: row.result_message
  });
  return action.success ? action.data : null;
}

export function createCompanionActionRepository(input: {
  db: CompanionDb;
  transact: TransactionRunner;
}) {
  return {
    async withLockedAction<T>(
      spaceId: string,
      accountId: string,
      actionId: string,
      run: (client: CompanionDb, action: CompanionAction) => Promise<T>
    ): Promise<T> {
      return input.transact(async (client) => {
        const result = await client.query<ActionRow>(
          `SELECT id, action_type, arguments_json, summary, status, requested_by,
                  timezone_offset_minutes, expires_at, result_message
             FROM companion_actions
            WHERE id = $1 AND space_id = $2
            FOR UPDATE`,
          [actionId, spaceId]
        );
        if (result.rows.length === 0) throw new CompanionActionNotFoundError();
        const action = mapAction(result.rows[0]);
        if (!action) throw new Error("动作数据格式不正确");
        if (action.requestedBy !== accountId) throw new CompanionActionForbiddenError();
        return run(client, action);
      });
    },

    async updateStatus(
      client: CompanionDb,
      spaceId: string,
      actionId: string,
      status: CompanionAction["status"],
      resultMessage: string | null
    ): Promise<void> {
      await client.query(
        `UPDATE companion_actions SET status = $3, result_message = $4,
                completed_at = CASE WHEN $3 IN ('succeeded', 'failed', 'cancelled', 'expired')
                                    THEN now() ELSE completed_at END
           WHERE id = $1 AND space_id = $2`,
        [actionId, spaceId, status, resultMessage]
      );
    },

    async listPending(spaceId: string): Promise<CompanionAction[]> {
      const result = await input.db.query<ActionRow>(
        `SELECT id, action_type, arguments_json, summary, status, requested_by,
                timezone_offset_minutes, expires_at, result_message
           FROM companion_actions
          WHERE space_id = $1 AND status = 'pending' AND expires_at > now()
          ORDER BY created_at ASC`,
        [spaceId]
      );
      return result.rows.map(mapAction).filter((action): action is CompanionAction => Boolean(action));
    }
  };
}

export type CompanionActionRepository = ReturnType<typeof createCompanionActionRepository>;
export type { CompanionActionCommand };
