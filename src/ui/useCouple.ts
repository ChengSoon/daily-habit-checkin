import { useCallback, useEffect, useState } from "react";
import { getCurrentAccount, listSpaceMembers, SpaceMember } from "../sync/authService";
import { publicUrl } from "../sync/uploadClient";
import { AvatarTone } from "./Avatar";

export type CoupleMember = {
  id: string;
  name: string;
  /** 当前登录者=you（粉），另一半=partner（紫）。 */
  tone: AvatarTone;
  isMe: boolean;
  /**
   * 头像图片 URL（R2 公开域名直连，走 CDN + 系统缓存）；
   * 没上传头像则为 null，组件回退到字母头像。图片字节不再进内存/JSON。
   */
  avatarUrl: string | null;
};

export type Couple = {
  /** 当前登录者。未登录时为 null。 */
  you: CoupleMember | null;
  /** 另一半。还没加入空间时为 null。 */
  partner: CoupleMember | null;
  /** you 在前、partner 在后的有序列表，用于成对头像。 */
  people: CoupleMember[];
  /** 按 accountId 快速查归属，用于打卡记录标注是谁。 */
  byId: Record<string, CoupleMember>;
  loaded: boolean;
};

const EMPTY: Couple = { you: null, partner: null, people: [], byId: {}, loaded: false };

/** 当前登录账号的最小信息，用于在成员接口不可用时兜底渲染「你」（含头像）。 */
export type MeAccount = {
  id: string;
  displayName: string;
  avatarKey?: string | null;
} | null;

/**
 * 解析当前空间的情侣双方，把「当前登录者」标为 you（粉）、另一半标为 partner（紫）。
 *
 * 「你」优先取自 me（getCurrentAccount）——只要登录了就一定能显示自己的头像，
 * 不依赖 /space-members 接口（老后端没有该路由时会返回空成员）。
 * 「另一半」来自成员列表里 id 不等于自己的那个人；没有则优雅降级为单人 + 邀请引导。
 *
 * 头像不再随成员/账号 JSON 下发，这里根据对象 key 拼 R2 公开地址。
 */
export function buildCouple(members: SpaceMember[], me: MeAccount): Couple {
  const myId = me?.id ?? null;

  // 「你」：优先用 me；成员列表里若有更完整的昵称/头像 key 则以成员列表为准。
  const meFromMembers = myId ? members.find((member) => member.id === myId) ?? null : null;
  const you: CoupleMember | null = me
    ? {
        id: me.id,
        name: meFromMembers?.displayName ?? me.displayName,
        tone: "you",
        isMe: true,
        // 头像 key 优先取成员列表（更权威），回退 me；只要登录了就能显示自己的头像。
        avatarUrl: publicUrl(meFromMembers ? meFromMembers.avatarKey : me.avatarKey ?? null)
      }
    : meFromMembers
      ? {
          id: meFromMembers.id,
          name: meFromMembers.displayName,
          tone: "you",
          isMe: true,
          avatarUrl: publicUrl(meFromMembers.avatarKey)
        }
      : null;

  // 「另一半」：成员列表里 id 不等于自己的第一个人。
  const other = members.find((member) => member.id !== you?.id) ?? null;
  const partner: CoupleMember | null = other
    ? {
        id: other.id,
        name: other.displayName,
        tone: "partner",
        isMe: false,
        avatarUrl: publicUrl(other.avatarKey)
      }
    : null;

  if (!you && !partner) {
    return EMPTY;
  }

  const people = [you, partner].filter((person): person is CoupleMember => person !== null);
  const byId: Record<string, CoupleMember> = {};
  for (const person of people) {
    byId[person.id] = person;
  }

  return { you, partner, people, byId, loaded: true };
}

export function useCouple(): Couple & { reload: () => void } {
  const [couple, setCouple] = useState<Couple>(EMPTY);

  const reload = useCallback(() => {
    Promise.all([listSpaceMembers(), getCurrentAccount()])
      .then(([members, account]) =>
        setCouple(
          buildCouple(
            members,
            account
              ? {
                  id: account.id,
                  displayName: account.displayName,
                  avatarKey: account.avatarKey
                }
              : null
          )
        )
      )
      .catch(() => setCouple(EMPTY));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { ...couple, reload };
}
