import { pool } from "../db/pool.js";

export const COMPANION_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS companion_events (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'processing',
  response_json JSONB,
  occurred_at TIMESTAMPTZ NOT NULL,
  timezone_offset_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (space_id, event_id)
);
ALTER TABLE companion_events
  ADD COLUMN IF NOT EXISTS timezone_offset_minutes INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_companion_events_created
  ON companion_events(space_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_messages (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  sender_account_id TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  event_id TEXT,
  risk_level TEXT NOT NULL DEFAULT 'normal',
  memory_proposal_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '90 days')
);
CREATE INDEX IF NOT EXISTS idx_companion_messages_recent
  ON companion_messages(space_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_companion_messages_expiry
  ON companion_messages(expires_at);

CREATE TABLE IF NOT EXISTS companion_memories (
  id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  source_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (space_id, source_message_id)
);
ALTER TABLE companion_memories ADD COLUMN IF NOT EXISTS source_message_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_companion_memories_source
  ON companion_memories(space_id, source_message_id);
CREATE INDEX IF NOT EXISTS idx_companion_memories_space
  ON companion_memories(space_id, created_at DESC);

CREATE TABLE IF NOT EXISTS companion_space_state (
  space_id TEXT PRIMARY KEY REFERENCES spaces(id) ON DELETE CASCADE,
  bond_points INTEGER NOT NULL DEFAULT 0,
  bond_stage TEXT NOT NULL DEFAULT 'first_meeting',
  conversation_summary TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companion_member_state (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  pet_visible BOOLEAN NOT NULL DEFAULT true,
  proactive_mode TEXT NOT NULL DEFAULT 'balanced',
  delivery_date TEXT,
  ordinary_count INTEGER NOT NULL DEFAULT 0,
  last_ordinary_at TIMESTAMPTZ,
  recent_fingerprints JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_active_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, account_id)
);

CREATE TABLE IF NOT EXISTS companion_bond_events (
  space_id TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  source_key TEXT NOT NULL,
  points INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (space_id, source_key)
);
`;

export async function runCompanionSchema(): Promise<void> {
  await pool.query(COMPANION_SCHEMA_SQL);
}
