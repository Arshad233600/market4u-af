
import React, { useEffect, useState } from 'react';
import Icon from '../../src/components/ui/Icon';
import { azureService } from '../../services/azureService';
import { WalletTransaction } from '../../types';
import { APP_STRINGS } from '../../constants';
import PaymentGatewayModal from '../../components/PaymentGatewayModal';

const WalletPage: React.FC = () => {
  const [balance, setBalance] = useState(0);
  const [pendingBalance] = useState(450); // Mock blocked/escrow funds
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [activeTab, setActiveTab] = useState<'ALL' | 'DEPOSIT' | 'WITHDRAWAL'>('ALL');
  
  // Payment Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState(0);

  const fetchData = useCallback(async () => {
    const stats = await azureService.getDashboardStats();
    const txs = await azureService.getWalletTransactions();
    setBalance(stats.walletBalance);
    setTransactions(txs);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData();
  }, [fetchData]);

  const initiateTopUp = () => {
      const amountStr = window.prompt("مبلغ افزایش موجودی را وارد کنید (افغانی):", "1000");
      if (!amountStr) return;

      const amount = parseInt(amountStr);
      if (isNaN(amount) || amount <= 0) {
          alert("مبلغ نامعتبر است.");
          return;
      }
      
      setTopUpAmount(amount);
      setShowPaymentModal(true);
  };

  const handlePaymentSuccess = async () => {
      await azureService.topUpWallet(topUpAmount, "شارژ کیف پول (درگاه بانکی)");
      await fetchData();
      setShowPaymentModal(false);
  };

  const handleWithdraw = () => {
      if (balance < 500) {
          alert("حداقل مبلغ برداشت ۵۰۰ افغانی است.");
          return;
      }
      alert("درخواست تسویه حساب ثبت شد و تا ۲۴ ساعت آینده به حساب بانکی شما واریز می‌شود.");
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

      <h2 className="text-2xl font-bold text-gray-800">کیف پول و مالی</h2>

      {/* Cards Container */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Main Balance Card */}
          <div className="bg-gradient-to-br from-brand-900 to-brand-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden flex flex-col justify-between min-h-[220px]">
            <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full -translate-x-10 -translate-y-10 blur-2xl"></div>
            <div className="absolute bottom-0 right-0 w-40 h-40 bg-white/10 rounded-full translate-x-10 translate-y-10 blur-3xl"></div>
            
            <div className="relative z-10">
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-brand-100 text-sm font-medium mb-1 flex items-center gap-1"><CreditCard className="w-4 h-4"/> موجودی در دسترس</p>
                        <h2 className="text-4xl font-bold tracking-tight">{balance.toLocaleString()} <span className="text-xl font-normal opacity-80">{APP_STRINGS.currency}</span></h2>
                    </div>
                    <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                        <Wallet className="w-6 h-6 text-white" />
                    </div>
                </div>
            </div>

            <div className="relative z-10 flex gap-3 mt-6">
                <button 
                    onClick={initiateTopUp}
                    className="flex-1 bg-white text-brand-900 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-brand-50 transition-colors shadow-sm"
                >
                    <Plus className="w-5 h-5 text-brand-900" />
                    افزایش موجودی
                </button>
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
          <div className="bg-white border border-gray-200 rounded-2xl p-6 flex flex-col justify-between shadow-sm min-h-[220px]">
              <div>
                 <div className="flex items-center gap-2 text-gray-500 mb-2">
                     <Lock className="w-5 h-5" />
                     <span className="text-sm font-bold">موجودی بلوکه شده (معاملات امن)</span>
                 </div>
                 <h2 className="text-3xl font-bold text-gray-800">{pendingBalance.toLocaleString()} <span className="text-lg font-normal text-gray-400">{APP_STRINGS.currency}</span></h2>
                 <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                     این مبلغ مربوط به معاملاتی است که هنوز توسط خریدار تایید نهایی نشده‌اند. پس از تایید، به موجودی قابل برداشت اضافه می‌شود.
                 </p>
              </div>
              <div className="mt-4 pt-4 border-t border-gray-100">
                  <button className="text-brand-600 text-sm font-bold flex items-center gap-1 hover:underline">
                      مشاهده جزئیات معاملات امن <ArrowDownLeft className="w-4 h-4 rotate-180" />
                  </button>
              </div>
          </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
           <h3 className="font-bold text-gray-800 flex items-center gap-2">
               <History className="w-5 h-5 text-gray-500" />
               تاریخچه تراکنش‌ها
           </h3>
           <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
               {['ALL', 'DEPOSIT', 'WITHDRAWAL'].map(tab => (
                   <button 
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${activeTab === tab ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
                   >
                       {tab === 'ALL' ? 'همه' : tab === 'DEPOSIT' ? 'واریز' : 'برداشت'}
                   </button>
               ))}
           </div>
        </div>
        <div>
           {filteredTxs.length === 0 ? (
               <div className="p-12 text-center text-gray-400 flex flex-col items-center">
                   <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                       <History className="w-6 h-6 opacity-50" />
                   </div>
                   <span className="text-sm">هیچ تراکنشی یافت نشد.</span>
               </div>
           ) : (
             filteredTxs.map((tx) => (
               <div key={tx.id} className="flex items-center justify-between p-4 border-b border-gray-50 last:border-none hover:bg-gray-50 transition-colors group">
                  <div className="flex items-center gap-4">
                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${tx.type === 'DEPOSIT' ? 'bg-green-50 text-green-600' : tx.type.includes('PROMO') ? 'bg-orange-50 text-orange-600' : 'bg-red-50 text-red-600'}`}>
                        {tx.type === 'DEPOSIT' ? <ArrowDownLeft className="w-6 h-6" /> : <ArrowUpRight className="w-6 h-6" />}
                     </div>
                     <div>
                        <p className="font-bold text-gray-800 text-sm mb-0.5">{tx.description}</p>
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                            {tx.date}
                            <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                            <span className={`font-medium ${tx.status === 'SUCCESS' ? 'text-green-500' : 'text-yellow-500'}`}>
                                {tx.status === 'SUCCESS' ? 'موفق' : 'در حال پردازش'}
                            </span>
                        </p>
                     </div>
                  </div>
                  <div className={`font-bold dir-ltr text-lg ${tx.type === 'DEPOSIT' ? 'text-green-600' : 'text-gray-800'}`}>
                     {tx.type === 'DEPOSIT' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}
                  </div>
               </div>
             ))
           )}
        </div>
        <div className="p-3 bg-gray-50 text-center">
            <button className="text-xs text-gray-500 font-bold hover:text-brand-600 transition-colors">مشاهده همه تراکنش‌ها</button>
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
