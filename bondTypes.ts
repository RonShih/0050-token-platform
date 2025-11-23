// bondTypes.ts
// 債券相關的 TypeScript 類型定義（與 0050t 的 types.ts 分開）

// 債券餘額資訊
export interface BondBalances {
  usdt: string;      // USDt 餘額
  aapl50: string;    // AAPL50 債券餘額
}

// Coupon 領息資訊
export interface CouponInfo {
  nextClaimTime: number;      // 下次領息時間（UNIX timestamp）
  couponAmount: string;       // 可領金額（格式化後的字串）
  canClaim: boolean;          // 是否可以領取
  timeRemaining: string;      // 剩餘時間（人類可讀格式）
}

// 狀態訊息（與 0050t 共用相同結構）
export interface BondStatusMessage {
  type: 'loading' | 'success' | 'error' | 'info';
  message: string;
  txHash?: string;
}

// Tab 選項（申購/贖回）
export enum BondTab {
  Subscribe = 'subscribe',
  Redeem = 'redeem',
}