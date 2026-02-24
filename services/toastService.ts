
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

  add(type: ToastType, message: string, duration = 3000) {
    const id = Math.random().toString(36).substr(2, 9);
    const toast: ToastMessage = { id, type, message };
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
  info(msg: string) { this.add('info', msg); }
  warning(msg: string) { this.add('warning', msg); }
}

export const toastService = new ToastService();
