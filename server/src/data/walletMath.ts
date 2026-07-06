/**
 * XP 钱包余额计算。服务端权威：客户端只提交交易，余额由服务端根据交易类型累加，
 * 保证情侣两人跨设备看到的是同一份一致的钱包。
 *
 * balance 恒等于所有交易 amount 之和；lifetime_earned / lifetime_spent 分别累计
 * 正向获得与支出，便于展示「累计获得 / 累计消费」。
 */

export type WalletTxType = "earn" | "spend" | "refund" | "adjust";

export type WalletDelta = {
  /** 余额增量（直接加到 balance，可正可负） */
  balance: number;
  /** 累计获得增量 */
  earned: number;
  /** 累计消费增量 */
  spent: number;
};

/**
 * 单条交易对钱包三项的影响。与旧客户端 xpRepository.walletDeltas 保持完全一致，
 * 迁移后行为不变。
 */
export function walletDelta(type: WalletTxType, amount: number): WalletDelta {
  switch (type) {
    case "earn":
      return { balance: amount, earned: amount, spent: 0 };
    case "spend":
      return { balance: amount, earned: 0, spent: Math.abs(amount) };
    case "refund":
      return { balance: amount, earned: 0, spent: -Math.abs(amount) };
    case "adjust":
      return { balance: amount, earned: Math.max(amount, 0), spent: Math.max(-amount, 0) };
    default:
      return { balance: 0, earned: 0, spent: 0 };
  }
}

export type WalletState = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
};

/** 把一批交易增量叠加到当前钱包状态上。 */
export function applyDeltas(state: WalletState, deltas: WalletDelta[]): WalletState {
  return deltas.reduce<WalletState>(
    (acc, delta) => ({
      balance: acc.balance + delta.balance,
      lifetimeEarned: acc.lifetimeEarned + delta.earned,
      lifetimeSpent: acc.lifetimeSpent + delta.spent
    }),
    state
  );
}
