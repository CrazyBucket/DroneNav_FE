import axios, { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { BASE_URL, TIMEOUT } from "./config";
import { getCSRFToken } from "@/utils/security";

axios.defaults.baseURL = BASE_URL;
export class ApiBase {
  // axios 配置
  protected ajaxRequest: unknown = null;
  protected CancelToken = axios.CancelToken;

  protected http: AxiosInstance = axios.create({
    timeout: TIMEOUT,
  });

  protected service: AxiosInstance = axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT,
    headers: {
      "Content-Type": "application/json",
    },
  });

  constructor() {
    // 添加请求拦截器
    this.service.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        console.log(
          `发送请求: ${config.method?.toUpperCase()} ${config.url}`,
          config
        );

        // 添加CSRF令牌到请求头
        if (config.headers) {
          config.headers["X-CSRF-Token"] = getCSRFToken();
        }

        return config;
      },
      error => {
        console.error("请求错误:", error);
        return Promise.reject(error);
      }
    );

    // 添加响应拦截器
    this.service.interceptors.response.use(
      response => {
        console.log(`收到响应: ${response.status}`, response.data);
        return response;
      },
      error => {
        console.error("响应错误:", error);
        return Promise.reject(error);
      }
    );
  }
}

export default ApiBase;
