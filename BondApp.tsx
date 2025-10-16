// BondApp.tsx
// 債券申購贖回的主組件（仿照 App.tsx 結構）

import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { 
  BOND_CONTRACT_ADDRESSES, 
  BOND_ERC20_ABI, 
  BOND_PRICE_ORACLE_ABI, 
  BOND_SUBSCRIPTION_ABI,
  COUPON_PAYMENT_ABI,
  BOND_SEPOLIA_CHAIN_ID 
} from './bondConstants';
import { type BondBalances, type BondStatusMessage, BondTab } from './bondTypes';
import CouponSection from './CouponSection';

// 格式化錢包地址
const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// 格式化 BigInt
const formatBigInt = (value: bigint, decimals: number, displayDecimals: number = 4): string => {
  if (typeof value !== 'bigint' || typeof decimals !== 'number') return '0.00';
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  if (fractionalPart === 0n) return integerPart.toString();
  
  const fractionalString = fractionalPart.toString().padStart(decimals, '0');
  return `${integerPart}.${fractionalString.slice(0, displayDecimals)}`;
};

// 狀態橫幅組件
const StatusBanner: React.FC<{ status: BondStatusMessage | null; onClose: () => void }> = ({ status, onClose }) => {
  if (!status) return null;

  const colorClasses = {
    loading: 'bg-blue-500/20 text-blue-300 border-blue-500',
    success: 'bg-green-500/20 text-green-300 border-green-500',
    error: 'bg-red-500/20 text-red-300 border-red-500',
    info: 'bg-gray-500/20 text-gray-300 border-gray-500',
  };

  const Icon = ({ type }: { type: BondStatusMessage['type'] }) => {
      switch(type) {
        case 'loading': return <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-300"></div>;
        case 'success': return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>;
        case 'error': return <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>;
        default: return null;
      }
    };
  
    return (
      <div className={`fixed top-5 right-5 w-full max-w-sm p-4 rounded-lg shadow-xl border ${colorClasses[status.type]} flex items-start space-x-4 z-50`}>
        <div className="flex-shrink-0 pt-1">
          <Icon type={status.type} />
        </div>
        <div className="flex-grow">
          <p className="font-semibold">{status.type.toUpperCase()}</p>
          <p className="text-sm">{status.message}</p>
          {status.txHash && (
            <a href={`${'https://sepolia.etherscan.io'}/tx/${status.txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm mt-1 inline-block text-blue-400 hover:text-blue-300 underline">
              View on Etherscan
            </a>
          )}
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
      </div>
    );
  };

// 主組件
const BondApp: React.FC = () => {
  // === 自動管理 web3/account/chainId，取代原本 props ===
  const [web3, setWeb3] = useState<Web3 | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [chainId, setChainId] = useState<number | null>(null);
  const [balances, setBalances] = useState<BondBalances>({ usdt: '0', aapl50: '0' });
  const [price, setPrice] = useState<string>('0.00');
  const [activeTab, setActiveTab] = useState<BondTab>(BondTab.Subscribe);
  const [subscribeAmount, setSubscribeAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [status, setStatus] = useState<BondStatusMessage | null>(null);
  const [isPriceLoading, setIsPriceLoading] = useState(false);


  const isConnected = account && web3;
  const isWrongNetwork = isConnected && chainId !== BOND_SEPOLIA_CHAIN_ID;

  useEffect(() => {
    if (window.ethereum) {
      const web3Instance = new Web3(window.ethereum as any);
      setWeb3(web3Instance);

      // 請求帳號連線
      window.ethereum.request({ method: 'eth_requestAccounts' })
        .then((accounts: string[]) => setAccount(accounts[0]))
        .catch(console.error);

      // 取得 chainId
      window.ethereum.request({ method: 'eth_chainId' })
        .then((id: string) => setChainId(parseInt(id, 16)))
        .catch(console.error);

      // 監聽 network 變化
      window.ethereum.on('chainChanged', (id: string) => {
        setChainId(parseInt(id, 16));
      });

      // 監聽帳號變化
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        setAccount(accounts[0] || null);
      });
    } else {
      console.error('MetaMask not installed');
    }
  }, []);

  // 獲取餘額和價格
  const fetchData = useCallback(async () => {
    if (!web3 || !account) return;

    try {
      // 獲取 USDt 餘額
      const usdtContract = new web3.eth.Contract(BOND_ERC20_ABI, BOND_CONTRACT_ADDRESSES.usdt);
      const usdtBalanceRaw = await usdtContract.methods.balanceOf(account).call();
      const usdtDecimals = await usdtContract.methods.decimals().call();
      
      // 獲取 AAPL50 餘額
      const bondContract = new web3.eth.Contract(BOND_ERC20_ABI, BOND_CONTRACT_ADDRESSES.bondToken);
      const bondBalanceRaw = await bondContract.methods.balanceOf(account).call();
      const bondDecimals = await bondContract.methods.decimals().call();
      
      setBalances({
        usdt: formatBigInt(BigInt(usdtBalanceRaw as string), Number(usdtDecimals)),
        aapl50: formatBigInt(BigInt(bondBalanceRaw as string), Number(bondDecimals)),
      });

      // 獲取債券價格
      const priceOracleContract = new web3.eth.Contract(BOND_PRICE_ORACLE_ABI, BOND_CONTRACT_ADDRESSES.priceOracle);
      const latestPriceRaw = await priceOracleContract.methods.getLatestPriceUSD().call();
      setPrice(latestPriceRaw);

    } catch (error) {
      console.error('Failed to fetch data:', error);
    }
  }, [web3, account]);

  // 自動刷新數據
  useEffect(() => {
    if (isConnected && !isWrongNetwork) {
      fetchData();
    }
  }, [isConnected, isWrongNetwork, fetchData, account]);

  // 更新價格（手動）
  const handleUpdatePrice = async () => {
    if (!web3 || !account) return;
    setStatus({ type: 'loading', message: 'Requesting price update...' });
    try {
        const priceOracleContract = new web3.eth.Contract(
            BOND_PRICE_ORACLE_ABI,
            BOND_CONTRACT_ADDRESSES.priceOracle
        );
        // 1️⃣ 送出更新交易
        const tx = await priceOracleContract.methods.requestPriceUpdate().send({ from: account });
        setStatus({ type: 'loading', message: 'Price update requested! Waiting for oracle...', txHash: tx.transactionHash });
        // 2️⃣ 輪詢讀取最新價格，最多等待 10 秒
        const startTime = Date.now();
        let latestPrice = await priceOracleContract.methods.getLatestPriceUSD().call();
        while (Date.now() - startTime < 10000) { // 10 秒 timeout
            await new Promise(resolve => setTimeout(resolve, 1000)); // 每秒讀一次
            latestPrice = await priceOracleContract.methods.getLatestPriceUSD().call();
            if (latestPrice) break; // 讀到價格就跳出
        }

        // 3️⃣ 更新 UI
        setPrice(latestPrice);
        setStatus({ type: 'success', message: 'Price updated!', txHash: tx.transactionHash });

    } catch (error: any) {
        setStatus({ type: 'error', message: error.message || 'Failed to update price.' });
    }
  };



  // 授權代幣
  const handleApprove = async (token: 'usdt' | 'aapl50') => {
    if (!web3 || !account) return;
    
    const isSubscribing = token === 'usdt';
    const amount = isSubscribing ? subscribeAmount : redeemAmount;
    
    if (!amount || parseFloat(amount) <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    setStatus({ type: 'loading', message: `Approving ${token.toUpperCase()}...` });

    try {
      const tokenAddress = isSubscribing ? BOND_CONTRACT_ADDRESSES.usdt : BOND_CONTRACT_ADDRESSES.bondToken;
      const decimals = isSubscribing ? 2 : 0; // USDt=2, AAPL50=0
      const tokenContract = new web3.eth.Contract(BOND_ERC20_ABI, tokenAddress);
      
      const amountInWei = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));
      const tx = await tokenContract.methods.approve(BOND_CONTRACT_ADDRESSES.subscription, amountInWei.toString()).send({ from: account });
      
      setStatus({ type: 'success', message: `${token.toUpperCase()} approved!`, txHash: tx.transactionHash });
    } catch (error: any) {
      setStatus({ type: 'error', message: error.message || `Failed to approve ${token.toUpperCase()}.` });
    }
  };

  // 申購債券（核心邏輯）
  const handleSubscribe = async () => {
    if (!web3 || !account || !subscribeAmount || parseFloat(subscribeAmount) <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    try {
      // === 步驟 1: 更新價格 ===
      setStatus({ type: 'loading', message: '1/4: Updating bond price...' });
      await handleUpdatePrice();

      // === 步驟 2: 檢查是否首次購買 ===
      const bondTokenContract = new web3.eth.Contract(BOND_ERC20_ABI, BOND_CONTRACT_ADDRESSES.bondToken);
      const currentBalance = await bondTokenContract.methods.balanceOf(account).call();
      const isFirstTimeBuyer = BigInt(currentBalance) === 0n;
      
      console.log('Current AAPL50 balance:', currentBalance);
      console.log('Is first time buyer:', isFirstTimeBuyer);

      // === 步驟 3: 已持有債券 → 檢查並領取 Coupon ===
      if (!isFirstTimeBuyer) {
        const couponContract = new web3.eth.Contract(COUPON_PAYMENT_ABI, BOND_CONTRACT_ADDRESSES.couponPayment);
        const canClaim = await couponContract.methods.canClaim(account).call();
        
        if (canClaim) {
          setStatus({ type: 'loading', message: '2/4: Claiming available coupon...' });
          try {
            const claimTx = await couponContract.methods.claimCoupon().send({ from: account });
            console.log('Coupon auto-claimed:', claimTx.transactionHash);
            setStatus({ type: 'success', message: 'Coupon claimed! Proceeding...', txHash: claimTx.transactionHash });
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (claimError) {
            console.error('Auto-claim failed:', claimError);
          }
        }
      }

      // === 步驟 4: 執行申購 ===
      setStatus({ type: 'loading', message: '3/4: Processing subscription...' });
      
      const subscriptionContract = new web3.eth.Contract(BOND_SUBSCRIPTION_ABI, BOND_CONTRACT_ADDRESSES.subscription);
      const usdtContract = new web3.eth.Contract(BOND_ERC20_ABI, BOND_CONTRACT_ADDRESSES.usdt);
      
      const usdtDecimals = await usdtContract.methods.decimals().call();
      const amountInCents = BigInt(Math.floor(parseFloat(subscribeAmount) * (10 ** Number(usdtDecimals))));
      
      // 檢查餘額和授權
      const userBalance = await usdtContract.methods.balanceOf(account).call();
      if (BigInt(userBalance) < amountInCents) {
        setStatus({ type: 'error', message: 'Insufficient USDt balance.' });
        return;
      }
      
      const allowance = await usdtContract.methods.allowance(account, BOND_CONTRACT_ADDRESSES.subscription).call();
      if (BigInt(allowance) < amountInCents) {
        setStatus({ type: 'error', message: 'Insufficient allowance. Please approve first.' });
        return;
      }
      
      const subscribeTx = await subscriptionContract.methods.subscribe(amountInCents.toString()).send({ from: account });
      console.log('Subscription successful:', subscribeTx.transactionHash);

      // === 步驟 5: 首次購買 → 初始化 Coupon ===
      if (isFirstTimeBuyer) {
        setStatus({ type: 'loading', message: '4/4: Initializing coupon schedule...' });
        try {
          const couponContract = new web3.eth.Contract(COUPON_PAYMENT_ABI, BOND_CONTRACT_ADDRESSES.couponPayment);
          const initTx = await couponContract.methods.initializeClaim(account).send({ from: account });
          console.log('Coupon initialized:', initTx.transactionHash);
          setStatus({ type: 'success', message: 'Subscription successful! Coupon schedule set.', txHash: subscribeTx.transactionHash });
        } catch (initError) {
          console.error('Coupon init failed:', initError);
          setStatus({ type: 'success', message: 'Subscription successful! (Coupon init pending)', txHash: subscribeTx.transactionHash });
        }
      } else {
        setStatus({ type: 'success', message: 'Subscription successful!', txHash: subscribeTx.transactionHash });
      }

      setSubscribeAmount('');
      await fetchData();

    } catch (error: any) {
      console.error('Subscription error:', error);
      setStatus({ type: 'error', message: error.message || 'Subscription failed.' });
    }
  };

  // 贖回債券
  const handleRedeem = async () => {
    if (!web3 || !account || !redeemAmount || parseFloat(redeemAmount) <= 0) {
      setStatus({ type: 'error', message: 'Please enter a valid amount.' });
      return;
    }

    try {
      // 步驟 1: 更新價格
      setStatus({ type: 'loading', message: '1/3: Updating price...' });
      await handleUpdatePrice();

      // 步驟 2: 執行贖回
      setStatus({ type: 'loading', message: '2/3: Processing redemption...' });
      
      const subscriptionContract = new web3.eth.Contract(BOND_SUBSCRIPTION_ABI, BOND_CONTRACT_ADDRESSES.subscription);
      const bondContract = new web3.eth.Contract(BOND_ERC20_ABI, BOND_CONTRACT_ADDRESSES.bondToken);
      
      const bondDecimals = await bondContract.methods.decimals().call();
      const amountInWei = BigInt(Math.floor(parseFloat(redeemAmount) * (10 ** Number(bondDecimals))));
      
      // 檢查餘額和授權
      const userBalance = await bondContract.methods.balanceOf(account).call();
      if (BigInt(userBalance) < amountInWei) {
        setStatus({ type: 'error', message: 'Insufficient AAPL50 balance.' });
        return;
      }
      
      const allowance = await bondContract.methods.allowance(account, BOND_CONTRACT_ADDRESSES.subscription).call();
      if (BigInt(allowance) < amountInWei) {
        setStatus({ type: 'error', message: 'Insufficient allowance. Please approve first.' });
        return;
      }
      
      const tx = await subscriptionContract.methods.redeem(amountInWei.toString()).send({ from: account });
      setStatus({ type: 'success', message: '3/3: Redemption successful!', txHash: tx.transactionHash });
      
      setRedeemAmount('');
      await fetchData();

    } catch (error: any) {
      console.error('Redemption error:', error);
      setStatus({ type: 'error', message: error.message || 'Redemption failed.' });
    }
  };

  // 預估計算
  const estimatedBonds = subscribeAmount && parseFloat(price) > 0 
    ? (parseFloat(subscribeAmount) / (parseFloat(price) / 1e6)).toFixed(2) 
    : '0.00';
    
  const estimatedUsdt = redeemAmount && parseFloat(price) > 0 
    ? (parseFloat(redeemAmount) * parseFloat(price) / 1e6).toFixed(2) 
    : '0.00';

  if (!isConnected) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center h-96">
        <p className="text-slate-400">Please connect your wallet to continue.</p>
      </div>
    );
  }

  if (isWrongNetwork) {
    return (
      <div className="p-10 flex flex-col items-center justify-center text-center h-96 text-red-400">
        <p className="font-bold text-lg">Wrong Network</p>
        <p>Please switch to Sepolia testnet.</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-mono antialiased">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_800px_at_70%_200px,#07376322,transparent)]"></div>
        <StatusBanner status={status} onClose={() => setStatus(null)} />
        
        <main className="w-full max-w-5xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl shadow-blue-500/10 z-10">
            <header className="p-6 border-b border-slate-700 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-slate-100">Buy AAPL50</h1>
                <div className="absolute left-1/2 transform -translate-x-1/2 text-slate-300">
                    Apple, 2.4% 20AUG2050 Corp (USD) (AA+)
                </div>
                <div className="bg-slate-700/50 text-sm font-semibold text-slate-300 px-4 py-2 rounded-lg border border-slate-600">
                               {formatAddress(account)}
                </div>
            </header>
        
            <div className="p-6">
                {/* 餘額區（全寬） */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">USDt Balance</p>
                <p className="text-2xl font-bold">{balances.usdt}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <p className="text-sm text-slate-400">AAPL50 Balance</p>
                <p className="text-2xl font-bold">{balances.aapl50}</p>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start">
                <div>
                    <p className="text-sm text-slate-400">Bond Price</p>
                    <p className="text-2xl font-bold">
                        {isPriceLoading ? <span>Updating...</span> : `$${ (Number(price) / 1e6).toLocaleString() }`}
                    </p>
                </div>
                <button onClick={handleUpdatePrice} title="Update Price" className="text-slate-400 hover:text-white transition">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                    </svg>
                </button>
                </div>
            </div>
            </div>

            {/* 主要操作區（左右分欄） */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 左側：申購/贖回（2/3 寬度） */}
            <div className="lg:col-span-2">
                <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
                {/* Tab 切換 */}
                <div className="flex border-b border-slate-700 mb-6">
                    <button 
                    onClick={() => setActiveTab(BondTab.Subscribe)} 
                    className={`py-2 px-4 text-lg font-semibold transition ${activeTab === BondTab.Subscribe ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
                    >
                    Subscribe
                    </button>
                    <button 
                    onClick={() => setActiveTab(BondTab.Redeem)} 
                    className={`py-2 px-4 text-lg font-semibold transition ${activeTab === BondTab.Redeem ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}
                    >
                    Redeem
                    </button>
                </div>

                {/* 申購表單 */}
                {activeTab === BondTab.Subscribe && (
                    <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Amount to pay (USDt)</label>
                        <input 
                        type="number" 
                        value={subscribeAmount} 
                        onChange={e => setSubscribeAmount(e.target.value)} 
                        placeholder="0.0" 
                        className="w-full bg-slate-700/50 p-3 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                    </div>
                    <p className="text-sm text-slate-400">You will receive approx: <span className="font-bold text-white">{estimatedBonds} AAPL50</span></p>
                    <div className="flex space-x-4">
                        <button onClick={() => handleApprove('usdt')} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition">
                        Approve USDt
                        </button>
                        <button onClick={handleSubscribe} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition">
                        Subscribe
                        </button>
                    </div>
                    </div>
                )}

                {/* 贖回表單 */}
                {activeTab === BondTab.Redeem && (
                    <div className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1">Amount to redeem (AAPL50)</label>
                        <input 
                        type="number" 
                        value={redeemAmount} 
                        onChange={e => setRedeemAmount(e.target.value)} 
                        placeholder="0.0" 
                        className="w-full bg-slate-700/50 p-3 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" 
                        />
                    </div>
                    <p className="text-sm text-slate-400">You will receive approx: <span className="font-bold text-white">${estimatedUsdt} USDt</span></p>
                    <div className="flex space-x-4">
                        <button onClick={() => handleApprove('aapl50')} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition">
                        Approve AAPL50
                        </button>
                        <button onClick={handleRedeem} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition">
                        Redeem
                        </button>
                    </div>
                    </div>
                )}
                
                </div>                
            </div>   
            {/* 右側：Coupon Management（1/3 寬度） */}
                <div className="lg:col-span-1">
                    <CouponSection 
                        web3={web3} 
                        account={account} 
                        bondBalance={balances.aapl50}
                        onStatusChange={setStatus}
                    />
                </div>
            </div>            
        </div>
    </main>
    </div>
  );
};

export default BondApp;