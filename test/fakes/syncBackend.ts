import { randomUUID } from "node:crypto";
import { applyDeltas, walletDelta, type WalletTxType } from "../../server/src/data/walletMath";

/**
 * 内存版同步后端，供仓储层单元测试使用。
 *
 * 设计原则（见对话决策 A）：fake 要「笨」，只做数据的忠实搬运，不复刻 SQL 层的智能判断。
 * 两个刻意的例外：
 *  1. XP 余额不自己算，直接复用服务端权威的 walletMath，保证与线上同一份逻辑，不会分叉。
 *  2. 复刻 check_ins 的 UNIQUE(habit_id, date) 约束，好让「按 id upsert 会漏掉当天已有记录」
 *     这类客户端逻辑错误在测试里暴露，而不是被 fake 悄悄掩盖。
 *
 * 它测不到真实 SQL 的 ON CONFLICT / WHERE space_id 越权 / 事务回滚 / PG 类型强转，
 * 这些只能靠真服务端 + 真 Postgres 联调覆盖。
 */

type Row = Record<string, unknown>;

/** 与服务端 dataRoutes.RESOURCES 的键一致。 */
const RESOURCES = [
  "habits",
  "check_ins",
  "habit_plans",
  "rewards",
  "reward_redemptions",
  "xp_transactions"
] as const;
type ResourceName = (typeof RESOURCES)[number];

type WalletState = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
};

class SyncBackend {
  private tables: Record<ResourceName, Map<string, Row>> = {
    habits: new Map(),
    check_ins: new Map(),
    habit_plans: new Map(),
    rewards: new Map(),
    reward_redemptions: new Map(),
    xp_transactions: new Map()
  };
  private settings: Record<string, Map<string, string>> = {
    app: new Map(),
    admin: new Map()
  };
  private wallet: WalletState = {
    balance: 0,
    lifetimeEarned: 0,
    lifetimeSpent: 0,
    updatedAt: new Date().toISOString()
  };
  /** 已见过的 xp 交易 uniqueKey，用于幂等。 */
  private seenTxKeys = new Set<string>();
  /** 当前空间成员（情侣双方），供 space-members 接口返回。 */
  private members: Array<{ id: string; displayName: string; role: string; avatarKey?: string | null }> = [];

  reset(): void {
    for (const name of RESOURCES) {
      this.tables[name].clear();
    }
    this.settings.app.clear();
    this.settings.admin.clear();
    this.wallet = { balance: 0, lifetimeEarned: 0, lifetimeSpent: 0, updatedAt: new Date().toISOString() };
    this.seenTxKeys.clear();
    this.members = [];
  }

  /** 测试辅助：设置空间成员，供双人 UI 相关测试使用。 */
  setMembers(members: Array<{ id: string; displayName: string; role: string; avatarKey?: string | null }>): void {
    this.members = members.map((member) => ({ ...member }));
  }

  private listResource(resource: ResourceName): Row[] {
    // 服务端按 id ASC 返回；这里保持插入序即可，仓储层自己会再排序。
    return [...this.tables[resource].values()].map((row) => ({ ...row }));
  }

  private upsertResource(resource: ResourceName, id: string, fields: Row): Row {
    // 复刻 check_ins 的 UNIQUE(habit_id, date)：若已存在同 (habit_id,date) 但不同 id 的记录，
    // 视为约束冲突（真实服务端会因 upsert 用 id 冲突键而无法命中，导致重复插入报错）。
    if (resource === "check_ins") {
      for (const [existingId, row] of this.tables.check_ins) {
        if (existingId !== id && row.habitId === fields.habitId && row.date === fields.date) {
          throw new Error("check_ins 唯一约束冲突：同一习惯同一天已存在记录");
        }
      }
    }
    const stored: Row = { id, ...fields };
    this.tables[resource].set(id, stored);
    return { ...stored };
  }

  private deleteResource(resource: ResourceName, id: string): void {
    this.tables[resource].delete(id);
  }

  private getWallet(): WalletState {
    return { ...this.wallet };
  }

