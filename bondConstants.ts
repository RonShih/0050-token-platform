// bondConstants.ts
// 債券相關的合約地址和 ABI（與 0050t 分開管理）

export const BOND_SEPOLIA_CHAIN_ID = 11155111; // 與 0050t 共用同一個測試網
export const BOND_SEPOLIA_EXPLORER_URL = 'https://sepolia.etherscan.io';

// 債券合約地址
export const BOND_CONTRACT_ADDRESSES = {
  priceOracle: '0x8F46cD4bd16cF2b375ea8149e79baf172fC787BF',    // 債券價格預言機
  bondToken: '0x890BE391d1fB165306788E46C52176451A8D82eB',      // AAPL50 代幣合約
  usdt: '0xD140196414b96d159a663323d20DC334208cec25',          // USDt（與 0050t 共用）
  subscription: '0xA16d0Bf35215082b25b5893a3689D16ED8a07295',   // 申購贖回合約
  couponPayment: '0x0773Ac07B137D9608cf01A0Db5cb83BDc5b95e9B',  // 派息合約
};

// ERC20 標準 ABI（與 0050t 共用相同介面）
export const BOND_ERC20_ABI = [
  {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
  {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},
  {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}
];

// 債券價格預言機 ABI
export const BOND_PRICE_ORACLE_ABI = [
  {
    "inputs": [],
    "name": "getLatestPriceUSD",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "requestPriceUpdate",
    "outputs": [{"internalType": "bytes32", "name": "requestId", "type": "bytes32"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"internalType": "uint256", "name": "_newPriceUSD", "type": "uint256"},
      {"internalType": "uint256", "name": "_riskFreeRateBps", "type": "uint256"},
      {"internalType": "uint256", "name": "_creditSpreadBps", "type": "uint256"}
    ],
    "name": "updatePriceManual",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

// 申購贖回合約 ABI
export const BOND_SUBSCRIPTION_ABI = [
  {
    "inputs": [{"internalType": "uint256", "name": "usdtAmountCents", "type": "uint256"}],
    "name": "subscribe",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "bondtToRedeem", "type": "uint256"}],
    "name": "redeem",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "issuer",
    "outputs": [{"internalType": "address", "name": "", "type": "address"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getUserBalances",
    "outputs": [
      {"internalType": "uint256", "name": "usdtBalance", "type": "uint256"},
      {"internalType": "uint256", "name": "bondtBalance", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "uint256", "name": "usdtAmountCents", "type": "uint256"}],
    "name": "previewSubscription",
    "outputs": [
      {"internalType": "uint256", "name": "bondtToReceive", "type": "uint256"},
      {"internalType": "uint256", "name": "actualUsdtNeeded", "type": "uint256"},
      {"internalType": "uint256", "name": "tokenPriceCents", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

// Coupon 派息合約 ABI
export const COUPON_PAYMENT_ABI = [
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "initializeClaim",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "canClaim",
    "outputs": [{"internalType": "bool", "name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "calculateCoupon",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "claimCoupon",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"internalType": "address", "name": "user", "type": "address"}],
    "name": "getNextClaimTime",
    "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];