
export const SEPOLIA_CHAIN_ID = 11155111; // Sepolia
export const SEPOLIA_EXPLORER_URL = 'https://sepolia.etherscan.io';

export const CONTRACT_ADDRESSES = {
  priceOracle: '0x003A7c9BEf91215bfAFE7546f629617F52F102Ef',
  t0050: '0x5c9f4917a48339Dfb6dCD36515afA0A8125fdf97',
  usdt: '0xD140196414b96d159a663323d20DC334208cec25',
  subscription: '0xd6950Fe01aAb41EBc1f0B2ec708A603D42631f8f',
};

export const ERC20_ABI = [
  {"constant":true,"inputs":[{"name":"_owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"balance","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
  {"constant":false,"inputs":[{"name":"_spender","type":"address"},{"name":"_value","type":"uint256"}],"name":"approve","outputs":[{"name":"success","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
  {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},
  {"constant":true,"inputs":[{"name":"_owner","type":"address"},{"name":"_spender","type":"address"}],"name":"allowance","outputs":[{"name":"remaining","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}
];

export const PRICE_ORACLE_ABI = [
  {"inputs":[],"name":"getLatestPriceUSD","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"requestPriceUpdate","outputs":[{"internalType":"bytes32","name":"requestId","type":"bytes32"}],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"_newPriceUSD","type":"uint256"}],"name":"updatePriceManual","outputs":[],"stateMutability":"nonpayable","type":"function"}
];

export const SUBSCRIPTION_ABI = [
  {"inputs":[{"internalType":"uint256","name":"usdtAmount","type":"uint256"}],"name":"subscribe","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"t0050Amount","type":"uint256"}],"name":"redeem","outputs":[],"stateMutability":"nonpayable","type":"function"},
  {"inputs":[],"name":"issuer","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"address","name":"user","type":"address"}],"name":"getUserBalances","outputs":[{"internalType":"uint256","name":"usdtBalance","type":"uint256"},{"internalType":"uint256","name":"shares0050t","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[],"name":"getIssuerBalances","outputs":[{"internalType":"uint256","name":"usdtBalance","type":"uint256"},{"internalType":"uint256","name":"shares0050t","type":"uint256"}],"stateMutability":"view","type":"function"},
  {"inputs":[{"internalType":"uint256","name":"usdtAmountCents","type":"uint256"}],"name":"previewSubscription","outputs":[{"internalType":"uint256","name":"sharesToReceive","type":"uint256"},{"internalType":"uint256","name":"actualUsdtNeeded","type":"uint256"},{"internalType":"uint256","name":"price0050Cents","type":"uint256"}],"stateMutability":"view","type":"function"}
];
