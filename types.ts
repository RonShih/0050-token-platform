
export interface Balances {
  usdt: string;
  t0050: string;
}

export type StatusType = 'info' | 'success' | 'error' | 'loading';

export interface StatusMessage {
  type: StatusType;
  message: string;
  txHash?: string;
}

export enum Tab {
  Subscribe = 'subscribe',
  Redeem = 'redeem',
}
