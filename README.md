# DroneNav 前端应用

## 项目概述

DroneNav 是一个智能无人机导航系统的前端应用，提供直观的用户界面，用于无人机路径规划、实时监控和场景模拟。该应用使用 React 和 Three.js 构建沉浸式 3D 可视化界面，支持与后端服务的实时通信。

## 技术栈

- **React 18**: 用户界面构建
- **TypeScript**: 类型安全
- **Vite**: 构建工具和开发服务器
- **Three.js/React Three Fiber**: 3D 渲染和可视化
- **Ant Design**: UI 组件库
- **TailwindCSS**: 样式工具
- **Zustand**: 状态管理
- **React Router**: 页面路由
- **Axios**: HTTP 客户端
- **WebSocket**: 实时通信
- **HTTPS/WSS**: 安全通信

## 项目结构

```
DroneNav_FE/
├── public/         # 静态资源
├── src/
│   ├── assets/     # 图片和其他资源
│   ├── components/ # 可复用组件
│   ├── core/       # 核心功能和3D引擎
│   ├── pages/      # 页面组件
│   ├── services/   # API服务
│   ├── store/      # 全局状态管理
│   ├── types/      # TypeScript类型定义
│   ├── App.tsx     # 应用入口组件
│   └── main.tsx    # 主入口文件
├── index.html      # HTML模板
└── package.json    # 项目依赖和脚本
```

## 功能特性

- 3D 无人机导航可视化
- 交互式路径规划
- 实时障碍物显示
- 场景编辑器
- 飞行数据实时监控
- 多视角切换
- 飞行参数调整
- 安全加密通信 (HTTPS/WSS)

## 安装与运行

### 环境要求

- Node.js 18+
- pnpm 8+（推荐）或 npm/yarn

### 安装步骤

1. 克隆仓库

```bash
git clone <仓库地址>
cd DroneNav_FE
```

2. 安装依赖

```bash
pnpm install
# 或使用npm
# npm install
```

### 开发模式启动

```bash
pnpm dev
# 或使用npm
# npm run dev
```

应用将在 https://localhost:5173 启动，使用 HTTPS 协议

### 构建生产版本

```bash
pnpm build
# 或使用npm
# npm run build
```

## 连接后端

前端默认连接到 `https://localhost:8001` 的后端 API，使用 WSS 协议进行 WebSocket 通信。可以在环境变量或配置文件中修改这个 URL。

## 安全特性

### HTTPS 和 WSS

- 使用与后端共享的 SSL 证书
- 所有 HTTP 请求通过 HTTPS 加密
- WebSocket 连接通过 WSS 加密
- 自动从后端获取证书文件

### 注意事项

- 自签名证书在浏览器中可能会显示为不安全，这是正常的
- 在生产环境中，建议使用受信任的 CA 签发的证书

## 浏览器兼容性

- 推荐使用最新版的 Chrome、Firefox、Safari 或 Edge 浏览器
- 需要支持 WebGL 的浏览器

## 性能优化

- 使用 React.memo 和 useMemo 避免不必要的重渲染
- 3D 场景使用了优化技术如实例化和 LOD
- 懒加载大型组件

## 许可证

[添加许可证信息]