  private postTransactions(transactions: Row[]): { inserted: Row[]; wallet: WalletState } {
    const inserted: Row[] = [];
    const deltas = [];

    for (const input of transactions) {
      const uniqueKey = String(input.uniqueKey);
      if (this.seenTxKeys.has(uniqueKey)) {
        continue; // 幂等：已存在的不重复计入
      }
      this.seenTxKeys.add(uniqueKey);

      const id = randomUUID();
      const type = input.type as WalletTxType;
      const amount = Math.trunc(Number(input.amount));
      const row: Row = {
        id,
        uniqueKey,
        amount,
        type,
        reason: input.reason,
        habitId: input.habitId ?? null,
        checkInId: input.checkInId ?? null,
        rewardId: input.rewardId ?? null,
        redemptionId: input.redemptionId ?? null,
        dateKey: input.dateKey ?? null,
        createdAt: new Date().toISOString()
      };
      this.tables.xp_transactions.set(id, row);
      inserted.push({ ...row });
      deltas.push(walletDelta(type, amount));
    }

    if (inserted.length > 0) {
      const next = applyDeltas(
        {
          balance: this.wallet.balance,
          lifetimeEarned: this.wallet.lifetimeEarned,
          lifetimeSpent: this.wallet.lifetimeSpent
        },
        deltas
      );
      this.wallet = { ...next, updatedAt: new Date().toISOString() };
    }

    return { inserted, wallet: this.getWallet() };
  }

  private getSettings(scope: string): Record<string, string> {
    const map = this.settings[scope];
    if (!map) {
      throw new Error(`未知的设置类型：${scope}`);
    }
    return Object.fromEntries(map);
  }

  private putSettings(scope: string, entries: Record<string, string>): void {
    const map = this.settings[scope];
    if (!map) {
      throw new Error(`未知的设置类型：${scope}`);
    }
    for (const [key, value] of Object.entries(entries)) {
      map.set(key, value);
    }
  }

  /**
   * 复现 apiClient.apiRequest 的行为：按 method + path 分发到内存操作，返回与服务端一致的形状。
   */
  handle(path: string, method: string, body: unknown): unknown {
    // /api/data/:resource(/:id)
    const dataMatch = /^\/api\/data\/([^/]+)(?:\/(.+))?$/.exec(path);
    if (dataMatch) {
      const resource = dataMatch[1] as ResourceName;
      const id = dataMatch[2];
      if (!RESOURCES.includes(resource)) {
        throw new Error(`未知的数据类型：${resource}`);
      }
      if (method === "GET") {
        return this.listResource(resource);
      }
      if (method === "PUT") {
        return this.upsertResource(resource, id!, body as Row);
      }
      if (method === "DELETE") {
        this.deleteResource(resource, id!);
        return undefined;
      }
    }

    if (path === "/api/wallet" && method === "GET") {
      return this.getWallet();
    }
    if (path === "/api/wallet/transactions" && method === "POST") {
      const { transactions } = body as { transactions: Row[] };
      return this.postTransactions(transactions);
    }

    if (path === "/api/auth/space-members" && method === "GET") {
      return {
        members: this.members.map((member) => ({
          avatarKey: null,
          ...member
        }))
      };
    }

    if (path === "/api/auth/me/avatar" && method === "PUT") {
      // 只做忠实搬运：把第一个成员的头像 key 更新为客户端提交的 key（测试只关心「能存能读」）。
      const input = (body ?? {}) as { avatarKey?: string | null };
      if (this.members.length > 0) {
        this.members[0] = {
          ...this.members[0],
          avatarKey: input.avatarKey ?? null
        };
      }
      return { ok: true };
    }

    const settingsMatch = /^\/api\/settings\/([^/]+)$/.exec(path);
    if (settingsMatch) {
      const scope = settingsMatch[1];
      if (method === "GET") {
        return { entries: this.getSettings(scope) };
      }
      if (method === "PUT") {
        this.putSettings(scope, (body as { entries: Record<string, string> }).entries);
        return undefined;
      }
    }

    throw new Error(`fake 未实现的请求：${method} ${path}`);
  }
}

/** 全局单例，测试间用 resetSyncBackend() 清空。 */
export const syncBackend = new SyncBackend();

export function resetSyncBackend(): void {
  syncBackend.reset();
}

/** 测试辅助：设置当前空间成员，供 space-members 接口返回。 */
export function setSyncMembers(members: Array<{ id: string; displayName: string; role: string; avatarKey?: string | null }>): void {
  syncBackend.setMembers(members);
}
