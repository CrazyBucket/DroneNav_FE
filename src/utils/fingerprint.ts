import { DeviceFingerprint } from "@/types/auth";
import CryptoJS from "crypto-js";

/**
 * 设备指纹生成器类
 */
class FingerprintGenerator implements DeviceFingerprint {
  canvasHash: string;
  screenResolution: string;
  timezone: string;
  platform: string;
  webglHash: string;

  constructor() {
    this.canvasHash = this.generateCanvasHash();
    this.screenResolution = this.getScreenResolution();
    this.timezone = this.getTimezone();
    this.platform = this.getPlatform();
    this.webglHash = this.generateWebGLHash();
  }

  /**
   * 生成Canvas指纹哈希
   */
  private generateCanvasHash(): string {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return "00000000000000000000000000000000";
      }

      // 设置Canvas大小
      canvas.width = 200;
      canvas.height = 50;

      // 绘制文本
      ctx.textBaseline = "top";
      ctx.font = "14px Arial";
      ctx.fillStyle = "#f60";
      ctx.fillRect(10, 10, 100, 30);
      ctx.fillStyle = "#069";
      ctx.fillText("DroneNav Security", 10, 15);
      ctx.fillStyle = "rgba(102, 204, 0, 0.7)";
      ctx.fillText("Canvas Fingerprint", 10, 30);

      // 添加一些随机形状
      ctx.strokeStyle = "#f06";
      ctx.beginPath();
      ctx.moveTo(30, 10);
      ctx.lineTo(80, 40);
      ctx.lineTo(130, 10);
      ctx.stroke();

      // 获取Canvas数据并哈希
      const dataURL = canvas.toDataURL();
      return CryptoJS.MD5(dataURL).toString();
    } catch (e) {
      console.error("Canvas指纹生成失败:", e);
      return "00000000000000000000000000000000";
    }
  }

  /**
   * 获取屏幕分辨率
   */
  private getScreenResolution(): string {
    return `${window.screen.width}x${window.screen.height}`;
  }

  /**
   * 获取时区偏移
   */
  private getTimezone(): string {
    const offset = new Date().getTimezoneOffset();
    return offset <= 0 ? `+${Math.abs(offset)}` : `-${offset}`;
  }

  /**
   * 获取平台信息
   */
  private getPlatform(): string {
    return navigator.platform || "unknown";
  }

  /**
   * 生成WebGL指纹哈希
   */
  private generateWebGLHash(): string {
    try {
      const canvas = document.createElement("canvas");
      const gl =
        canvas.getContext("webgl") || canvas.getContext("experimental-webgl");

      if (!gl) {
        return "00000000000000000000000000000000";
      }

      // 类型断言为WebGLRenderingContext
      const webgl = gl as WebGLRenderingContext;

      const info = {
        vendor: webgl.getParameter(webgl.VENDOR),
        renderer: webgl.getParameter(webgl.RENDERER),
        version: webgl.getParameter(webgl.VERSION),
        shadingLanguageVersion: webgl.getParameter(
          webgl.SHADING_LANGUAGE_VERSION
        ),
        extensions: webgl.getSupportedExtensions()?.join("|") || "",
      };

      return CryptoJS.MD5(JSON.stringify(info)).toString();
    } catch (e) {
      console.error("WebGL指纹生成失败:", e);
      return "00000000000000000000000000000000";
    }
  }

  /**
   * 生成完整的指纹字符串
   */
  toString(): string {
    return [
      this.canvasHash,
      this.screenResolution,
      this.timezone,
      this.platform,
      this.webglHash,
    ].join("|");
  }
}

/**
 * 生成设备指纹
 */
export const generateFingerprint = (): DeviceFingerprint => {
  return new FingerprintGenerator();
};

/**
 * 获取设备指纹字符串
 */
export const getFingerprintString = (): string => {
  const fingerprint = generateFingerprint();
  return fingerprint.toString();
};

// 在localStorage中存储指纹，避免每次都重新生成
export const getOrCreateFingerprint = (): string => {
  const storedFingerprint = localStorage.getItem("device_fingerprint");

  if (storedFingerprint) {
    return storedFingerprint;
  }

  const newFingerprint = getFingerprintString();
  localStorage.setItem("device_fingerprint", newFingerprint);
  return newFingerprint;
};
