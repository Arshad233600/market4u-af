
import React, { useState, useEffect } from 'react';
import Icon from '../src/components/ui/Icon';

interface PaymentGatewayModalProps {
  amount: number;
  onSuccess: () => void;
  onCancel: () => void;
}

const PaymentGatewayModal: React.FC<PaymentGatewayModalProps> = ({ amount, onSuccess, onCancel }) => {
  const [step, setStep] = useState<'FORM' | 'PROCESSING' | 'SUCCESS'>('FORM');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');

  // Auto-advance to success
  useEffect(() => {
      if (step === 'PROCESSING') {
          const timer = setTimeout(() => {
              setStep('SUCCESS');
          }, 3000);
          return () => clearTimeout(timer);
      }
      if (step === 'SUCCESS') {
          const timer = setTimeout(() => {
              onSuccess();
          }, 2000);
          return () => clearTimeout(timer);
      }
  }, [step, onSuccess]);

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if(phone.length < 9 || pin.length < 4) {
          alert("لطفاً اطلاعات معتبر وارد کنید.");
          return;
      }
      setStep('PROCESSING');
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl relative">
        
        {/* Close Button */}
        {step === 'FORM' && (
            <button onClick={onCancel} className="absolute top-4 left-4 text-gray-400 hover:text-gray-600 z-10">
                <Icon name="X" size={24} strokeWidth={1.8} />
            </button>
        )}

        {/* Header */}
        <div className="bg-[#059669] text-white p-6 text-center">
            <div className="flex justify-center mb-2">
                <Icon name="ShieldCheck" size={40} strokeWidth={1.8} className="opacity-90" />
            </div>
            <h3 className="font-bold text-lg">درگاه پرداخت امن</h3>
            <p className="text-emerald-100 text-sm mt-1">اتصال به شبکه بانکی افغانستان</p>
        </div>

        {/* Content */}
        <div className="p-6">
            
            {step === 'FORM' && (
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="text-center mb-6">
                        <span className="text-sm text-gray-500">مبلغ قابل پرداخت</span>
                        <div className="text-3xl font-bold text-gray-900 mt-1">{amount.toLocaleString()} <span className="text-lg text-gray-400">؋</span></div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">شماره موبایل (حساب کاربری)</label>
                            <div className="relative">
                                <input 
                                    type="tel" 
                                    value={phone}
                                    onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="0799000000"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-left dir-ltr font-mono text-lg tracking-widest"
                                    maxLength={10}
                                    autoFocus
                                />
                                <Icon name="CreditCard" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 mb-1.5">پین کد (PIN)</label>
                            <div className="relative">
                                <input 
                                    type="password" 
                                    value={pin}
                                    onChange={e => setPin(e.target.value.replace(/[^0-9]/g, ''))}
                                    placeholder="••••"
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-center font-mono text-lg tracking-[0.5em]"
                                    maxLength={6}
                                />
                                <Icon name="Lock" size={20} strokeWidth={1.8} className="absolute right-3 top-3.5 text-gray-400" />
                            </div>
                        </div>
                    </div>

                    <button className="w-full bg-[#059669] hover:bg-[#047857] text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-2">
                        <Icon name="Lock" size={18} strokeWidth={1.8} />
                        پرداخت امن
                    </button>
                    
                    <div className="flex justify-center gap-2 mt-4 opacity-50 grayscale">
                        {/* Fake Bank Logos */}
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                        <div className="h-6 w-10 bg-gray-200 rounded"></div>
                    </div>
                </form>
            )}

            {step === 'PROCESSING' && (
                <div className="py-10 text-center">
                    <div className="relative w-20 h-20 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-gray-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-emerald-500 rounded-full border-t-transparent animate-spin"></div>
                    </div>
                    <h3 className="font-bold text-gray-800 text-lg mb-2">در حال پردازش...</h3>
                    <p className="text-gray-500 text-sm">لطفاً صفحه را نبندید.</p>
                </div>
            )}

            {step === 'SUCCESS' && (
                <div className="py-10 text-center animate-in zoom-in duration-300">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                        <Icon name="CheckCircle" size={40} strokeWidth={1.8} />
                    </div>
                    <h3 className="font-bold text-green-700 text-xl mb-2">تراکنش موفق</h3>
                    <p className="text-gray-500 text-sm">مبلغ به کیف پول شما اضافه شد.</p>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default PaymentGatewayModal;
