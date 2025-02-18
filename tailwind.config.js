/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      // ===== 色彩体系 =====
      colors: {
        // 主色系 - 科技蓝
        primary: {
          50: "#f0f9ff",
          100: "#e0f2fe",
          200: "#bae6fd",
          300: "#7dd3fc",
          400: "#38bdf8",
          500: "#0ea5e9", // 基础主色
          600: "#0284c7",
          700: "#0369a1",
          800: "#075985",
          900: "#0c4a6e",
        },

        // 辅助色 - 无人机绿
        drone: {
          100: "#d1fae5",
          200: "#a7f3d0",
          300: "#6ee7b7",
          400: "#34d399", // 主要状态色
          500: "#10b981",
          600: "#059669",
          700: "#047857",
          800: "#065f46",
          900: "#064e3b",
        },

        // 警报色 - 熔岩红
        danger: {
          100: "#ffe4e6",
          200: "#fecdd3",
          300: "#fda4af",
          400: "#fb7185", // 主要警报色
          500: "#f43f5e",
          600: "#e11d48",
          700: "#be123c",
          800: "#9f1239",
          900: "#881337",
        },

        // 场景背景色
        scene: {
          ground: "#2d3748", // 地面底色
          obstacle: "#4a5568", // 障碍物基础色
          sky: "#1a365d", // 天空背景
        },
      },

      // ===== 3D 视图专用扩展 =====
      boxShadow: {
        drone: "0 0 15px rgba(16, 185, 129, 0.3)", // 无人机悬浮光效
        path: "0 0 8px rgba(14, 165, 233, 0.5)", // 路径高亮光效
      },

      animation: {
        "path-pulse": "pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },

      // ===== 空间布局体系 =====
      spacing: {
        scene: "1.25rem", // 20px 场景专用间距
        panel: "2.5rem", // 40px 控制面板间距
      },

      // ===== 字体体系 =====
      fontFamily: {
        display: ['"Orbitron"', "sans-serif"], // 科技感标题字体
        body: ['"Inter"', "sans-serif"], // 易读正文字体
      },
    },
  },
  plugins: [require("@tailwindcss/typography"), require("@tailwindcss/forms")],
};
