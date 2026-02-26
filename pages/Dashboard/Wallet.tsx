
import React, { useEffect, useState, useCallback } from 'react';
import {
  CreditCard, Wallet, Plus, Download, ArrowDownLeft, ArrowUpRight,
  History, Lock
} from 'lucide-react';
import { azureService } from '../../services/azureService';
import { WalletTransaction } from '../../types';
import { APP_STRINGS } from '../../constants';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';
import { toastService } from '../../services/toastService';

const WalletPage: React.FC = () => {
  const [balance, setBalance] = useState(0);
  const [pendingBalance] = useState(450); // Mock blocked/escrow funds
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);
  const [showTopUpInput, setShowTopUpInput] = useState(false);
  const [topUpInputValue, setTopUpInputValue] = useState('1000');

  const fetchData = useCallback(async () => {
    try {
      const stats = await azureService.getDashboardStats();
      const txs = await azureService.getWalletTransactions();
      setBalance(stats.walletBalance);
      setTransactions(txs);
    } catch {
      // API unavailable - keep default empty state
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const initiateTopUp = () => {
      const amount = parseInt(topUpInputValue);
      if (isNaN(amount) || amount <= 0) {
          toastService.error('مبلغ نامعتبر است. لطفاً یک عدد مثبت وارد کنید.');
          return;
      }
      setTopUpAmount(amount);
      setShowTopUpInput(false);
      setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
      await azureService.topUpWallet(topUpAmount, "شارژ کیف پول (درگاه بانکی)");
      await fetchData();
      setShowPaymentModal(false);
  };

  const handleWithdraw = () => {
      if (balance < 500) {
          toastService.warning('حداقل مبلغ برداشت ۵۰۰ افغانی است.');
          return;
      }
      toastService.success('درخواست تسویه حساب ثبت شد. تا ۲۴ ساعت آینده به حساب بانکی شما واریز می‌شود.');
  };

  const filteredTxs = activeTab === 'ALL' ? transactions : transactions.filter(t => t.type.includes(activeTab));

  return (
    <div className="space-y-6">
      {showPaymentModal && (
          <PaymentGatewayModal 
              amount={topUpAmount} 
              onSuccess={handlePaymentSuccess} 
              onCancel={() => setShowPaymentModal(false)} 
          />
      )}

      <h2 className="text-2xl font-bold text-ui-text">کیف پول و مالی</h2>

      {/* Cards Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-brand-900 to-brand-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute top-0 left-0 w-32 h-32 bg-ui-surface/5 rounded-full -translate-x-10 -translate-y-10 blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-ui-surface/10 rounded-full translate-x-10 translate-y-10 blur-3xl"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-brand-100 text-sm font-medium mb-1 flex items-center gap-1"><CreditCard className="w-4 h-4"/> موجودی در دسترس</p>
                        <h2 className="text-4xl font-bold tracking-tight">{balance.toLocaleString()} <span className="text-xl font-normal opacity-80">{APP_STRINGS.currency}</span></h2>
                    </div>
                    <div className="bg-ui-surface/20 p-2 rounded-lg backdrop-blur-sm">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex gap-3 mt-6">
                {!showTopUpInput ? (
                    <button 
                        onClick={() => setShowTopUpInput(true)}
                        className="flex-1 bg-ui-surface text-brand-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors shadow-sm"
                    >
                        <Plus className="w-5 h-5 text-brand-900" />
                        افزایش موجودی
                    </button>
                ) : (
                    <div className="flex-1 flex gap-2">
                        <input
                            type="number"
                            value={topUpInputValue}
                            onChange={(e) => setTopUpInputValue(e.target.value)}
                            placeholder="مبلغ (افغانی)"
                            dir="ltr"
                            className="flex-1 px-3 py-2 bg-ui-surface text-brand-900 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-white/50 min-w-0"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' && initiateTopUp()}
                        />
                        <button onClick={initiateTopUp} className="px-3 py-2 bg-brand-600 text-white rounded-xl text-sm font-bold hover:bg-brand-700 transition-colors">
                            <Plus className="w-4 h-4" />
                        </button>
                        <button onClick={() => setShowTopUpInput(false)} className="px-3 py-2 bg-ui-surface/20 text-white rounded-xl text-sm font-bold hover:bg-ui-surface/30 transition-colors">
                            ✕
                        </button>
                    </div>
                )}
                <button 
                    onClick={handleWithdraw}
                    className="flex-1 bg-brand-800/50 backdrop-blur-md text-white py-3 rounded-xl font-bold border border-white/20 hover:bg-brand-800/70 transition-colors flex items-center justify-center gap-2"
                >
                    <Download className="w-5 h-5 text-white" />
                    برداشت وجه
                </button>
            </div>
          </div>

          {/* Pending/Escrow Balance Card (Important for trust) */}
          <div className="bg-ui-surface border border-ui-border rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[220px]">
              <div>
                 <div className="flex items-center gap-2 text-ui-muted mb-2">
                     <Lock className="w-5 h-5" />
                     <span className="text-sm font-bold">موجودی بلوکه شده (معاملات امن)</span>
                 </div>
                 <h2 className="text-3xl font-bold text-ui-text">{pendingBalance.toLocaleString()} <span className="text-lg font-normal text-ui-muted">{APP_STRINGS.currency}</span></h2>
                 <p className="text-xs text-ui-muted mt-2 leading-relaxed">
                     این مبلغ مربوط به معاملاتی است که هنوز توسط خریدار تایید نهایی نشده‌اند. پس از تایید، به موجودی قابل برداشت اضافه می‌شود.
                 </p>
              </div>
              <div className="mt-4 pt-4 border-t border-ui-border">
                  <button className="text-brand-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      مشاهده جزئیات معاملات امن <ArrowDownLeft className="w-4 h-4 rotate-180" />
                  </button>
              </div>
          </div>
      </div>

      {/* Transactions List */}
      <div className="bg-ui-surface rounded-2xl shadow-sm border border-ui-border overflow-hidden">
        <div className="p-4 border-b border-ui-border flex items-center justify-between">
           <h3 className="font-bold text-ui-text flex items-center gap-2">
               <History className="w-5 h-5 text-ui-muted" />
               تاریخچه تراکنش‌ها
           </h3>
           <div className="flex gap-1 bg-ui-surface2 p-1 rounded-lg">
               {['ALL', 'DEPOSIT', 'WITHDRAWAL'].map(tab => (
                   <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === tab ? 'bg-ui-surface shadow text-ui-text' : 'text-ui-muted hover:text-ui-muted'}`}
                   >
                       {tab === 'ALL' ? 'همه' : tab === 'DEPOSIT' ? 'واریز' : 'برداشت'}
                   </button>
               ))}
           </div>
        </div>
        <div>
           {filteredTxs.length === 0 ? (
               <div className="p-12 text-center text-ui-muted flex flex-col items-center">
                   <div className="w-12 h-12 bg-ui-surface2 rounded-full flex items-center justify-center mb-3">
                       <History className="w-6 h-6 opacity-50" />
                   </div>
                   <span className="text-sm">هیچ تراکنشی یافت نشد.</span>
               </div>
           ) : (
             filteredTxs.map((tx) => (
               <div key={tx.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none hover:bg-ui-surface2 transition-colors group">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'DEPOSIT' ? 'bg-green-50 text-green-600' : tx.type.includes('PROMO') ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                        {tx.type === 'DEPOSIT' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                     </div>
                     <div>
                        <p className="font-bold text-ui-text text-sm mb-0.5">{tx.description}</p>
                        <p className="text-xs text-ui-muted flex items-center gap-1">
                            {tx.date}
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span className={`font-medium ${tx.status === 'SUCCESS' ? 'text-green-500' : 'text-yellow-500'}`}>
                                {tx.status === 'SUCCESS' ? 'موفق' : 'در حال پردازش'}
                            </span>
                        </p>
                     </div>
                  </div>
                  <div className={`font-bold dir-ltr text-lg ${tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-ui-text'}`}>
                     {tx.type === 'DEPOSIT' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}
                  </div>
               </div>
             ))
           )}
        </div>
        <div className="p-3 bg-ui-surface2 text-center">
            <button className="text-xs text-ui-muted font-bold hover:text-brand-600 transition-colors">مشاهده همه تراکنش‌ها</button>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
