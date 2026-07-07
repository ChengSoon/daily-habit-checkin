import { getR2PublicBase } from "./apiClient";

/**
 * 把 R2 对象 key 拼成可直接交给 <Image source={{ uri }}> 的公开地址。
 * key 为 null（没图）或未配置公开域名时返回 null，让组件回退到占位图/字母头像。
 */
export function publicUrl(key: string | null | undefined): string | null {
  if (!key) {
    return null;
  }
  const base = getR2PublicBase();
  if (!base) {
    return null;
  }
  return `${base}/${key}`;
}
