
import { authService } from './authService';
import { API_BASE_URL, USE_MOCK_DATA } from '../config';
import { ChatMessage } from '../types';

type MessageHandler = (message: ChatMessage) => void;

class RealtimeService {
  private socket: WebSocket | null = null;
  private messageHandlers: MessageHandler[] = [];
  private isConnected = false;
  private reconnectInterval: ReturnType<typeof setInterval> | null = null;
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
            if (this.reconnectInterval) clearInterval(this.reconnectInterval);
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

        this.socket.onerror = (error) => {
            console.error('WS Error', error);
            this.socket?.close();
        };

    } catch (e) {
        console.error('WS Connection Failed', e);
        this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
      if (USE_MOCK_DATA) return;
      
      if (!this.reconnectInterval) {
          this.reconnectInterval = setInterval(() => {
              console.log('Attempting to reconnect...');
              this.connect();
          }, 5000);
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
      if (this.socket) {
          this.socket.close();
      }
      if (this.reconnectInterval) clearInterval(this.reconnectInterval);
      this.isConnected = false;
  }
}

export const realtimeService = new RealtimeService();
