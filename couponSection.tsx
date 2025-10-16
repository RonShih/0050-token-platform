// CouponSection.tsx
// 獨立的 Coupon 領息管理組件

import React, { useState, useEffect } from 'react';
import Web3 from 'web3';
import { BOND_CONTRACT_ADDRESSES, COUPON_PAYMENT_ABI, BOND_ERC20_ABI } from './bondConstants';
import type { BondStatusMessage } from './bondTypes';

interface CouponSectionProps {
  web3: Web3;
  account: string;
  bondBalance: string;  // AAPL50 餘額（用於判斷是否持有債券）
  onStatusChange: (status: BondStatusMessage) => void;  // 狀態回報給父組件
}

// 格式化 BigInt 為顯示用字串
const formatBigInt = (value: bigint, decimals: number, displayDecimals: number = 2): string => {
  if (typeof value !== 'bigint') return '0.00';
  const divisor = 10n ** BigInt(decimals);
  const integerPart = value / divisor;
  const fractionalPart = value % divisor;
  
  if (fractionalPart === 0n) return integerPart.toString() + '.00';
  
  const fractionalString = fractionalPart.toString().padStart(decimals, '0');
  return `${integerPart}.${fractionalString.slice(0, displayDecimals)}`;
};

const CouponSection: React.FC<CouponSectionProps> = ({ web3, account, bondBalance, onStatusChange }) => {
  // 狀態管理
  const [nextClaimTime, setNextClaimTime] = useState<number>(0);
  const [couponAmount, setCouponAmount] = useState<string>('0.00');
  const [canClaim, setCanClaim] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<string>('');
  const [isInitialized, setIsInitialized] = useState<boolean>(false);

  // 檢查 Coupon 狀態
  const fetchCouponStatus = async () => {
    if (!web3 || !account) return;

    try {
      const couponContract = new web3.eth.Contract(
        COUPON_PAYMENT_ABI,
        BOND_CONTRACT_ADDRESSES.couponPayment
      );

      // 1. 獲取下次領息時間
      const nextTime = await couponContract.methods.getNextClaimTime(account).call();
      const nextTimeNum = Number(nextTime);
      setNextClaimTime(nextTimeNum);
      setIsInitialized(nextTimeNum > 0);

      // 2. 檢查是否可領取
      const claimable = await couponContract.methods.canClaim(account).call();
      setCanClaim(claimable);

      // 3. 計算可領金額（如果可領取）
      if (claimable) {
        const amount = await couponContract.methods.calculateCoupon(account).call();
        setCouponAmount(formatBigInt(BigInt(amount), 2)); // USDt 是 2 decimals
      } else {
        // 即使不能領，也顯示下次可領的金額
        const amount = await couponContract.methods.calculateCoupon(account).call();
        setCouponAmount(formatBigInt(BigInt(amount), 2));
      }

    } catch (error) {
      console.error('Failed to fetch coupon status:', error);
    }
  };

  // 倒數計時更新
  useEffect(() => {
    const updateCountdown = () => {
      if (nextClaimTime === 0) {
        setTimeRemaining('Not initialized');
        return;
      }

      const now = Math.floor(Date.now() / 1000);
      const remaining = nextClaimTime - now;

      if (remaining <= 0) {
        setTimeRemaining('Available now!');
        return;
      }

      // 計算天、時、分
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);

      setTimeRemaining(`${days}d ${hours}h ${minutes}m remaining`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000); // 每分鐘更新
    return () => clearInterval(interval);
  }, [nextClaimTime]);

  // 定期檢查狀態
  useEffect(() => {
    if (web3 && account) {
      fetchCouponStatus();
      const interval = setInterval(fetchCouponStatus, 30000); // 每30秒檢查
      return () => clearInterval(interval);
    }
  }, [web3, account, bondBalance]);

  // 領取 Coupon
  const handleClaimCoupon = async () => {
    if (!web3 || !account || !canClaim) return;

    onStatusChange({ type: 'loading', message: 'Claiming coupon...' });

    try {
      const couponContract = new web3.eth.Contract(
        COUPON_PAYMENT_ABI,
        BOND_CONTRACT_ADDRESSES.couponPayment
      );

      const tx = await couponContract.methods.claimCoupon().send({ from: account });

      onStatusChange({
        type: 'success',
        message: `Coupon claimed successfully! Received $${couponAmount}`,
        txHash: tx.transactionHash
      });

      // 刷新狀態
      setTimeout(fetchCouponStatus, 2000);

    } catch (error: any) {
      console.error('Claim coupon error:', error);
      onStatusChange({
        type: 'error',
        message: error.message || 'Failed to claim coupon.'
      });
    }
  };

  // 檢查狀態（手動刷新）
  const handleCheckStatus = async () => {
    onStatusChange({ type: 'loading', message: 'Checking coupon status...' });
    await fetchCouponStatus();
    
    let statusMsg = `Next Claim: ${nextClaimTime > 0 ? new Date(nextClaimTime * 1000).toLocaleString() : 'Not set'}\n`;
    statusMsg += `Coupon Amount: $${couponAmount}\n`;
    statusMsg += `Can Claim: ${canClaim ? 'Yes' : 'No'}\n`;
    statusMsg += `Time Remaining: ${timeRemaining}`;
    
    onStatusChange({ type: 'info', message: statusMsg });
  };

  // 如果沒有持有債券，顯示提示
  if (parseFloat(bondBalance) === 0) {
    return (
      <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700">
        <h3 className="text-xl font-bold mb-4 text-slate-400 flex items-center">
          <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
          </svg>
          Coupon Management
        </h3>
        <div className="text-center py-8">
          <p className="text-slate-400 mb-2">You need to hold AAPL50 bonds to receive coupons.</p>
          <p className="text-sm text-slate-500">Purchase bonds using the Subscribe tab to start earning.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/50 p-6 rounded-lg border border-slate-700 h-full">
      {/* 標題 */}
      <h3 className="text-xl font-bold mb-4 text-blue-400 flex items-center">
        <svg className="w-6 h-6 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/>
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/>
        </svg>
        💰 Coupon Management
      </h3>

      {/* 領息資訊 */}
      <div className="space-y-4 mb-6">
        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Next Claim Date</p>
          <p className="text-lg font-bold text-white">
            {isInitialized
              ? new Date(nextClaimTime * 1000).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })
              : 'Not initialized'
            }
          </p>
          <p className="text-xs text-slate-500 mt-1">{timeRemaining}</p>
        </div>

        <div className="bg-slate-800/50 p-4 rounded-lg">
          <p className="text-xs text-slate-400 mb-1">Coupon Amount</p>
          <p className="text-2xl font-bold text-green-400">${couponAmount}</p>
          <p className="text-xs text-slate-500 mt-1">Semi-annual interest payment</p>
        </div>
      </div>

      {/* 按鈕區 */}
      <div className="space-y-3">
        {/* Claim 按鈕 */}
        <button
          onClick={handleClaimCoupon}
          disabled={!canClaim}
          className={`w-full font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center ${
            canClaim
              ? 'bg-green-600 hover:bg-green-700 text-white shadow-lg shadow-green-500/20 cursor-pointer'
              : 'bg-slate-700/30 text-slate-600 cursor-not-allowed opacity-40 border border-slate-700'
          }`}
        >
          {canClaim ? (
            <>
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
              Claim Coupon
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
              </svg>
              Claim Locked
            </>
          )}
        </button>

        {/* Check Status 按鈕 */}
        <button
          onClick={handleCheckStatus}
          className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-3 px-4 rounded-lg transition duration-300 flex items-center justify-center"
        >
          <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
          </svg>
          Check Status
        </button>
      </div>

      {/* 提示訊息 */}
      {!canClaim && isInitialized && (
        <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
          <p className="text-xs text-yellow-400 flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <span>
              Coupon will be available on {new Date(nextClaimTime * 1000).toLocaleDateString()}. 
              You earn 2.4% annual interest paid semi-annually.
            </span>
          </p>
        </div>
      )}

      {!isInitialized && (
        <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
          <p className="text-xs text-blue-400 flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
            </svg>
            <span>
              Your coupon schedule will be initialized automatically after your first bond purchase.
            </span>
          </p>
        </div>
      )}
    </div>
  );
};

export default CouponSection;