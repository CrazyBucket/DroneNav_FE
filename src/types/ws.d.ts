export type WebSocketEvent = keyof WebSocketEventMap;

export interface WebSocketConfig {
  url: string;
  reconnectInterval: number;
  maxReconnects: number;
}

export interface DronePosition {
  x: number;
  y: number;
  z: number;
  timestamp: number;
}

export interface TrajectoryProgress {
  current: number;
  total: number;
  remaining: number;
  distance: number;
}

export interface Obstacle {
  position: [number, number, number];
  dimensions: [number, number, number];
}

export interface WebSocketError {
  type: "ParseError" | "ConnectionError" | "ValidationError";
  message: string;
  error?: unknown;
  raw?: unknown;
}

export type WebSocketEvent = keyof WebSocketEventMap;
export interface WebSocketEventMap {
  // 系统级事件
  connected: {
    timestamp: string;
    task_id: string;
  };
  disconnected: {
    timestamp: string;
    reason?: string;
  };

  // 业务级事件
  position_update: {
    sequence: number;
    timestamp: string;
    coordinates: { x: number; y: number; z: number };
    progress: { current: number; total: number; remaining: number };
  };
  mission_complete: {
    timestamp: string;
    final_position: { x: number; y: number; z: number };
  };
  error: {
    code: string;
    message: string;
    details?: unknown;
    timestamp: string;
  };
}
