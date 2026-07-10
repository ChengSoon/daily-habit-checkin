import { randomUUID } from "node:crypto";
import { walletDelta, WalletTxType } from "../data/walletMath.js";

type QueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type AdventureXpTransactionInput = {
  uniqueKey: string;
  amount: number;
  type: WalletTxType;
  reason: "adventure_station" | "adventure_station_undo";
  checkInId: string | null;
  dateKey: string | null;
};

export type AdventureXpTransaction = AdventureXpTransactionInput & {
  id: string;
  createdAt: string;
};

export async function applyAdventureXpTransaction(
  client: QueryClient,
  spaceId: string,
  input: AdventureXpTransactionInput
): Promise<AdventureXpTransaction | null> {
  await client.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now())
     ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );

  const { rows } = await client.query(
    `INSERT INTO xp_transactions (
       id, space_id, unique_key, amount, type, reason,
       habit_id, check_in_id, reward_id, redemption_id, date_key, created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, NULL, NULL, $8, now())
     ON CONFLICT (space_id, unique_key) DO NOTHING
     RETURNING id, unique_key AS "uniqueKey", amount, type, reason,
               check_in_id AS "checkInId", date_key AS "dateKey", created_at AS "createdAt"`,
    [
      randomUUID(),
      spaceId,
      input.uniqueKey,
      input.amount,
      input.type,
      input.reason,
      input.checkInId,
      input.dateKey
    ]
  );
  const inserted = rows[0] as AdventureXpTransaction | undefined;
  if (!inserted) {
    return null;
  }

  const delta = walletDelta(input.type, input.amount);
  await client.query(
    `UPDATE xp_wallet SET
       balance = balance + $2,
       lifetime_earned = lifetime_earned + $3,
       lifetime_spent = lifetime_spent + $4,
       updated_at = now()
     WHERE space_id = $1`,
    [spaceId, delta.balance, delta.earned, delta.spent]
  );

  return inserted;
}
