
import { ToastMessage, ToastType } from '../types';

type ToastListener = (toasts: ToastMessage[]) => void;

class ToastService {
  private toasts: ToastMessage[] = [];
  private listeners: ToastListener[] = [];

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
}

export const toastService = new ToastService();
