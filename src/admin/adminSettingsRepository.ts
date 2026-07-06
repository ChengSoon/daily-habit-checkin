import { fetchSettings, saveSettings } from "../sync/settingsClient";

const ADMIN_PIN_KEY = "admin_pin_hash";
const ADMIN_PIN_SALT = "couple-reward-shop-v1";

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
  const values = await fetchSettings("admin");
  return values[key] ?? null;
}

async function saveSetting(key: string, value: string): Promise<void> {
  await saveSettings("admin", { [key]: value });
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
