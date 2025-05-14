export const BASE_URL = "https://localhost:8001";
export const TIMEOUT = 60 * 1000;

// WebSocket配置
export const WS_BASE_URL = "wss://localhost:8001"; // 使用WSS安全协议，修改端口为8001
export const WS_RECONNECT_INTERVAL = 3000; // WebSocket断开后重连间隔（毫秒）
export const WS_MAX_RECONNECT_ATTEMPTS = 5; // 最大重连次数
