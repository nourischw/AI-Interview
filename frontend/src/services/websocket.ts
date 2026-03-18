import { createLogger } from '@ai-interview/shared';

const logger = createLogger('WebSocketService', false);

export type WSMessage = {
  type: string;
  data?: unknown;
  [key: string]: unknown;
};

export type WSListener = (message: WSMessage) => void;

export class WebSocketService {
  private ws: WebSocket | null = null;
  private listeners: Map<string, Set<WSListener>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private shouldReconnect = true;

  connect(url: string = `ws://${window.location.hostname}:3001/ws`): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnecting) {
        reject(new Error('Already connecting'));
        return;
      }

      this.isConnecting = true;
      logger.info(`Connecting to ${url}`);

      try {
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          logger.info('WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          resolve();
        };

        this.ws.onclose = (event) => {
          logger.info(`WebSocket closed: ${event.code} ${event.reason}`);
          this.isConnecting = false;
          this.ws = null;

          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect(url);
          }
        };

        this.ws.onerror = (error) => {
          logger.error('WebSocket error:', error);
          this.isConnecting = false;
          reject(error);
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WSMessage = JSON.parse(event.data);
            logger.debug('Received:', message);
            this.notifyListeners(message.type, message);
          } catch (err) {
            logger.error('Failed to parse message:', err);
          }
        };
      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  private scheduleReconnect(url: string): void {
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    logger.info(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    setTimeout(() => {
      this.connect(url).catch((err) => {
        logger.error('Reconnection failed:', err);
      });
    }, delay);
  }

  disconnect(): void {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('WebSocket disconnected');
  }

  send(message: WSMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      logger.warn('Cannot send message - WebSocket not connected');
    }
  }

  on(eventType: string, listener: WSListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  private notifyListeners(eventType: string, message: WSMessage): void {
    const eventListeners = this.listeners.get(eventType);
    if (eventListeners) {
      eventListeners.forEach((listener) => {
        try {
          listener(message);
        } catch (err) {
          logger.error('Listener error:', err);
        }
      });
    }

    // Also notify wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      wildcardListeners.forEach((listener) => listener(message));
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getReadyState(): number {
    return this.ws?.readyState ?? WebSocket.CLOSED;
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
