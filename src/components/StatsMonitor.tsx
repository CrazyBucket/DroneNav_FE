import React, { useEffect, useRef } from "react";
import Stats from "stats.js";
import { useSettingStore } from "@/store/setting";

interface StatsMonitorProps {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}

const StatsMonitor: React.FC<StatsMonitorProps> = ({
  position = "bottom-right",
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<Stats | null>(null);
  const mountedRef = useRef(false); // 记录DOM挂载状态
  const { showPerformanceMonitor } = useSettingStore();

  useEffect(() => {
    // 只在组件挂载时创建一次Stats实例
    const stats = new Stats();
    statsRef.current = stats;

    // 配置Stats面板
    stats.showPanel(0); // 0: fps, 1: ms, 2: mb, 3: custom

    // 设置Stats DOM元素的样式
    if (stats.dom) {
      // 重置stats.js默认的样式 - 确保我们的位置设置生效
      stats.dom.style.cssText = "";
      stats.dom.style.position = "static"; // 使其遵循父容器的布局
      console.log("[StatsMonitor] 重置Stats面板默认样式");
    }

    if (containerRef.current) {
      try {
        containerRef.current.appendChild(stats.dom);
        mountedRef.current = true; // 标记已挂载
        console.log("[StatsMonitor] Stats面板已挂载");
      } catch (error) {
        console.error("[StatsMonitor] 挂载Stats面板失败:", error);
      }
    }

    // 设置动画循环
    let animationFrameId: number;
    const animate = () => {
      if (!statsRef.current) return;

      statsRef.current.begin();
      // 这里什么都不做，只是测量帧率
      statsRef.current.end();

      // 继续请求下一帧
      if (showPerformanceMonitor && statsRef.current) {
        animationFrameId = requestAnimationFrame(animate);
      }
    };

    // 仅在showPerformanceMonitor为true时开始动画
    if (showPerformanceMonitor && statsRef.current) {
      console.log("[StatsMonitor] 开始性能监控");
      animationFrameId = requestAnimationFrame(animate);
    }

    // 清理函数
    return () => {
      // 取消动画帧请求
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      // 安全地移除DOM元素
      if (containerRef.current && statsRef.current && mountedRef.current) {
        try {
          // 检查是否真的是子节点
          let isChild = false;
          for (let i = 0; i < containerRef.current.children.length; i++) {
            if (containerRef.current.children[i] === statsRef.current.dom) {
              isChild = true;
              break;
            }
          }

          if (isChild) {
            containerRef.current.removeChild(statsRef.current.dom);
            console.log("[StatsMonitor] Stats面板已移除");
          } else {
            console.log(
              "[StatsMonitor] Stats面板不是当前节点的子元素，跳过移除"
            );
          }
        } catch (e) {
          console.error("[StatsMonitor] 移除Stats面板时出错:", e);
        }
      }

      // 重置状态
      mountedRef.current = false;
      statsRef.current = null;
    };
  }, [showPerformanceMonitor]);

  // 如果不显示监控，返回null
  if (!showPerformanceMonitor) {
    return null;
  }

  // 根据位置设置样式
  const getPositionStyle = () => {
    switch (position) {
      case "top-left":
        return { top: "10px", left: "10px" };
      case "top-right":
        return { top: "10px", right: "10px" };
      case "bottom-left":
        return { bottom: "10px", left: "10px" };
      case "bottom-right":
      default:
        return { bottom: "10px", right: "10px" };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "fixed",
        zIndex: 9999,
        ...getPositionStyle(),
        // 添加容器样式，确保位置正确
        display: "block",
        width: "auto",
        height: "auto",
        overflow: "visible",
        pointerEvents: "none",
      }}
    />
  );
};

export default StatsMonitor;
