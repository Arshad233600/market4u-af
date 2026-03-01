
import { authService } from './authService';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';
import { ChatMessage } from '../types';
import { safeStorage } from '../utils/safeStorage';

type MessageHandler = (message: ChatMessage) => void;

/** Polling interval for new messages (Azure SWA does not support WebSocket). */
const POLL_INTERVAL_MS = 15_000;

interface InboxSnapshot {
  lastMessageTime: string;
}

class RealtimeService {
  private messageHandlers: MessageHandler[] = [];
  private isConnected = false;
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private mockEventListener: ((e: Event) => void) | null = null;
  /** Tracks the last seen message time per conversation to detect new messages. */
  private inboxSnapshot = new Map<string, InboxSnapshot>();
  /** True after the first successful poll (used to skip notifications on init). */
  private initialized = false;

  constructor() {
    this.connect();
    // Stop polling when the user logs out or the session is invalidated.
    // Re-check the token so that non-auth events (e.g. profile updates) do not
    // disconnect an active polling session unnecessarily.
    // NOTE: This listener is intentionally never removed because this service is
    // a module-level singleton that lives for the entire page lifetime.
    window.addEventListener('auth-change', () => {
      if (!authService.getToken() || authService.isTokenExpired()) {
        this.disconnect();
      }
    });
  }

  public connect() {
    // 1. MOCK MODE: Use Window Events instead of polling
    if (USE_MOCK_DATA) {
        if (this.isConnected) return;
        
        this.mockEventListener = (e: Event) => {
            const customEvent = e as CustomEvent<ChatMessage>;
            if (customEvent.detail) {
                this.notifyHandlers(customEvent.detail);
            }
        };
        
        window.addEventListener('mock-message-received', this.mockEventListener);
        console.log('Realtime Service (Mock) Connected');
        this.isConnected = true;
        return;
    }

    // 2. REAL MODE: HTTP Polling
    // Azure Static Web Apps does not support WebSocket for managed Functions.
    // We poll /messages/inbox on a fixed interval to detect new incoming messages.
    if (this.pollingInterval) return; // already polling

    const token = authService.getToken();
    if (!token || authService.isTokenExpired()) return;

    // Skip polling entirely when persistent storage is blocked (Safari ITP /
    // private browsing).  Without durable storage the token cannot survive page
    // loads, so every poll would 401 and spam the console / network.
    if (!safeStorage.isAvailable()) {
      console.warn('[realtimeService] storage unavailable — message polling disabled');
      return;
    }

    this.isConnected = true;
    // Initial poll to populate the snapshot without triggering notifications.
    this.pollInbox();
    this.pollingInterval = setInterval(() => this.pollInbox(), POLL_INTERVAL_MS);
  }

  private async pollInbox() {
    const token = authService.getToken();
    if (!token || authService.isTokenExpired()) {
        this.disconnect();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/messages/inbox`, {
            headers: { Authorization: `Bearer ${token}` },
        });

        if (response.status === 401) {
            // Token rejected by server – stop polling; apiClient will handle logout.
            this.disconnect();
            return;
        }

        if (!response.ok) return;

        const items: Array<{
            OtherUserId: string;
            LastMessage: string;
            LastMessageTime: string;
            UnreadCount: number;
        }> = await response.json();

        for (const item of items) {
            const prev = this.inboxSnapshot.get(item.OtherUserId);
            const curTime = item.LastMessageTime;

            if (this.initialized && prev !== undefined && prev.lastMessageTime !== curTime && item.UnreadCount > 0) {
                // New message detected – notify subscribers.
                this.notifyHandlers({
                    id: `poll_${item.OtherUserId}_${curTime}_${Math.random().toString(36).slice(2, 9)}`,
                    senderId: item.OtherUserId,
                    text: item.LastMessage,
                    type: 'TEXT',
                    timestamp: new Date(curTime).toLocaleTimeString('fa-AF', { hour: '2-digit', minute: '2-digit' }),
                    isRead: false,
                    status: 'SENT',
                    isDeleted: false,
                });
            }

            this.inboxSnapshot.set(item.OtherUserId, { lastMessageTime: curTime });
        }

        this.initialized = true;
    } catch {
        // Ignore transient network errors; next poll will retry.
    }
  }

  public subscribe(handler: MessageHandler) {
      this.messageHandlers.push(handler);
      return () => {
          this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
      };
  }

  private notifyHandlers(message: ChatMessage) {
      this.messageHandlers.forEach(handler => handler(message));
  }

  public sendMessage(_conversationId: string, _text: string) {
      // Mock mode: Azure service handles storage and event firing.
      if (USE_MOCK_DATA) {
          return false; // Let the calling component fall back to REST/LocalStorage logic.
      }

      // In real mode, REST API is always used (no WebSocket).
      return false;
  }

  public disconnect() {
      if (USE_MOCK_DATA && this.mockEventListener) {
          window.removeEventListener('mock-message-received', this.mockEventListener);
          this.mockEventListener = null;
      }
      if (this.pollingInterval) {
          clearInterval(this.pollingInterval);
          this.pollingInterval = null;
      }
      this.isConnected = false;
      this.initialized = false;
      this.inboxSnapshot.clear();
  }
}

export const realtimeService = new RealtimeService();
