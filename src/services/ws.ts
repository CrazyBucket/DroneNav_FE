// services/ws.ts
import {
  WebSocketEvent,
  WebSocketConfig,
  DroneInitData,
} from "@/types/ws";

export class DroneWebSocket {
  private config: WebSocketConfig;
  private subscribers: Map<WebSocketEvent, Set<(data: any) => void>>;
  private ws: WebSocket | null;
  private reconnectAttempts: number;
  private lastInitData: DroneInitData | undefined;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: "ws://localhost:8000/ws/trajectory",
      reconnectInterval: 3000,
      maxReconnects: 5,
      ...config,
    };

    this.subscribers = new Map();
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  connect(initData: DroneInitData): void {
    this.ws = new WebSocket(this.config.url);

    this.ws.onopen = () => this.handleOpen(initData);
    this.ws.onmessage = event => this.handleMessage(event);
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = error => this.handleError(error);
  }

  subscribe<T = unknown>(
    event: WebSocketEvent,
    callback: (data: T) => void
  ): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event)!.add(callback);
    return () => this.unsubscribe(event, callback);
  }

  unsubscribe(event: WebSocketEvent, callback: (data: any) => void): void {
    this.subscribers.get(event)?.delete(callback);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.reconnectAttempts = 0;
  }

  private handleOpen(initData: DroneInitData): void {
    this.reconnectAttempts = 0;
    this.ws?.send(JSON.stringify(initData));
    this.dispatch("connected", null);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      if (data.event_type && this.subscribers.has(data.event_type)) {
        this.dispatch(data.event_type, data.payload);
      }
    } catch (error) {
      this.dispatch("error", {
        type: "ParseError",
        message: "Failed to parse message",
        raw: event.data,
      });
    }
  }

  private handleClose(): void {
    this.dispatch("disconnected", null);
    if (this.reconnectAttempts < this.config.maxReconnects) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect(this.lastInitData!);
      }, this.config.reconnectInterval);
    }
  }

  private handleError(error: Event): void {
    this.dispatch("error", {
      type: "ConnectionError",
      message: "WebSocket connection error",
      error,
    });
  }

  private dispatch<T>(event: WebSocketEvent, data: T): void {
    this.subscribers.get(event)?.forEach(callback => callback(data));
  }
}
