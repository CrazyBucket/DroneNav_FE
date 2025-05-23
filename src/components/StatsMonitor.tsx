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
  const animationFrameRef = useRef<number | null>(null);
  const { showPerformanceMonitor } = useSettingStore();

  useEffect(() => {
    let isComponentMounted = true;

    // 清理函数
    const cleanup = () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (containerRef.current && statsRef.current?.dom) {
        try {
          containerRef.current.removeChild(statsRef.current.dom);
        } catch (e) {
          console.warn("[StatsMonitor] 清理DOM时出错:", e);
        }
      }
      statsRef.current = null;
    };

    // 如果不显示监控，直接清理并返回
    if (!showPerformanceMonitor) {
      cleanup();
      return cleanup;
    }

    // 初始化stats.js
    if (!statsRef.current && isComponentMounted) {
      try {
        const stats = new Stats();
        statsRef.current = stats;
        stats.showPanel(0);

        if (containerRef.current && stats.dom) {
          // 重置stats.js默认样式
          stats.dom.style.cssText = "";
          stats.dom.style.position = "static";
          containerRef.current.appendChild(stats.dom);
          console.log("[StatsMonitor] 性能监控面板已初始化");
        }
      } catch (error) {
        console.error("[StatsMonitor] 初始化stats.js失败:", error);
        return cleanup;
      }
    }

    // 动画循环
    const animate = () => {
      if (statsRef.current && isComponentMounted) {
        statsRef.current.begin();
        statsRef.current.end();
        animationFrameRef.current = requestAnimationFrame(animate);
      }
    };

    animate();

    // 组件卸载时清理
    return () => {
      isComponentMounted = false;
      cleanup();
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
