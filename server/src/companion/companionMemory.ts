import type { MemoryProposal } from "./companionSchemas.js";

const REMEMBER_PREFIX = /^(?:请)?(?:帮我)?记住[\s：:,，]*/u;
const SENSITIVE = [/密码|口令|验证码|密钥|token|api\s*key/i, /住在|地址|\d+号|\d+室/u];

function categoryFor(content: string): MemoryProposal["category"] {
  if (/生日|纪念日|\d{1,2}月\d{1,2}日/u.test(content)) return "important_date";
  if (/目标|一起|每周|坚持/u.test(content)) return "shared_goal";
  if (/鼓励|提醒|督促|安慰/u.test(content)) return "encouragement_style";
  if (/叫我|称呼|喜欢|偏好/u.test(content)) return "preference";
  return "shared_moment";
}

export function memoryProposalFromExplicitRequest(text: string): MemoryProposal | null {
  const trimmed = text.trim();
  if (!REMEMBER_PREFIX.test(trimmed) || SENSITIVE.some((pattern) => pattern.test(trimmed))) {
    return null;
  }
  const content = trimmed.replace(REMEMBER_PREFIX, "").replace(/^[「『"']|[」』"']$/gu, "").trim().slice(0, 200);
  if (!content) return null;
  return { category: categoryFor(content), content };
}
