export type WebSocketEvent = 
  | 'connected'
  | 'disconnected'
  | 'position_update'
  | 'mission_complete'
  | 'error'
  | string;

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

export interface DroneInitData {
  current_position: DronePosition;
  target: DronePosition;
  speed: number;
  obstacles?: Obstacle[];
}

export interface Obstacle {
  position: [number, number, number];
  dimensions: [number, number, number];
}

export interface WebSocketError {
  type: 'ParseError' | 'ConnectionError' | 'ValidationError';
  message: string;
  error?: unknown;
  raw?: unknown;
}