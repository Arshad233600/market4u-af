import React, { ErrorInfo, ReactNode } from 'react';
import Icon from '../src/components/ui/Icon';
import { errorLogger } from '../utils/errorLogger';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCode: string | null;
}

class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorCode: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    const errorCode = errorLogger.log({
      message: error.message,
      stack: error.stack,
      type: 'error',
    });
    return { hasError: true, error, errorCode };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 text-center p-4 font-sans" dir="rtl">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-red-100">
            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                <Icon name="AlertTriangle" size={40} strokeWidth={1.8} />
            </div>
            <h1 className="text-xl font-bold text-gray-900 mb-2">مشکلی پیش آمده است</h1>
            <p className="text-gray-500 mb-2 text-sm leading-relaxed">
              متاسفانه برنامه با یک خطای غیرمنتظره مواجه شد. تیم فنی ما به صورت خودکار مطلع شدند.
            </p>
            
            {this.state.errorCode && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-6">
                <p className="text-xs text-gray-500 mb-1">کد خطا:</p>
                <code className="text-sm font-mono text-gray-800 font-bold">{this.state.errorCode}</code>
              </div>
            )}
            
            <div className="flex flex-col gap-3">
                <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-brand-700 transition-colors shadow-lg shadow-brand-200"
                >
                <Icon name="RefreshCw" size={20} strokeWidth={1.8} />
                تلاش مجدد
                </button>
                <button
                onClick={() => {
                    localStorage.clear();
                    window.location.href = '/';
                }}
                className="text-gray-400 text-xs hover:text-red-500 transition-colors mt-2"
                >
                پاک کردن حافظه و شروع دوباره
                </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;