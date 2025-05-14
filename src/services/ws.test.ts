// ws.test.ts
import { DroneWebSocket } from "./ws";
import { WS_BASE_URL } from "./config";

/**
 * 此文件提供了WebSocket连接测试功能
 * 可以在控制台运行以验证WSS连接是否正常工作
 */

// 测试函数
export const testWSSConnection = async (): Promise<boolean> => {
  return new Promise(resolve => {
    console.log("开始测试WSS连接...");
    console.log(`当前WS基础URL: ${WS_BASE_URL}`);

    try {
      const testUrl = `${WS_BASE_URL}/ws/test`;
      console.log(`连接到: ${testUrl}`);

      // 创建WebSocket实例
      const ws = new DroneWebSocket({
        url: testUrl,
      });

      // 订阅事件
      ws.subscribe("connected", data => {
        console.log("WSS连接成功:", data);
        ws.disconnect();
        resolve(true);
      });

      ws.subscribe("error", error => {
        console.error("WSS连接错误:", error);
        resolve(false);
      });

      // 设置超时
      const timeout = setTimeout(() => {
        console.error("WSS连接测试超时");
        ws.disconnect();
        resolve(false);
      }, 5000);

      // 添加断开连接回调
      ws.subscribe("disconnected", () => {
        clearTimeout(timeout);
      });

      // 尝试连接
      ws.connect();
    } catch (error) {
      console.error("WSS测试失败:", error);
      resolve(false);
    }
  });
};

// 如果直接运行此文件，则自动执行测试
if (
  typeof window !== "undefined" &&
  window.location.pathname.includes("debug")
) {
  console.log("检测到调试模式，自动执行WSS连接测试");
  testWSSConnection().then(result => {
    if (result) {
      console.log("✅ WSS连接测试成功");
    } else {
      console.log("❌ WSS连接测试失败");
    }
  });
}

// 导出测试函数，可以在开发者控制台中使用
// 例如: import { testWSSConnection } from "@/services/ws.test"; testWSSConnection();
export default testWSSConnection;
