import type { CompanionRiskLevel } from "./companionSchemas.js";

const CRISIS_PATTERNS = [/自杀/u, /不想活/u, /伤害自己/u, /结束生命/u, /suicide/i];
const DISTRESS_PATTERNS = [/撑不住/u, /很难过/u, /绝望/u, /崩溃/u, /没有希望/u];
const RISK_ORDER: Record<CompanionRiskLevel, number> = { normal: 0, distress: 1, crisis: 2 };

export function classifyRisk(text: string): CompanionRiskLevel {
  const normalized = text.trim();
  if (CRISIS_PATTERNS.some((pattern) => pattern.test(normalized))) return "crisis";
  if (DISTRESS_PATTERNS.some((pattern) => pattern.test(normalized))) return "distress";
  return "normal";
}

export function mergeRisk(
  first: CompanionRiskLevel,
  second: CompanionRiskLevel
): CompanionRiskLevel {
  return RISK_ORDER[first] >= RISK_ORDER[second] ? first : second;
}

export function crisisSupportMessage(): string {
  return "我很重视你现在的安全。请立即联系身边可信任的人陪着你；如果你可能马上伤害自己，请联系当地紧急援助或直接前往最近的急诊。";
}
