// 用户信息类型
export interface User {
  user_id: string;
  username: string;
  email: string;
  role: string;
  last_login?: string;
}

// 登录请求类型
export interface LoginRequest {
  username: string;
  password: string;
}

// 登录响应类型
export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}

// 注册请求类型
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

// 密码重置请求类型
export interface PasswordResetRequest {
  email: string;
}

// 密码重置确认类型
export interface PasswordResetConfirmRequest {
  token: string;
  new_password: string;
}

// 令牌刷新请求类型
export interface RefreshTokenRequest {
  refresh_token: string;
}

// 认证状态类型
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

// 设备指纹类型
export interface DeviceFingerprint {
  canvasHash: string;
  screenResolution: string;
  timezone: string;
  platform: string;
  webglHash: string;

  // 生成指纹字符串
  toString(): string;
}

// 密码验证规则
export const passwordRules = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
};
