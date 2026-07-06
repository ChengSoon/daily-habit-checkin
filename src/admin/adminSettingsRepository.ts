import { getDatabase } from "../db/database";

const ADMIN_PIN_KEY = "admin_pin_hash";
const ADMIN_PIN_SALT = "couple-reward-shop-v1";

type AdminSettingRow = {
  key: string;
  value: string;
};

function hashPin(pin: string): string {
  let hash = 2166136261;
  const value = `${ADMIN_PIN_SALT}:${pin}`;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a:${(hash >>> 0).toString(16)}`;
}

async function getSetting(key: string): Promise<string | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<AdminSettingRow>("SELECT * FROM admin_settings WHERE key = ?", [key]);

  return row?.value ?? null;
}

async function saveSetting(key: string, value: string): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    "INSERT INTO admin_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [key, value]
  );
}

export async function hasAdminPin(): Promise<boolean> {
  return (await getSetting(ADMIN_PIN_KEY)) !== null;
}

export async function setAdminPin(pin: string): Promise<void> {
  if (pin.trim().length < 4) {
    throw new Error("管理 PIN 至少需要 4 位");
  }

  await saveSetting(ADMIN_PIN_KEY, hashPin(pin));
}

export async function verifyAdminPin(pin: string): Promise<boolean> {
  const stored = await getSetting(ADMIN_PIN_KEY);

  return stored !== null && stored === hashPin(pin);
}
