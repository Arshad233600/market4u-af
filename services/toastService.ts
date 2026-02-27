
import { ToastMessage, ToastType } from '../types';

type ToastListener = (toasts: ToastMessage[]) => void;

/** Cooldown period (ms) between auth-error toasts to prevent iOS Safari spam. */
const AUTH_TOAST_COOLDOWN_MS = 60_000;

class ToastService {
  private toasts: ToastMessage[] = [];
  private listeners: ToastListener[] = [];
  /** Timestamp of the last auth-error toast; 0 means none shown yet. */
  private lastAuthToastAt = 0;

  subscribe(listener: ToastListener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    this.listeners.forEach(l => l([...this.toasts]));
  }

  add(type: ToastType, message: string, duration = 3000, requestId?: string) {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: ToastMessage = { id, type, message, requestId };
    this.toasts.push(toast);
    this.notify();

    setTimeout(() => {
      this.remove(id);
    }, duration);
  }

  remove(id: string) {
    this.toasts = this.toasts.filter(t => t.id !== id);
    this.notify();
  }
  
  success(msg: string) { this.add('success', msg); }
  error(msg: string) { this.add('error', msg); }
  /** Show an error toast with a full requestId UUID and a "Copy ID" button. */
  errorWithId(msg: string, requestId: string) { this.add('error', msg, 7000, requestId); }
  info(msg: string) { this.add('info', msg); }
  warning(msg: string) { this.add('warning', msg); }

  /**
   * Show an auth-error warning toast with a 60-second cooldown.
   * Prevents repeated toasts on iOS Safari when polling calls repeatedly 401.
   */
  authWarning(msg: string): void {
    const now = Date.now();
    if (now - this.lastAuthToastAt < AUTH_TOAST_COOLDOWN_MS) return;
    this.lastAuthToastAt = now;
    this.add('warning', msg);
  }
}

export const toastService = new ToastService();
