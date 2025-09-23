
import React, { useState, useEffect, useCallback } from 'react';
import Web3 from 'web3';
import { CONTRACT_ADDRESSES, ERC20_ABI, PRICE_ORACLE_ABI, SUBSCRIPTION_ABI, SEPOLIA_CHAIN_ID, SEPOLIA_EXPLORER_URL } from './constants';
import type { Balances, StatusMessage } from './types';
import { Tab } from './types';

// FIX: Add a global type declaration for `window.ethereum` to inform TypeScript that it may exist on the `Window` object, resolving compilation errors.
declare global {
    interface Window {
        ethereum?: any;
    }
}

// Helper function to format wallet address
const formatAddress = (address: string) => `${address.slice(0, 6)}...${address.slice(-4)}`;

// Helper function to format BigInt values for display
const formatBigInt = (value: bigint, decimals: number, displayDecimals: number = 4): string => {
    if (typeof value !== 'bigint' || typeof decimals !== 'number') return '0.00';
    const divisor = 10n ** BigInt(decimals);
    const integerPart = value / divisor;
    const fractionalPart = value % divisor;
    
    if (fractionalPart === 0n) return integerPart.toString();
    
    const fractionalString = fractionalPart.toString().padStart(decimals, '0');
    return `${integerPart}.${fractionalString.slice(0, displayDecimals)}`;
};

// --- UI Components (defined outside App to prevent re-renders) ---

interface StatusBannerProps {
  status: StatusMessage | null;
  onClose: () => void;
}

const StatusBanner: React.FC<StatusBannerProps> = ({ status, onClose }) => {
  if (!status) return null;

  const colorClasses = {
    loading: 'bg-blue-500/20 text-blue-300 border-blue-500',
    success: 'bg-green-500/20 text-green-300 border-green-500',
    error: 'bg-red-500/20 text-red-300 border-red-500',
    info: 'bg-gray-500/20 text-gray-300 border-gray-500',
  };

  const Icon = ({ type }: { type: StatusMessage['type'] }) => {
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
          <a href={`${SEPOLIA_EXPLORER_URL}/tx/${status.txHash}`} target="_blank" rel="noopener noreferrer" className="text-sm mt-1 inline-block text-blue-400 hover:text-blue-300 underline">
            View on Etherscan
          </a>
        )}
      </div>
      <button onClick={onClose} className="text-gray-400 hover:text-white">&times;</button>
    </div>
  );
};


// --- Main App Component ---

