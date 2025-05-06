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
    const viewportWidth = window.innerWidth;
    const rightWidth = ((100 - split) / 100) * viewportWidth;
    if (rightWidth < SCENE_MIN_WIDTH) {
      return Math.max(
        0,
        ((viewportWidth - SCENE_MIN_WIDTH) / viewportWidth) * 100
      );
    }
    return split;
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

  useEffect(() => {
    const manager = SceneManager.getInstance(containerRef.current!);
    sceneManagerRef.current = manager;
    const animateCube = () => {
      requestAnimationFrame(animateCube);
    };
    animateCube();
    return () => {
      sceneManagerRef.current = null;
    };
  }, [containerRef]);

  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (sceneManagerRef.current) {
      const container = document.getElementById("scene-container");
      if (container) {
        sceneManagerRef.current.resize(
          container.clientWidth,
          container.clientHeight
        );
      }
    }
  }, [layout.splitPercentage]);

  useEffect(() => {
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const currentSplit = layoutRef.current.splitPercentage;

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
  }, []);

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
        isAnimating.current = false;
      }
    };

    animationFrame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animationFrame); // 返回清理函数
  };

  const handleLayoutChange = (newNode: AppMosaicNode | null) => {
    if (isAnimating.current) return;
    if (newNode && typeof newNode !== "string") {
      const validNode = newNode as AppMosaicParent;
      const viewportWidth = window.innerWidth;
      let newSplit = validNode.splitPercentage;

      // 强制右侧最小宽度
      const rightWidth = ((100 - newSplit) / 100) * viewportWidth;
      if (rightWidth < SCENE_MIN_WIDTH) {
        newSplit = Math.max(
          0,
          ((viewportWidth - SCENE_MIN_WIDTH) / viewportWidth) * 100
        );
      }

      if (!collapsed) {
        localStorage.setItem(USER_SPLIT_KEY, newSplit.toString());
      }

      setLayout({
        ...validNode,
        splitPercentage: newSplit,
      });
    }
  };

  return (
    <div className="h-screen flex flex-col">
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
                />
              ) : (
                <div className="h-full py-2 mr-2 transition-all duration-300">
                  <Render ref={renderRef} />
                </div>
              )}
            </div>
          )}
          value={layout}
          onChange={handleLayoutChange}
          resize={
            collapsed
              ? "DISABLED"
              : {
                  minimumPaneSizePercentage: getSplitPercentage(MIN_PANE_WIDTH),
                }
          }
          className="h-full"
        />
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
