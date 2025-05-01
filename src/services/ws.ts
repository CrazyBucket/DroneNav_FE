// services/ws.ts
import { WebSocketEvent, WebSocketConfig, DroneInitData } from "@/types/ws";

interface WebSocketEventMap {
  connected: { taskId: string };
  disconnected: { reason?: string };
  position_update: {
    coordinates: { x: number; y: number; z: number };
    progress: { current: number; total: number };
  };
  mission_complete: { finalPosition: { x: number; y: number; z: number } };
  error: { code: string; message: string };
}

export class DroneWebSocket {
  private config: WebSocketConfig;
  private subscribers: Map<WebSocketEvent, Set<(data: any) => void>>;
  private ws: WebSocket | null;
  private reconnectAttempts: number;

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

  connect(): void {
    if (this.ws) return;
    this.ws = new WebSocket(this.config.url);
    this.ws.onopen = () => this.handleOpen();
    this.ws.onmessage = e => this.handleMessage(e);
    this.ws.onclose = () => this.handleClose();
    this.ws.onerror = e => this.handleError(e);
  }

  subscribe<K extends WebSocketEvent>(
    event: K,
    callback: (data: WebSocketEventMap[K]) => void
  ): () => void {
    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }

    const callbackSet = this.subscribers.get(event)!;
    callbackSet.add(callback as any); // 安全类型断言

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

  private handleOpen(): void {
    this.reconnectAttempts = 0;
    this.dispatch("connected", {
      timestamp: new Date().toISOString(),
      taskId: this.config.url.split("/").pop() || "",
    });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const { event_type, data } = JSON.parse(event.data);
      const normalizedEvent = event_type.toLowerCase() as WebSocketEvent;

      if (this.subscribers.has(normalizedEvent)) {
        this.dispatch(normalizedEvent, data);
      }
    } catch (error) {
      this.dispatch("error", {
        code: "PARSE_ERROR",
        message: "消息解析失败",
        details: error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleClose(): void {
    this.dispatch("disconnected", {
      timestamp: new Date().toISOString(),
    });

    if (this.reconnectAttempts < this.config.maxReconnects) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
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
