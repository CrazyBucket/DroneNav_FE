import { useState, useEffect, useRef } from "react";
import { Mosaic, MosaicNode, MosaicParent } from "react-mosaic-component";
import Navbar from "@components/layout/Navbar";
import "react-mosaic-component/react-mosaic-component.css";
import Sidebar from "@/components/layout/Sidebar";
import "./index.css";
import { useScene, SceneProvider } from "../core/SceneContext";
import { SceneManager } from "@/core/SceneManager";
import {
  DEFAULT_WIDTH,
  LEFT_NAV_WIDTH,
  MIN_PANE_WIDTH,
  SCENE_MIN_WIDTH,
} from "@/store/state";
import Render, { RenderHandle } from "@/components/Render/Render";
import { useSimulationStore } from "@/store/simulationState";
import { useSettingStore } from "@/store/setting";

type ViewId = "left-pane" | "right-pane";
const USER_SPLIT_KEY = "user-split-percentage";
const ANIMATION_DURATION = 300; // 动画时长300ms
const easingFunction = (t: number) => t * (2 - t); // easeOutQuad 缓动函数

type AppMosaicNode = MosaicNode<ViewId>;
type AppMosaicParent = MosaicParent<ViewId> & {
  splitPercentage: number;
};

const getSplitPercentage = (widthPx: number) => {
  const viewportWidth = window.innerWidth;
  return Math.min(Math.max((widthPx / viewportWidth) * 100, 0), 100);
};

const getInitialState = () => {
  const savedLayout = localStorage.getItem("mosaic-layout");
  const isCollapsed = localStorage.getItem("sidebar-collapsed") === "true";
  const userSplit = localStorage.getItem(USER_SPLIT_KEY);

  const calculateValidSplit = (split: number) => {
    // 允许更自由的拖拽，仅确保不会导致布局崩溃
    return Math.min(Math.max(split, 5), 95);
  };

  if (savedLayout) {
    try {
      const parsed = JSON.parse(savedLayout) as AppMosaicParent;
      const baseSplit = isCollapsed
        ? getSplitPercentage(LEFT_NAV_WIDTH)
        : userSplit
        ? parseFloat(userSplit)
        : parsed.splitPercentage;

      return {
        layout: {
          ...parsed,
          splitPercentage: calculateValidSplit(baseSplit),
        },
        collapsed: isCollapsed,
      };
    } catch (e) {
      console.warn("Invalid layout data", e);
    }
  }

  const initialWidth = isCollapsed
    ? LEFT_NAV_WIDTH
    : userSplit
    ? (parseFloat(userSplit) * window.innerWidth) / 100
    : LEFT_NAV_WIDTH + DEFAULT_WIDTH;

  return {
    layout: {
      direction: "row",
      first: "left-pane",
      second: "right-pane",
      splitPercentage: calculateValidSplit(getSplitPercentage(initialWidth)),
    } as AppMosaicParent,
    collapsed: isCollapsed,
  };
};