const App: React.FC = () => {
    const [web3, setWeb3] = useState<Web3 | null>(null);
    const [account, setAccount] = useState<string | null>(null);
    const [chainId, setChainId] = useState<number | null>(null);
    const [balances, setBalances] = useState<Balances>({ usdt: '0', t0050: '0' });
    const [price, setPrice] = useState<string>('0');
    const [priceDecimals, setPriceDecimals] = useState<number>(8);
    
    const [activeTab, setActiveTab] = useState<Tab>(Tab.Subscribe);
    const [subscribeAmount, setSubscribeAmount] = useState('');
    const [redeemAmount, setRedeemAmount] = useState('');

    const [status, setStatus] = useState<StatusMessage | null>(null);

    const isConnected = account && web3;
    const isWrongNetwork = isConnected && chainId !== SEPOLIA_CHAIN_ID;

    const connectWallet = useCallback(async () => {
        // 多錢包環境檢測
        if (typeof window.ethereum !== 'undefined') {
            let provider;
            
            // 如果有多個錢包，尋找 MetaMask
            if (window.ethereum.providers?.length) {
                provider = window.ethereum.providers.find((p: any) => p.isMetaMask);
            } else if (window.ethereum.isMetaMask) {
                provider = window.ethereum;
            }
            
            if (!provider) {
                setStatus({ 
                    type: 'error', 
                    message: 'MetaMask not found. Please install MetaMask or disable other wallet extensions.' 
                });
                return;
            }
            
            try {
                const accounts = await provider.request({ method: 'eth_requestAccounts' });
                const web3Instance = new Web3(provider);
                setWeb3(web3Instance);
                setAccount(accounts[0]);
                const currentChainId = await web3Instance.eth.getChainId();
                setChainId(Number(currentChainId));
                
                console.log('Wallet connected:', accounts[0]);

            } catch (error) {
                console.error("Error connecting wallet:", error);
                setStatus({ type: 'error', message: 'Failed to connect MetaMask.' });
            }
        } else {
            setStatus({ type: 'error', message: 'MetaMask is not installed. Please install it to use this app.' });
        }
    }, []);

    const fetchData = useCallback(async () => {
        if (!web3 || !account) return;

        // Fetch Balances
        const usdtContract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.usdt);
        const t0050Contract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.t0050);
        
        const usdtBalanceRaw = await usdtContract.methods.balanceOf(account).call();
        const t0050BalanceRaw = await t0050Contract.methods.balanceOf(account).call();
        
        // 獲取實際的 decimals
        const usdtDecimals = await usdtContract.methods.decimals().call();
        const t0050Decimals = await t0050Contract.methods.decimals().call();
        
        console.log('USDT Raw Balance:', usdtBalanceRaw, 'Decimals:', usdtDecimals);
        console.log('0050t Raw Balance:', t0050BalanceRaw, 'Decimals:', t0050Decimals);
        
        setBalances({
            usdt: formatBigInt(BigInt(usdtBalanceRaw as string), Number(usdtDecimals)),
            t0050: formatBigInt(BigInt(t0050BalanceRaw as string), Number(t0050Decimals)),
        });

        // Fetch Price
        const priceOracleContract = new web3.eth.Contract(PRICE_ORACLE_ABI, CONTRACT_ADDRESSES.priceOracle);
        try {
            const latestPriceRaw = await priceOracleContract.methods.getLatestPriceUSD().call();
            console.log('Price Raw:', latestPriceRaw);
            // 價格是以 cents 為單位，需要除以 100 轉換為美元
            const priceInDollars = Number(latestPriceRaw) / 100;
            setPrice(priceInDollars.toFixed(2));
        } catch (error) {
            console.error('Failed to fetch price:', error);
            setPrice('0.00');
        }

    }, [web3, account]);

    useEffect(() => {
        // 自動檢測已連接的錢包
        const checkConnection = async () => {
            if (typeof window.ethereum !== 'undefined') {
                let provider;
                
                // 如果有多個錢包，尋找 MetaMask
                if (window.ethereum.providers?.length) {
                    provider = window.ethereum.providers.find((p: any) => p.isMetaMask);
                } else if (window.ethereum.isMetaMask) {
                    provider = window.ethereum;
                }
                
                if (provider) {
                    try {
                        const accounts = await provider.request({ method: 'eth_accounts' });
                        if (accounts.length > 0) {
                            const web3Instance = new Web3(provider);
                            setWeb3(web3Instance);
                            setAccount(accounts[0]);
                            const currentChainId = await web3Instance.eth.getChainId();
                            setChainId(Number(currentChainId));
                            
                            // 設置事件監聽器
                            provider.on('accountsChanged', (newAccounts: string[]) => {
                                console.log('Account changed to:', newAccounts[0] || 'disconnected');
                                setAccount(newAccounts[0] || null);
                                if (newAccounts[0]) {
                                    // 帳號變更後自動刷新數據
                                    setTimeout(() => {
                                        fetchData();
                                    }, 500);
                                }
                            });
                            provider.on('chainChanged', (newChainId: string) => {
                                console.log('Chain changed to:', Number(newChainId));
                                setChainId(Number(newChainId));
                            });
                        }
                    } catch (error) {
                        console.error('Failed to check wallet connection:', error);
                    }
                }
            }
        };
        
        checkConnection();
    }, []); // 只在組件掛載時執行一次

    // 當帳號或網路變更時自動刷新數據
    useEffect(() => {
        if (isConnected && !isWrongNetwork) {
            fetchData();
        }
    }, [isConnected, isWrongNetwork, fetchData, account]); // 加入 account 作為依賴

    const handleUpdatePrice = async () => {
        if (!web3 || !account) return;
        setStatus({ type: 'loading', message: 'Requesting price update...' });
        try {
            const priceOracleContract = new web3.eth.Contract(PRICE_ORACLE_ABI, CONTRACT_ADDRESSES.priceOracle);
            const tx = await priceOracleContract.methods.requestPriceUpdate().send({ from: account });
            setStatus({ type: 'success', message: 'Price update requested! Fetching new price...', txHash: tx.transactionHash });
            setTimeout(fetchData, 5000); // Give oracle time to update
        } catch (error: any) {
            setStatus({ type: 'error', message: error.message || 'Failed to update price.' });
        }
    };
    
    const handleApprove = async (token: 'usdt' | 't0050') => {
        if (!web3 || !account) return;
        
        const isSubscribing = token === 'usdt';
        const amount = isSubscribing ? subscribeAmount : redeemAmount;
        if (!amount || parseFloat(amount) <= 0) {
            setStatus({ type: 'error', message: 'Please enter a valid amount.' });
            return;
        }

        setStatus({ type: 'loading', message: `Approving ${token.toUpperCase()}...` });

        try {
            const tokenAddress = isSubscribing ? CONTRACT_ADDRESSES.usdt : CONTRACT_ADDRESSES.t0050;
            const decimals = isSubscribing ? 6 : 18;
            const tokenContract = new web3.eth.Contract(ERC20_ABI, tokenAddress);
            
            const amountInWei = BigInt(Math.floor(parseFloat(amount) * (10 ** decimals)));

            const tx = await tokenContract.methods.approve(CONTRACT_ADDRESSES.subscription, amountInWei.toString()).send({ from: account });
            setStatus({ type: 'success', message: `${token.toUpperCase()} approved successfully!`, txHash: tx.transactionHash });
        } catch (error: any) {
             setStatus({ type: 'error', message: error.message || `Failed to approve ${token.toUpperCase()}.` });
        }
    };
    
    const handleSubscribe = async () => {
        if (!web3 || !account || !subscribeAmount || parseFloat(subscribeAmount) <= 0) {
            setStatus({ type: 'error', message: 'Please enter a valid amount to subscribe.' });
            return;
        }
        
        // 檢查價格
        if (parseFloat(price) <= 0) {
            setStatus({ type: 'error', message: 'Price is not available. Please update price first.' });
            return;
        }
        
        setStatus({ type: 'loading', message: 'Processing subscription...' });

        try {
            const subscriptionContract = new web3.eth.Contract(SUBSCRIPTION_ABI, CONTRACT_ADDRESSES.subscription);
            const usdtContract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.usdt);
            
            // 獲取 USDt decimals
            const usdtDecimals = await usdtContract.methods.decimals().call();
            const amountInWei = BigInt(Math.floor(parseFloat(subscribeAmount) * (10 ** Number(usdtDecimals))));
            
            console.log('Subscribe amount:', subscribeAmount, 'USDt');
            console.log('Amount in wei:', amountInWei.toString());
            console.log('Price:', price);
            
            // 檢查用戶餘額
            const userBalance = await usdtContract.methods.balanceOf(account).call();
            console.log('User USDt balance:', userBalance);
            
            if (BigInt(userBalance) < amountInWei) {
                setStatus({ type: 'error', message: 'Insufficient USDt balance.' });
                return;
            }
            
            // 檢查授權額度
            const allowance = await usdtContract.methods.allowance(account, CONTRACT_ADDRESSES.subscription).call();
            console.log('Current allowance:', allowance);
            
            if (BigInt(allowance) < amountInWei) {
                setStatus({ type: 'error', message: 'Insufficient USDt allowance. Please approve first.' });
                return;
            }
            
            const tx = await subscriptionContract.methods.subscribe(amountInWei.toString()).send({ from: account });

            setStatus({ type: 'success', message: 'Subscription successful!', txHash: tx.transactionHash });
            setSubscribeAmount('');
            fetchData();
        } catch (error: any) {
            console.error('Subscription error:', error);
            let errorMessage = 'Subscription failed.';
            
            // 試圖解析錯誤原因
            if (error.message) {
                if (error.message.includes('revert')) {
                    errorMessage = 'Transaction reverted. Check: 1) Price > 0, 2) Sufficient balance, 3) Proper allowance, 4) Issuer has enough 0050t';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Insufficient ETH for gas fees.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            setStatus({ type: 'error', message: errorMessage });
        }
    };

    const handleRedeem = async () => {
        if (!web3 || !account || !redeemAmount || parseFloat(redeemAmount) <= 0) {
            setStatus({ type: 'error', message: 'Please enter a valid amount to redeem.' });
            return;
        }
        setStatus({ type: 'loading', message: 'Processing redemption...' });

        try {
            const subscriptionContract = new web3.eth.Contract(SUBSCRIPTION_ABI, CONTRACT_ADDRESSES.subscription);
            const t0050Contract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.t0050);
            
            // 獲取 0050t decimals
            const t0050Decimals = await t0050Contract.methods.decimals().call();
            const amountInWei = BigInt(Math.floor(parseFloat(redeemAmount) * (10 ** Number(t0050Decimals))));
            
            console.log('Redeem amount:', redeemAmount, '0050t');
            console.log('0050t decimals:', t0050Decimals);
            console.log('Amount in wei:', amountInWei.toString());
            console.log('Price:', price);
            
            // 檢查用戶餘額
            const userBalance = await t0050Contract.methods.balanceOf(account).call();
            console.log('User 0050t balance:', userBalance);
            
            if (BigInt(userBalance) < amountInWei) {
                setStatus({ type: 'error', message: 'Insufficient 0050t balance.' });
                return;
            }
            
            // 檢查授權額度
            const allowance = await t0050Contract.methods.allowance(account, CONTRACT_ADDRESSES.subscription).call();
            console.log('Current 0050t allowance:', allowance);
            
            if (BigInt(allowance) < amountInWei) {
                setStatus({ type: 'error', message: 'Insufficient 0050t allowance. Please approve first.' });
                return;
            }
            
            const tx = await subscriptionContract.methods.redeem(amountInWei.toString()).send({ from: account });
            
            setStatus({ type: 'success', message: 'Redemption successful!', txHash: tx.transactionHash });
            setRedeemAmount('');
            fetchData();
        } catch (error: any) {
            console.error('Redemption error:', error);
            let errorMessage = 'Redemption failed.';
            
            if (error.message) {
                if (error.message.includes('revert')) {
                    errorMessage = 'Transaction reverted. Check: 1) Sufficient 0050t balance, 2) Proper allowance, 3) Issuer has enough USDt';
                } else if (error.message.includes('insufficient funds')) {
                    errorMessage = 'Insufficient ETH for gas fees.';
                } else {
                    errorMessage = error.message;
                }
            }
            
            setStatus({ type: 'error', message: errorMessage });
        }
    };

    const checkSystemStatus = async () => {
        if (!web3 || !account) {
            setStatus({ type: 'error', message: 'Please connect wallet first.' });
            return;
        }
        
        setStatus({ type: 'loading', message: 'Checking system status...' });
        
        try {
            const usdtContract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.usdt);
            const t0050Contract = new web3.eth.Contract(ERC20_ABI, CONTRACT_ADDRESSES.t0050);
            const priceOracleContract = new web3.eth.Contract(PRICE_ORACLE_ABI, CONTRACT_ADDRESSES.priceOracle);
            const subscriptionContract = new web3.eth.Contract(SUBSCRIPTION_ABI, CONTRACT_ADDRESSES.subscription);
            
            console.log('=== SYSTEM STATUS ===');
            
            // 檢查價格
            const currentPrice = await priceOracleContract.methods.getLatestPriceUSD().call();
            console.log('Price from oracle:', currentPrice, 'cents');
            
            // 獲取發行方地址
            let issuerAddress;
            try {
                issuerAddress = await subscriptionContract.methods.issuer().call();
                console.log('Issuer address:', issuerAddress);
            } catch (error) {
                console.log('Could not get issuer address:', error);
                issuerAddress = null;
            }
            
            // 檢查用戶餘額和授權
            const userUsdtBalance = await usdtContract.methods.balanceOf(account).call();
            const user0050Balance = await t0050Contract.methods.balanceOf(account).call();
            const usdtAllowance = await usdtContract.methods.allowance(account, CONTRACT_ADDRESSES.subscription).call();
            const t0050Allowance = await t0050Contract.methods.allowance(account, CONTRACT_ADDRESSES.subscription).call();
            
            console.log('User USDt balance:', userUsdtBalance);
            console.log('User 0050t balance:', user0050Balance);
            console.log('USDt allowance:', usdtAllowance);
            console.log('0050t allowance:', t0050Allowance);
            
            // 檢查發行方狀態
            let issuerStatus = '';
            if (issuerAddress) {
                try {
                    const issuerUsdtBalance = await usdtContract.methods.balanceOf(issuerAddress).call();
                    const issuer0050Balance = await t0050Contract.methods.balanceOf(issuerAddress).call();
                    const issuerUsdtAllowance = await usdtContract.methods.allowance(issuerAddress, CONTRACT_ADDRESSES.subscription).call();
                    const issuer0050Allowance = await t0050Contract.methods.allowance(issuerAddress, CONTRACT_ADDRESSES.subscription).call();
                    
                    console.log('=== ISSUER STATUS ===');
                    console.log('Issuer USDt balance:', issuerUsdtBalance);
                    console.log('Issuer 0050t balance:', issuer0050Balance);
                    console.log('Issuer USDt allowance:', issuerUsdtAllowance);
                    console.log('Issuer 0050t allowance:', issuer0050Allowance);
                    
                    issuerStatus = `\nISSUER STATUS:\n`;
                    issuerStatus += `Issuer Address: ${issuerAddress}\n`;
                    issuerStatus += `Issuer USDt: ${issuerUsdtBalance}\n`;
                    issuerStatus += `Issuer 0050t: ${issuer0050Balance}\n`;
                    issuerStatus += `Issuer USDt Allowance: ${issuerUsdtAllowance}\n`;
                    issuerStatus += `Issuer 0050t Allowance: ${issuer0050Allowance}\n`;
                    
                    // 檢查問題
                    const issues = [];
                    if (BigInt(issuer0050Balance) === 0n) issues.push('Issuer has no 0050t tokens');
                    if (BigInt(issuer0050Allowance) === 0n) issues.push('Issuer has not approved 0050t');
                    if (Number(currentPrice) <= 0) issues.push('Price is 0 or negative');
                    
                    if (issues.length > 0) {
                        issuerStatus += `\nISSUES FOUND:\n${issues.join('\n')}`;
                    }
                    
                } catch (error) {
                    console.error('Error checking issuer status:', error);
                    issuerStatus = `\nCould not check issuer status: ${error}`;
                }
            }
            
            // 預覽申購
            let previewInfo = '';
            if (subscribeAmount && parseFloat(subscribeAmount) > 0) {
                try {
                    const usdtDecimals = await usdtContract.methods.decimals().call();
                    const amountInCents = BigInt(Math.floor(parseFloat(subscribeAmount) * (10 ** Number(usdtDecimals))));
                    
                    // 試着使用 previewSubscription
                    try {
                        const preview = await subscriptionContract.methods.previewSubscription(amountInCents.toString()).call();
                        previewInfo = `\nSUBSCRIPTION PREVIEW:\n`;
                        previewInfo += `Input: ${subscribeAmount} USDt\n`;
                        previewInfo += `Shares to receive: ${preview.sharesToReceive}\n`;
                        previewInfo += `Actual USDt needed: ${preview.actualUsdtNeeded}\n`;
                        previewInfo += `Price: ${preview.price0050Cents} cents\n`;
                    } catch (error) {
                        console.log('Preview function not available:', error);
                    }
                } catch (error) {
                    console.log('Could not calculate preview:', error);
                }
            }
            
            let statusMessage = 'SYSTEM STATUS:\n';
            statusMessage += `Price: ${Number(currentPrice) / 100} USD\n`;
            statusMessage += `Your USDt: ${userUsdtBalance}\n`;
            statusMessage += `Your 0050t: ${user0050Balance}\n`;
            statusMessage += `USDt Allowance: ${usdtAllowance}\n`;
            statusMessage += issuerStatus;
            statusMessage += previewInfo;
            
            setStatus({ type: 'info', message: statusMessage });
            
        } catch (error: any) {
            console.error('Status check error:', error);
            setStatus({ type: 'error', message: 'Failed to check system status: ' + (error.message || 'Unknown error') });
        }
    };

    const disconnectWallet = () => {
        setWeb3(null);
        setAccount(null);
        setChainId(null);
        setBalances({ usdt: '0', t0050: '0' });
        setPrice('0.00');
        setStatus({ type: 'info', message: 'Wallet disconnected. You can now connect a different account.' });
        console.log('Wallet disconnected');
    };

    const switchToSepolia = async () => {
        if (!window.ethereum) return;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia Chain ID in hex
            });
        } catch (switchError: any) {
            // This error code indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: '0xaa36a7',
                            chainName: 'Sepolia Test Network',
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18,
                            },
                            rpcUrls: ['https://rpc.sepolia.org'],
                            blockExplorerUrls: ['https://sepolia.etherscan.io'],
                        }],
                    });
                } catch (addError) {
                    setStatus({ type: 'error', message: 'Failed to add Sepolia network' });
                }
            } else {
                setStatus({ type: 'error', message: 'Failed to switch to Sepolia network' });
            }
        }
    };

    const estimatedT0050 = subscribeAmount && parseFloat(price) > 0 ? (parseFloat(subscribeAmount) / parseFloat(price)).toFixed(4) : '0.00';
    const estimatedUsdt = redeemAmount && parseFloat(price) > 0 ? (parseFloat(redeemAmount) * parseFloat(price)).toFixed(2) : '0.00';


    return (
        <div className="bg-slate-900 text-white min-h-screen flex flex-col items-center justify-center p-4 font-mono antialiased">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_800px_at_70%_200px,#07376322,transparent)]"></div>
            
            <StatusBanner status={status} onClose={() => setStatus(null)} />
            
            <main className="w-full max-w-2xl bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl shadow-2xl shadow-blue-500/10 z-10">
                <header className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <h1 className="text-2xl font-bold text-slate-100">Buy 0050t</h1>
                    {!isConnected ? (
                        <button onClick={connectWallet} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-300 flex items-center space-x-2">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M17.778 8.222c-4.296-4.296-11.26-4.296-15.556 0A1 1 0 002 9.636v4.728a1 1 0 001 1h4.728a1 1 0 00.707-1.707L6.707 12H4V9.636a9.001 9.001 0 0112.728 0L15 11.364v2.929h-2.707l-1.728 1.728a1 1 0 00.707 1.707H16a1 1 0 001-1v-4.728a1 1 0 00-.222-1.414zM10 12a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" /></svg>
                            <span>Connect Wallet</span>
                        </button>
                    ) : (
                        <div className="flex items-center space-x-3">
                            <div className="bg-slate-700/50 text-sm font-semibold text-slate-300 px-4 py-2 rounded-lg border border-slate-600">
                               {formatAddress(account)}
                            </div>
                        </div>
                    )}
                </header>
                
                {!isConnected ? (
                    <div className="p-10 flex flex-col items-center justify-center text-center h-96">
                        <p className="text-slate-400">Please connect your wallet to continue.</p>
                    </div>
                ) : isWrongNetwork ? (
                    <div className="p-10 flex flex-col items-center justify-center text-center h-96 text-red-400">
                        <p className="font-bold text-lg">Wrong Network</p>
                        <p>Please switch to the Sepolia test network in your wallet.</p>
                        <div className="mt-4 p-4 bg-slate-800 rounded-lg text-sm">
                            <p><strong>Current Chain ID:</strong> {chainId}</p>
                            <p><strong>Expected Chain ID:</strong> {SEPOLIA_CHAIN_ID}</p>
                            <p><strong>Current Network:</strong> {chainId === 1 ? 'Ethereum Mainnet' : chainId === 5 ? 'Goerli' : chainId === 11155111 ? 'Sepolia' : 'Unknown'}</p>
                        </div>
                        <button 
                            onClick={switchToSepolia}
                            className="mt-4 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition"
                        >
                            Switch to Sepolia Network
                        </button>
                    </div>
                ) : (
                    <div className="p-6">
                        {/* Balances & Price */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <p className="text-sm text-slate-400">USDt Balance</p>
                                <p className="text-2xl font-bold">{balances.usdt}</p>
                            </div>
                             <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <p className="text-sm text-slate-400">0050t Balance</p>
                                <p className="text-2xl font-bold">{balances.t0050}</p>
                            </div>
                             <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-sm text-slate-400">0050t Price</p>
                                        <p className="text-2xl font-bold">${price}</p>
                                    </div>
                                    <button onClick={handleUpdatePrice} title="Update Price" className="text-slate-400 hover:text-white transition">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" /></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div>
                            <div className="flex border-b border-slate-700 mb-6">
                                <button onClick={() => setActiveTab(Tab.Subscribe)} className={`py-2 px-4 text-lg font-semibold transition ${activeTab === Tab.Subscribe ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>Subscribe</button>
                                <button onClick={() => setActiveTab(Tab.Redeem)} className={`py-2 px-4 text-lg font-semibold transition ${activeTab === Tab.Redeem ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-400'}`}>Redeem</button>
                            </div>

                            {activeTab === Tab.Subscribe && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Amount to pay (USDt)</label>
                                        <input type="number" value={subscribeAmount} onChange={e => setSubscribeAmount(e.target.value)} placeholder="0.0" className="w-full bg-slate-700/50 p-3 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <p className="text-sm text-slate-400">You will receive approx: <span className="font-bold text-white">{estimatedT0050} 0050t</span></p>
                                    <div className="flex space-x-4">
                                        <button onClick={() => handleApprove('usdt')} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition">Approve USDt</button>
                                        <button onClick={handleSubscribe} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition">Subscribe</button>
                                    </div>
                                    <button onClick={checkSystemStatus} className="w-full mt-2 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded-lg transition text-sm">
                                        Debug: Check System Status
                                    </button>
                                </div>
                            )}

                            {activeTab === Tab.Redeem && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-slate-400 mb-1">Amount to redeem (0050t)</label>
                                        <input type="number" value={redeemAmount} onChange={e => setRedeemAmount(e.target.value)} placeholder="0.0" className="w-full bg-slate-700/50 p-3 rounded-lg border border-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500" />
                                    </div>
                                    <p className="text-sm text-slate-400">You will receive approx: <span className="font-bold text-white">${estimatedUsdt} USDt</span></p>
                                    <div className="flex space-x-4">
                                        <button onClick={() => handleApprove('t0050')} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition">Approve 0050t</button>
                                        <button onClick={handleRedeem} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition">Redeem</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default App;
