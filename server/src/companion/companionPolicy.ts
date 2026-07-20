export type DeliveryCategory = "ordinary" | "high_value" | "requested";
export type DeliveryBlockReason = "allowed" | "daily_cap" | "cooldown" | "duplicate";

export type MemberDeliveryState = {
  deliveryDate: string;
  ordinaryCount: number;
  lastOrdinaryAt: string | null;
  recentFingerprints: Record<string, string>;
};

type DeliveryPolicyInput = {
  category: DeliveryCategory;
  fingerprint: string;
  current: MemberDeliveryState;
  now: Date;
  timezoneOffsetMinutes?: number;
};

type DeliveryPolicyResult =
  | { allowed: false; reason: Exclude<DeliveryBlockReason, "allowed"> }
  | { allowed: true; reason: "allowed"; next: MemberDeliveryState };

const ORDINARY_DAILY_CAP = 2;
const ORDINARY_COOLDOWN_MS = 90 * 60 * 1000;
const FINGERPRINT_TTL_MS = 24 * 60 * 60 * 1000;

export function deliveryDateKey(now: Date, timezoneOffsetMinutes = 0): string {
  return new Date(now.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function elapsedSince(value: string, now: Date): number {
  return now.getTime() - new Date(value).getTime();
}

export function evaluateDeliveryPolicy(input: DeliveryPolicyInput): DeliveryPolicyResult {
  if (input.category === "requested") {
    return { allowed: true, reason: "allowed", next: input.current };
  }

  const dayKey = deliveryDateKey(input.now, input.timezoneOffsetMinutes);
  const current =
    input.current.deliveryDate === dayKey
      ? input.current
      : { ...input.current, deliveryDate: dayKey, ordinaryCount: 0, lastOrdinaryAt: null };
  const duplicateAt = current.recentFingerprints[input.fingerprint];
  if (duplicateAt && elapsedSince(duplicateAt, input.now) < FINGERPRINT_TTL_MS) {
    return { allowed: false, reason: "duplicate" };
  }
  if (input.category === "ordinary" && current.ordinaryCount >= ORDINARY_DAILY_CAP) {
    return { allowed: false, reason: "daily_cap" };
  }
  if (
    input.category === "ordinary" &&
    current.lastOrdinaryAt &&
    elapsedSince(current.lastOrdinaryAt, input.now) < ORDINARY_COOLDOWN_MS
  ) {
    return { allowed: false, reason: "cooldown" };
  }

  const recentFingerprints = Object.fromEntries(
    Object.entries(current.recentFingerprints).filter(
      ([, timestamp]) => elapsedSince(timestamp, input.now) < FINGERPRINT_TTL_MS
    )
  );
  recentFingerprints[input.fingerprint] = input.now.toISOString();
  return {
    allowed: true,
    reason: "allowed",
    next: {
      deliveryDate: dayKey,
      ordinaryCount: current.ordinaryCount + (input.category === "ordinary" ? 1 : 0),
      lastOrdinaryAt: input.category === "ordinary" ? input.now.toISOString() : current.lastOrdinaryAt,
      recentFingerprints
    }
  };
}

export type BondStage = "first_meeting" | "getting_familiar" | "in_sync" | "long_companionship";

export function bondStageForPoints(points: number): BondStage {
  if (points >= 120) return "long_companionship";
  if (points >= 60) return "in_sync";
  if (points >= 20) return "getting_familiar";
  return "first_meeting";
}

export function nextBondState(
  current: { points: number; seenSource: boolean },
  delta: number
): { awarded: boolean; points: number; stage: BondStage } {
  const increment = Number.isFinite(delta) ? Math.max(0, Math.trunc(delta)) : 0;
  const awarded = !current.seenSource && increment > 0;
  const points = current.points + (awarded ? increment : 0);
  return { awarded, points, stage: bondStageForPoints(points) };
}