const HomeContent = () => {
  const [layout, setLayout] = useState<AppMosaicParent>(
    getInitialState().layout
  );
  const [collapsed, setCollapsed] = useState(getInitialState().collapsed);
  const { containerRef } = useScene();
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const isAnimating = useRef(false);
  const renderRef = useRef<RenderHandle>(null);
  const { isLoading } = useSimulationStore();
  const [isReady, setIsReady] = useState(false);
  const { applyAllSettings, followDroneView, firstPersonView, applyViewModes } =
    useSettingStore();

  useEffect(() => {
    const initializeScene = async () => {
      if (!containerRef.current) return;

      try {
        console.log("初始化场景管理器...");
        const manager = SceneManager.getInstance(containerRef.current);
        sceneManagerRef.current = manager;

        // 等待一段时间以确保DOM和Three.js场景完全初始化
        await new Promise(resolve => setTimeout(resolve, 100));

        // 应用所有设置，确保设置在应用程序启动时正确应用
        applyAllSettings();

        // 标记应用程序已准备就绪
        setIsReady(true);
        console.log("场景管理器初始化完成，应用程序准备就绪");
      } catch (error) {
        console.error("初始化场景失败:", error);
      }
    };

    initializeScene();

    return () => {
      console.log("清理场景管理器...");
      sceneManagerRef.current = null;
    };
  }, [containerRef, applyAllSettings]);

  // 确保视角设置在场景加载后正确应用
  useEffect(() => {
    if (isReady && sceneManagerRef.current) {
      // 应用视角设置
      applyViewModes();
      console.log("场景准备就绪后再次应用视角设置:", {
        followDroneView,
        firstPersonView,
      });
    }
  }, [isReady, followDroneView, firstPersonView, applyViewModes]);

  // 监听模拟状态变化时重新应用视角设置
  useEffect(() => {
    if (isReady && !isLoading && sceneManagerRef.current) {
      // 模拟结束后确保视角设置依然生效
      applyViewModes();
    }
  }, [isLoading, isReady, applyViewModes]);

  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (sceneManagerRef.current) {
      const container = document.getElementById("scene-container");
      if (container) {
        // 短暂延迟以确保DOM更新后再刷新场景大小
        setTimeout(() => {
          sceneManagerRef.current?.resize(
            container.clientWidth,
            container.clientHeight
          );
          sceneManagerRef.current?.requestRender();
        }, 10);
      }
    }
  }, [layout.splitPercentage]);

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const currentSplit = layoutRef.current.splitPercentage;

      // 仅在折叠状态下应用最小宽度约束
      if (collapsed) {
        // 计算有效分割比例
        const rightWidth = ((100 - currentSplit) / 100) * viewportWidth;
        let newSplit = currentSplit;
        if (rightWidth < SCENE_MIN_WIDTH) {
          newSplit = Math.max(
            0,
            ((viewportWidth - SCENE_MIN_WIDTH) / viewportWidth) * 100
          );
        }

        setLayout(prev => ({
          ...prev,
          splitPercentage: newSplit,
        }));
      }

      // 更新场景尺寸
      if (sceneManagerRef.current) {
        const container = document.getElementById("scene-container");
        if (container) {
          sceneManagerRef.current.resize(
            container.clientWidth,
            container.clientHeight
          );
        }
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed]);

  // 保存布局
  useEffect(() => {
    localStorage.setItem("mosaic-layout", JSON.stringify(layout));
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [layout, collapsed]);

  const handleCollapse = (newCollapsed: boolean) => {
    const userSplit = localStorage.getItem(USER_SPLIT_KEY);
    const target = newCollapsed
      ? getSplitPercentage(LEFT_NAV_WIDTH)
      : userSplit
      ? parseFloat(userSplit)
      : getSplitPercentage(LEFT_NAV_WIDTH + DEFAULT_WIDTH);

    animateLayout(target);
    setCollapsed(newCollapsed);
    localStorage.setItem("sidebar-collapsed", String(newCollapsed));
  };

  const animateLayout = (targetPercentage: number) => {
    isAnimating.current = true;
    const startTime = Date.now();
    const startPercentage = layoutRef.current.splitPercentage; // 使用 ref 获取最新值
    let animationFrame: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const easedProgress = easingFunction(progress);

      const newPercentage =
        startPercentage + (targetPercentage - startPercentage) * easedProgress;

      setLayout(prev => ({
        ...prev,
        splitPercentage: newPercentage,
      }));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        isAnimating.current = false;

        // 动画结束后，确保场景尺寸得到更新
        if (sceneManagerRef.current) {
          const container = document.getElementById("scene-container");
          if (container) {
            sceneManagerRef.current.resize(
              container.clientWidth,
              container.clientHeight
            );
            sceneManagerRef.current.requestRender();
          }
        }
      }
    };

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      isAnimating.current = false; // 确保在清理时也重置动画状态
    };
  };

  const handleLayoutChange = (newNode: AppMosaicNode | null) => {
    if (isAnimating.current) return;
    if (newNode && typeof newNode !== "string") {
      const validNode = newNode as AppMosaicParent;

      // 存储用户的分割比例，但不强制修改
      if (!collapsed) {
        localStorage.setItem(
          USER_SPLIT_KEY,
          validNode.splitPercentage.toString()
        );
      }

      setLayout(validNode);
    }
  };

  // 监听模拟加载状态变化
  useEffect(() => {
    if (isLoading) {
      console.log("场景加载中...");
    } else {
      console.log("场景加载完成或处于空闲状态");
      // 如果管理器存在，请求重新渲染
      if (sceneManagerRef.current) {
        sceneManagerRef.current.requestRender();
      }
    }
  }, [isLoading]);

  return (
    <div className="h-screen flex flex-col">
      <div className="absolute inset-0 bg-[linear-gradient(-30deg,_#1a3a1a_20%,_#000_80%)] backdrop-blur-[2px] z-0" />
      <div className="relative z-10 flex flex-col h-full">
        <Navbar />
        <div className="flex-1 relative">
          <Mosaic<ViewId>
            renderTile={id => (
              <div className="h-full">
                {id === "left-pane" ? (
                  <Sidebar
                    collapsed={collapsed}
                    onCollapse={handleCollapse}
                    scene={sceneManagerRef.current}
                    renderRef={renderRef}
                  />
                ) : (
                  <div
                    id="scene-container"
                    className="h-full w-full relative overflow-hidden"
                    ref={containerRef}
                  >
                    <Render ref={renderRef} scene={sceneManagerRef.current} />
                  </div>
                )}
              </div>
            )}
            value={layout}
            onChange={handleLayoutChange}
            className="h-full"
            resize={
              collapsed
                ? "DISABLED"
                : {
                    minimumPaneSizePercentage: 5,
                  }
            }
          />
        </div>
      </div>
    </div>
  );
};

const Home = () => {
  return (
    <SceneProvider>
      <HomeContent />
    </SceneProvider>
  );
};

export default Home;
