// services/ws.ts
import { WebSocketEvent, WebSocketConfig } from "@/types/ws";
import {
  WS_BASE_URL,
  WS_RECONNECT_INTERVAL,
  WS_MAX_RECONNECT_ATTEMPTS,
} from "@/services/config";
import { message } from "antd";
import { showCertificateModal } from "@/utils/certificate";

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
  private connectionInProgress: boolean;
  private timeout: ReturnType<typeof setTimeout> | null;

  constructor(config: Partial<WebSocketConfig> = {}) {
    this.config = {
      url: `${WS_BASE_URL}/ws/trajectory`,
      reconnectInterval: WS_RECONNECT_INTERVAL,
      maxReconnects: WS_MAX_RECONNECT_ATTEMPTS,
      ...config,
    };

    // 如果传入的URL使用了旧的http/ws协议，转换为https/wss协议
    if (this.config.url.startsWith("ws://")) {
      console.warn(
        "检测到不安全的WebSocket连接 (ws://)，已自动转换为安全连接 (wss://)"
      );
      this.config.url = this.config.url.replace("ws://", "wss://");
    }
    if (this.config.url.startsWith("http://")) {
      console.warn(
        "检测到不安全的WebSocket连接 (http://)，已自动转换为安全连接 (wss://)"
      );
      this.config.url = this.config.url.replace("http://", "wss://");
    }

    this.subscribers = new Map();
    this.ws = null;
    this.reconnectAttempts = 0;
    this.connectionInProgress = false;
    this.timeout = null;
  }

  connect(): void {
    if (this.ws || this.connectionInProgress) return;

    this.connectionInProgress = true;
    console.log(`尝试连接WebSocket: ${this.config.url}`);

    try {
      this.ws = new WebSocket(this.config.url);

      // 设置连接超时
      this.timeout = setTimeout(() => {
        if (this.ws?.readyState !== WebSocket.OPEN) {
          console.error("WebSocket连接超时");
          this.ws?.close();
          this.ws = null;
          this.connectionInProgress = false;
          this.handleConnectionFailure("连接超时");
        }
      }, 10000); // 10秒超时

      this.ws.onopen = () => {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        this.connectionInProgress = false;
        this.handleOpen();
      };

      this.ws.onmessage = e => this.handleMessage(e);

      this.ws.onclose = event => {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        this.connectionInProgress = false;
        this.handleClose(event);
      };

      this.ws.onerror = e => {
        if (this.timeout) {
          clearTimeout(this.timeout);
          this.timeout = null;
        }
        this.connectionInProgress = false;
        this.handleError(e);
      };
    } catch (e) {
      console.error("WebSocket连接创建失败:", e);
      this.connectionInProgress = false;
      if (this.timeout) {
        clearTimeout(this.timeout);
        this.timeout = null;
      }
      this.handleConnectionFailure("连接创建失败");
    }
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
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        console.error("关闭WebSocket连接时出错:", e);
      }
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.connectionInProgress = false;
  }

  private handleOpen(): void {
    console.log("WebSocket连接已打开");
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
      console.error("WebSocket消息解析失败:", error, event.data);
      this.dispatch("error", {
        code: "PARSE_ERROR",
        message: "消息解析失败",
        details: error,
        timestamp: new Date().toISOString(),
      });
    }
  }

  private handleClose(event?: CloseEvent): void {
    console.log(
      `WebSocket连接已关闭 [${event?.code}]: ${event?.reason || "未知原因"}`
    );

    // 1000: 正常关闭, 1001: 离开页面
    const isNormalClosure = event?.code === 1000 || event?.code === 1001;

    this.ws = null;

    this.dispatch("disconnected", {
      timestamp: new Date().toISOString(),
      reason: event?.reason,
    });

    if (
      !isNormalClosure &&
      this.reconnectAttempts < this.config.maxReconnects
    ) {
      console.log(
        `尝试重新连接 (${this.reconnectAttempts + 1}/${
          this.config.maxReconnects
        })...`
      );

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.config.reconnectInterval);
    } else if (this.reconnectAttempts >= this.config.maxReconnects) {
      console.error("WebSocket重连次数已达上限，放弃重连");
      message.error("WebSocket连接失败，请刷新页面重试");
    }
  }

  private handleError(error: Event): void {
    console.error("WebSocket发生错误:", error);

    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {
        // 忽略关闭时的错误
      }
      this.ws = null;
    }

    this.dispatch("error", {
      code: "CONNECTION_ERROR",
      message: "WebSocket连接错误，可能是WSS证书问题",
      details: error,
      timestamp: new Date().toISOString(),
    });

    // 显示证书提示
    this.showCertificateWarning();
  }

  private handleConnectionFailure(reason: string): void {
    console.error(`WebSocket连接失败: ${reason}`);

    this.dispatch("error", {
      code: "CONNECTION_FAILED",
      message: `WebSocket连接失败: ${reason}`,
      timestamp: new Date().toISOString(),
    });

    if (this.reconnectAttempts < this.config.maxReconnects) {
      console.log(
        `尝试重新连接 (${this.reconnectAttempts + 1}/${
          this.config.maxReconnects
        })...`
      );

      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, this.config.reconnectInterval);
    } else {
      console.error("WebSocket重连次数已达上限，放弃重连");
      message.error("无法建立WebSocket连接，请检查网络或证书设置");
      this.showCertificateWarning();
    }
  }

  // 显示证书警告
  private showCertificateWarning(): void {
    // 使用certificate工具中的模态框，提供更友好的用户界面
    showCertificateModal();
  }

  private dispatch<T>(event: WebSocketEvent, data: T): void {
    this.subscribers.get(event)?.forEach(callback => callback(data));
  }
}
