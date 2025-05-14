import DOMPurify from "dompurify";
import crypto from "crypto-js";

// 安全统计
interface SecurityStats {
  xssAttempts: number;
  csrfAttempts: number;
  lastAttemptTime: string | null;
}

// 初始化安全统计
let securityStats: SecurityStats = {
  xssAttempts: 0,
  csrfAttempts: 0,
  lastAttemptTime: null,
};

// 用于加密的密钥（实际应用中应从环境变量或配置中获取）
const ENCRYPTION_KEY = "DroneNav_Security_Key_2023";
const TOKEN_STORAGE_KEY = "encrypted_csrf_token";

// cookie名称
const COOKIE_TOKEN_NAME = "secure_csrf_token";

/**
 * 防XSS攻击 - 净化文本内容
 * @param content 需要净化的内容
 * @returns 净化后的安全内容
 */
export const sanitizeText = (content: string): string => {
  if (!content) return "";

  // 检查是否有潜在的XSS攻击
  const potentialXSS =
    content.includes("<script") ||
    content.includes("javascript:") ||
    content.includes("onerror=") ||
    content.includes("onclick=");

  if (potentialXSS) {
    securityStats.xssAttempts++;
    securityStats.lastAttemptTime = new Date().toISOString();
    console.warn("检测到潜在XSS攻击尝试，已阻止");
    // 记录统计数据到本地存储
    saveSecurityStats();
  }

  // 防止DOMPurify不可用的情况
  if (typeof DOMPurify === "undefined") {
    // 简单的HTML实体转义
    return content
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
  return DOMPurify.sanitize(content, { ALLOWED_TAGS: [] });
};

/**
 * 加密数据
 * @param data 需要加密的数据
 * @returns 加密后的数据
 */
export const encryptData = (data: string): string => {
  return crypto.AES.encrypt(data, ENCRYPTION_KEY).toString();
};

/**
 * 解密数据
 * @param encryptedData 加密的数据
 * @returns 解密后的数据
 */
export const decryptData = (encryptedData: string): string => {
  try {
    const bytes = crypto.AES.decrypt(encryptedData, ENCRYPTION_KEY);
    return bytes.toString(crypto.enc.Utf8);
  } catch (error) {
    console.error("解密失败:", error);
    return "";
  }
};

/**
 * 生成CSRF令牌
 * @returns CSRF令牌
 */
export const generateCSRFToken = (): string => {
  const timestamp = new Date().getTime().toString();
  const random = Math.random().toString();
  return crypto.SHA256(timestamp + random).toString();
};

/**
 * 设置安全cookie
 * @param name cookie名称
 * @param value cookie值
 * @param days 有效天数
 */
const setSecureCookie = (name: string, value: string, days = 7): void => {
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value};${expires};path=/;SameSite=Strict;Secure`;
};

/**
 * 获取cookie值
 * @param name cookie名称
 * @returns cookie值
 */
const getCookie = (name: string): string => {
  if (!document.cookie) return "";

  const cookieArr = document.cookie.split(";");
  for (const cookie of cookieArr) {
    const cookieTrimmed = cookie.trim();
    // 确保cookie有值并且包含等号
    if (cookieTrimmed && cookieTrimmed.includes("=")) {
      const [cookieName, ...valueParts] = cookieTrimmed.split("=");
      if (cookieName === name && valueParts.length > 0) {
        return decodeURIComponent(valueParts.join("="));
      }
    }
  }
  return "";
};

/**
 * 获取当前CSRF令牌
 * @returns 存储的CSRF令牌，如果不存在则生成新的
 */
export const getCSRFToken = (): string => {
  try {
    // 尝试从localStorage获取加密token
    const encryptedTokenFromStorage = localStorage.getItem(TOKEN_STORAGE_KEY);

    if (encryptedTokenFromStorage) {
      try {
        // 解密token
        const decryptedToken = decryptData(encryptedTokenFromStorage);
        if (decryptedToken) {
          return decryptedToken;
        }
      } catch (e) {
        console.warn("localStorage中的token解密失败", e);
      }
    }

    // 如果localStorage不可用或解密失败，尝试从cookie获取
    const cookieToken = getCookie(COOKIE_TOKEN_NAME);
    if (cookieToken) {
      try {
        const decryptedCookieToken = decryptData(cookieToken);
        if (decryptedCookieToken) {
          // 将cookie中的token同步到localStorage（如果可用）
          try {
            localStorage.setItem(TOKEN_STORAGE_KEY, cookieToken);
          } catch (e) {
            console.warn("无法写入localStorage", e);
          }
          return decryptedCookieToken;
        }
      } catch (e) {
        console.warn("Cookie令牌解密失败", e);
      }
    }

    // 找不到有效token或无法解密，生成新token
    const newToken = generateCSRFToken();
    storeEncryptedToken(newToken);
    return newToken;
  } catch (e) {
    // 发生任何错误都生成新token
    console.error("获取CSRF令牌时发生错误:", e);
    const emergencyToken = generateCSRFToken();
    try {
      setSecureCookie(COOKIE_TOKEN_NAME, encryptData(emergencyToken));
    } catch (e) {
      console.error("无法设置安全cookie:", e);
    }
    return emergencyToken;
  }
};

/**
 * 添加CSRF令牌到请求头
 * @param headers 原始请求头
 * @returns 添加了CSRF令牌的请求头
 */
export const addCSRFHeader = (
  headers: Record<string, string> = {}
): Record<string, string> => {
  return {
    ...headers,
    "X-CSRF-Token": getCSRFToken(),
  };
};

/**
 * 检查CSRF令牌是否有效
 * @param token 接收到的令牌
 * @returns 是否有效
 */
export const validateCSRFToken = (token: string): boolean => {
  if (!token) {
    securityStats.csrfAttempts++;
    securityStats.lastAttemptTime = new Date().toISOString();
    console.warn("检测到CSRF令牌缺失，已阻止请求");
    saveSecurityStats();
    return false;
  }

  try {
    // 获取本地存储的token
    const storedToken = getCSRFToken();

    if (!storedToken || token !== storedToken) {
      securityStats.csrfAttempts++;
      securityStats.lastAttemptTime = new Date().toISOString();
      console.warn("检测到CSRF令牌无效，已阻止请求");
      saveSecurityStats();
      return false;
    }

    return true;
  } catch (e) {
    console.error("验证CSRF令牌时发生错误:", e);
    securityStats.csrfAttempts++;
    securityStats.lastAttemptTime = new Date().toISOString();
    saveSecurityStats();
    return false;
  }
};

/**
 * 保存安全统计数据
 */
const saveSecurityStats = (): void => {
  localStorage.setItem("security_stats", JSON.stringify(securityStats));
};

/**
 * 加载安全统计数据
 */
export const loadSecurityStats = (): SecurityStats => {
  const stats = localStorage.getItem("security_stats");
  if (stats) {
    securityStats = JSON.parse(stats);
  }
  return securityStats;
};

/**
 * 获取当前安全统计
 */
export const getSecurityStats = (): SecurityStats => {
  return securityStats;
};

/**
 * 在两个位置存储加密的token
 * @param token 要存储的原始token
 * @returns 加密后的token
 */
const storeEncryptedToken = (token: string): string => {
  const encryptedToken = encryptData(token);
  // 尝试保存到localStorage
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, encryptedToken);
  } catch (e) {
    console.warn("无法写入localStorage");
  }
  // 同时写入cookie
  setSecureCookie(COOKIE_TOKEN_NAME, encryptedToken);
  return encryptedToken;
};
