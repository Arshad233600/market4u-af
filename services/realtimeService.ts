
import { authService } from './authService';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';
import { ChatMessage } from '../types';

type MessageHandler = (message: ChatMessage) => void;

const MAX_RECONNECT_DELAY = 60000; // 1 minute cap

class RealtimeService {
  private socket: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private isConnected = false;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 5000; // start at 5 s, doubles on each failure
  private mockEventListener: ((e: Event) => void) | null = null;

  constructor() {
    this.connect();
  }

  public connect() {
    // 1. MOCK MODE: Use Window Events instead of WebSocket
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

    // 2. REAL MODE: Use WebSocket
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
        return;
    }

    const token = authService.getToken();
    if (!token) return;

    // Convert HTTP URL to WS URL
    const wsUrl = API_BASE_URL ? API_BASE_URL.replace(/^http/, 'ws') + '/chat/hub?access_token=' + token : '';

    try {
        this.socket = new WebSocket(wsUrl);

        this.socket.onopen = () => {
            console.log('Realtime Chat Connected');
            this.isConnected = true;
            this.reconnectDelay = 5000; // reset backoff on successful connection
            this.clearReconnectTimeout();
        };

        this.socket.onmessage = (event) => {
            try {
                const message: ChatMessage = JSON.parse(event.data);
                this.notifyHandlers(message);
            } catch (e) {
                console.error('Error parsing WS message', e);
            }
        };

        this.socket.onclose = () => {
            console.log('Realtime Chat Disconnected');
            this.isConnected = false;
            this.scheduleReconnect();
        };

        this.socket.onerror = () => {
            // onerror is always followed by onclose; let onclose handle reconnect
            this.socket?.close();
        };

    } catch (e) {
        console.error('WS Connection Failed', e);
        this.scheduleReconnect();
    }
  }

  private clearReconnectTimeout() {
      if (this.reconnectTimeout) {
          clearTimeout(this.reconnectTimeout);
          this.reconnectTimeout = null;
      }
  }

  private scheduleReconnect() {
      if (USE_MOCK_DATA) return;
      if (this.reconnectTimeout) return; // already scheduled

      this.reconnectTimeout = setTimeout(() => {
          this.reconnectTimeout = null;
          console.log(`Attempting to reconnect (next attempt in ${Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY)}ms if it fails)...`);
          this.connect();
      }, this.reconnectDelay);

      // Exponential backoff, capped at MAX_RECONNECT_DELAY
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, MAX_RECONNECT_DELAY);
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

  public sendMessage(conversationId: string, text: string) {
      // Mock mode: Azure service handles storage and event firing
      if (USE_MOCK_DATA) {
          return false; // Return false to let the calling component fallback to REST/LocalStorage logic
      }

      if (this.isConnected && this.socket) {
          const payload = JSON.stringify({ conversationId, text, type: 'TEXT' });
          this.socket.send(payload);
          return true; // Sent via Socket
      }
      return false; // Fallback to REST required
  }

  public disconnect() {
      if (USE_MOCK_DATA && this.mockEventListener) {
          window.removeEventListener('mock-message-received', this.mockEventListener);
          this.mockEventListener = null;
      }
      this.clearReconnectTimeout();
      if (this.socket) {
          this.socket.close();
      }
      this.isConnected = false;
  }
}

export const realtimeService = new RealtimeService();
