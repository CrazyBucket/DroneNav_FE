import React, { useState, useEffect, useRef, useCallback } from "react";
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
import { useDrone } from "@/core/DroneContext";

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
    // 获取当前窗口宽度
    const viewportWidth = window.innerWidth;

    // 如果是折叠状态，使用LEFT_NAV_WIDTH而不是MIN_PANE_WIDTH
    const minSplitPercentage = isCollapsed
      ? getSplitPercentage(LEFT_NAV_WIDTH)
      : Math.min((MIN_PANE_WIDTH / viewportWidth) * 100, 45); // 最多占45%，防止过大

    // 确保不会导致布局崩溃
    return Math.min(Math.max(split, minSplitPercentage), 95);
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

  // 确保初始宽度不小于MIN_PANE_WIDTH
  const validInitialWidth = Math.max(initialWidth, MIN_PANE_WIDTH);

  return {
    layout: {
      direction: "row",
      first: "left-pane",
      second: "right-pane",
      splitPercentage: calculateValidSplit(
        getSplitPercentage(validInitialWidth)
      ),
    } as AppMosaicParent,
    collapsed: isCollapsed,
  };
};

const HomeContent: React.FC = () => {
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
  const [resizeMaskVisible, setResizeMaskVisible] = useState(false);
  const resizeMaskTimeout = useRef<ReturnType<typeof setTimeout>>();

  // 获取全局无人机状态
  const { isFlying } = useDrone();

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

  const updateSceneSize = useCallback(() => {
    // 获取容器尺寸，即使renderRef.current暂时不可用也获取
    const container = document.getElementById("scene-container");
    if (!container) {
      console.warn("[Home] 无法找到scene-container元素，无法更新场景大小");
      return;
    }

    const rect = container.getBoundingClientRect();
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);

    // 根据折叠状态决定是否使用最小宽度约束
    // 在折叠状态下，不应该强制最小宽度，应该使用实际宽度
    const validWidth = collapsed ? width : Math.max(width, SCENE_MIN_WIDTH);
    const validHeight = Math.max(height, 100);

    // 记录当前请求的尺寸和renderRef状态
    console.log(
      `[Home] 更新场景尺寸: ${width}x${height} -> ${validWidth}x${validHeight}, 折叠状态: ${collapsed}, renderRef就绪: ${!!renderRef.current}`
    );

    // 显示尺寸调整时的遮罩
    setResizeMaskVisible(true);

    // 延迟执行，错开渲染时机
    setTimeout(() => {
      if (renderRef.current) {
        // 如果renderRef可用，直接调用resize方法
        console.log(`[Home] 调用Render.resize(${validWidth}, ${validHeight})`);
        try {
          renderRef.current.resize(validWidth, validHeight, true);
        } catch (err) {
          console.error("[Home] 调用resize方法出错:", err);
        }
      } else {
        // 如果renderRef尚未准备好，记录日志
        console.warn(`[Home] renderRef.current为null，无法调整大小`);

        // 可以考虑添加尺寸变化到全局变量，使组件在初始化时能获取这些值
        // 或使用MutationObserver监控容器尺寸变化
        console.log(
          `[Home] 将在Render组件可用时自动应用尺寸: ${validWidth}x${validHeight}`
        );
      }

      // 延迟隐藏遮罩
      if (resizeMaskTimeout.current) {
        clearTimeout(resizeMaskTimeout.current);
      }
      resizeMaskTimeout.current = setTimeout(() => {
        setResizeMaskVisible(false);
      }, 300); // 减少遮罩时间，提高响应速度
    }, 50);
  }, [collapsed]);

  // 布局变化时更新场景大小
  useEffect(() => {
    // 等待布局动画完成后再调整大小
    setTimeout(updateSceneSize, 100);
  }, [layout.splitPercentage, updateSceneSize]);

  // 监听窗口大小变化
  useEffect(() => {
    // 计算当前窗口下的最小分割比例
    const calculateMinSplitPercentage = () => {
      const viewportWidth = window.innerWidth;

      // 如果是折叠状态，使用LEFT_NAV_WIDTH而不是MIN_PANE_WIDTH
      return collapsed
        ? getSplitPercentage(LEFT_NAV_WIDTH)
        : Math.min((MIN_PANE_WIDTH / viewportWidth) * 100, 45);
    };

    // 精确计算并限制布局比例
    const handleResize = () => {
      const viewportWidth = window.innerWidth;
      const currentSplit = layoutRef.current.splitPercentage;
      const minSplitPercentage = calculateMinSplitPercentage();

      // 检查是否需要调整左侧面板宽度
      if (currentSplit < minSplitPercentage) {
        console.log(
          `[Home] 窗口大小变化，调整左侧面板比例: ${currentSplit.toFixed(
            2
          )}% -> ${minSplitPercentage.toFixed(2)}%`
        );
        setLayout(prev => ({
          ...prev,
          splitPercentage: minSplitPercentage,
        }));
      }

      // 确保右侧面板不小于最小宽度
      const sceneWidthPercent = 100 - currentSplit;
      const sceneWidthPx = (sceneWidthPercent / 100) * viewportWidth;

      if (sceneWidthPx < SCENE_MIN_WIDTH) {
        // 计算新的分割比例，确保右侧宽度达到最小要求
        const newSplit = Math.max(
          0,
          100 - (SCENE_MIN_WIDTH / viewportWidth) * 100
        );

        // 只在变化明显时更新布局
        if (Math.abs(newSplit - currentSplit) > 0.5) {
          setLayout(prev => ({
            ...prev,
            splitPercentage: newSplit,
          }));
        }
      }

      // 更新场景尺寸但不要立即执行
      setTimeout(updateSceneSize, 100);
    };

    // 添加防抖的窗口尺寸变化处理
    let resizeTimer: ReturnType<typeof setTimeout>;
    const debouncedResize = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(handleResize, 200);
    };

    window.addEventListener("resize", debouncedResize);

    // 初始执行一次
    handleResize();

    return () => {
      window.removeEventListener("resize", debouncedResize);
      clearTimeout(resizeTimer);
    };
  }, [collapsed, updateSceneSize]);

  // 监听面板收起/展开状态变化
  useEffect(() => {
    // 面板状态变化后，给予足够延迟再调整场景大小
    setTimeout(updateSceneSize, 350); // 略大于ANIMATION_DURATION以确保动画完成
  }, [collapsed, updateSceneSize]);

  // 保存布局
  useEffect(() => {
    localStorage.setItem("mosaic-layout", JSON.stringify(layout));
    localStorage.setItem("sidebar-collapsed", String(collapsed));
  }, [layout, collapsed]);

  // 创建一个直接处理场景大小的函数，不依赖于updateSceneSize
  const forceUpdateSceneSize = useCallback(() => {
    if (!renderRef.current) {
      console.warn("[Home] renderRef.current为空，无法强制更新场景大小");
      return;
    }

    try {
      const container = document.getElementById("scene-container");
      if (!container) {
        console.error("[Home] 无法找到scene-container元素");
        return;
      }

      // 通过DOM获取实际容器大小
      const rect = container.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);

      // 根据折叠状态决定是否使用最小宽度约束
      const validWidth = collapsed ? width : Math.max(width, SCENE_MIN_WIDTH);
      const validHeight = Math.max(height, 100);

      console.log(
        `[Home] 强制更新场景大小: 实际=${width}x${height}, 使用=${validWidth}x${validHeight}, 折叠状态: ${collapsed}`
      );

      // 直接调用Render组件的resize方法，并设置immediate为true
      renderRef.current.resize(validWidth, validHeight, true);
    } catch (error) {
      console.error("[Home] 强制更新场景大小时出错:", error);
    }
  }, [renderRef, collapsed]);

  // 处理折叠/展开面板
  const handleCollapse = (newCollapsed: boolean) => {
    // 显示遮罩层但不应阻碍交互
    setResizeMaskVisible(true);

    // 记录变化前的状态用于日志
    const prevCollapsed = collapsed;

    const userSplit = localStorage.getItem(USER_SPLIT_KEY);
    const target = newCollapsed
      ? getSplitPercentage(LEFT_NAV_WIDTH)
      : userSplit
      ? parseFloat(userSplit)
      : getSplitPercentage(LEFT_NAV_WIDTH + DEFAULT_WIDTH);

    // 设置状态
    setCollapsed(newCollapsed);
    localStorage.setItem("sidebar-collapsed", String(newCollapsed));

    console.log(
      `[Home] 面板折叠状态改变: ${prevCollapsed} -> ${newCollapsed}, 目标分割比例: ${target.toFixed(
        2
      )}%`
    );

    // 使用带动画的布局变化
    isAnimating.current = true;
    const startTime = Date.now();
    const startPercentage = layoutRef.current.splitPercentage;
    let animationFrame: number;

    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);
      const easedProgress = easingFunction(progress);

      const newPercentage =
        startPercentage + (target - startPercentage) * easedProgress;

      setLayout(prev => ({
        ...prev,
        splitPercentage: newPercentage,
      }));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(tick);
      } else {
        isAnimating.current = false;

        // 动画结束后多次强制更新场景大小以确保正确
        console.log(`[Home] 折叠动画完成，即将更新场景大小`);

        // 延迟执行，等待布局完全更新
        setTimeout(() => {
          // 连续执行多次强制更新
          forceUpdateSceneSize();

          setTimeout(() => {
            forceUpdateSceneSize();

            setTimeout(() => {
              forceUpdateSceneSize();

              // 最后延迟隐藏遮罩
              setTimeout(() => {
                setResizeMaskVisible(false);
              }, 200);
            }, 300);
          }, 200);
        }, 150);
      }
    };

    animationFrame = requestAnimationFrame(tick);
  };

  const handleLayoutChange = (newNode: AppMosaicNode | null) => {
    if (!newNode || typeof newNode === "string") return;

    // 阻止动画过程中的布局变化
    if (isAnimating.current) return;

    const validNode = newNode as AppMosaicParent;

    // 验证分割百分比
    const viewportWidth = window.innerWidth;
    const minSplitPercentage = collapsed
      ? getSplitPercentage(LEFT_NAV_WIDTH)
      : Math.min((MIN_PANE_WIDTH / viewportWidth) * 100, 45);
    const maxSplitPercentage = 100 - (SCENE_MIN_WIDTH / viewportWidth) * 100;

    // 确保分割比例在有效范围内
    const validSplit = Math.min(
      Math.max(validNode.splitPercentage, minSplitPercentage),
      maxSplitPercentage
    );

    // 只在变化明显时更新布局
    if (Math.abs(validSplit - layout.splitPercentage) > 0.5) {
      setLayout(prev => ({
        ...prev,
        splitPercentage: validSplit,
      }));

      // 保存用户的分割比例
      localStorage.setItem(USER_SPLIT_KEY, validSplit.toString());

      // 立即触发一次场景大小更新
      setTimeout(forceUpdateSceneSize, 50);
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

  // 在组件挂载时添加Mosaic布局变化的监听
  useEffect(() => {
    let isDragging = false;
    let hasResized = false;

    // 监听鼠标按下事件，标记开始拖动
    const handleMouseDown = (e: MouseEvent) => {
      // 检查是否点击在分隔线上
      const target = e.target as HTMLElement;
      if (
        target.classList.contains("mosaic-split") ||
        target.classList.contains("mosaic-split-line")
      ) {
        isDragging = true;
        hasResized = false;
        setResizeMaskVisible(true);
      }
    };

    // 监听鼠标移动事件，处理拖动中
    const handleMouseMove = () => {
      if (isDragging) {
        hasResized = true;

        // 更新遮罩位置，确保它始终只覆盖右侧场景区域
        const mask = document.getElementById("scene-mask");
        if (mask && !collapsed) {
          const width = `calc(100% - ${
            (layout.splitPercentage * window.innerWidth) / 100
          }px)`;
          mask.style.width = width;
        }
      }
    };

    // 监听鼠标释放事件，处理拖动结束
    const handleMouseUp = () => {
      if (!isDragging) return;

      isDragging = false;

      if (hasResized) {
        // 连续多次更新场景大小，确保最终生效
        console.log("[Home] 拖动结束，开始更新场景大小");

        // 立即第一次更新
        forceUpdateSceneSize();

        // 间隔100ms第二次更新
        setTimeout(() => {
          forceUpdateSceneSize();

          // 间隔300ms第三次更新
          setTimeout(() => {
            forceUpdateSceneSize();

            // 完成后延迟隐藏遮罩
            setTimeout(() => {
              setResizeMaskVisible(false);
            }, 200);
          }, 300);
        }, 100);
      } else {
        // 如果没有实际拖动，立即隐藏遮罩
        setResizeMaskVisible(false);
      }
    };

    // 监听窗口大小变化
    const handleWindowResize = () => {
      // 当窗口大小变化时，确保场景大小正确更新
      console.log("[Home] 窗口大小变化");

      // 立即显示遮罩
      setResizeMaskVisible(true);

      // 连续更新几次，确保场景大小正确
      forceUpdateSceneSize();

      setTimeout(() => {
        forceUpdateSceneSize();

        setTimeout(() => {
          forceUpdateSceneSize();
          setResizeMaskVisible(false);
        }, 300);
      }, 200);
    };

    // 添加事件监听器
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", handleWindowResize);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, [forceUpdateSceneSize, layout.splitPercentage, collapsed]);

  // 添加一个效果来确保在飞行状态下场景持续渲染
  useEffect(() => {
    if (isFlying && sceneManagerRef.current) {
      console.log("[Home] 检测到正在飞行，确保场景持续渲染");
      sceneManagerRef.current.setForceRender(true);

      // 创建定时器定期刷新场景
      const renderTimer = setInterval(() => {
        if (sceneManagerRef.current) {
          sceneManagerRef.current.forceRefreshAnimations();
          sceneManagerRef.current.requestRender();
        }
      }, 1000); // 每秒刷新一次

      return () => {
        clearInterval(renderTimer);
      };
    }
  }, [isFlying]);

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
                    // 设置比例约束
                    minimumPaneSizePercentage: Math.min(
                      (MIN_PANE_WIDTH / window.innerWidth) * 100,
                      45
                    ),
                  }
            }
          />
        </div>
      </div>
    </div>
  );
};

const Home: React.FC = () => {
  // 获取无人机全局状态
  const { isFlying } = useDrone();

  return (
    <>
      {/* 添加隐藏的状态指示器，确保全局状态能够在组件中访问 */}
      <div
        style={{ display: "none" }}
        data-drone-flying={isFlying ? "true" : "false"}
      />

      <SceneProvider>
        <HomeContent />
      </SceneProvider>
    </>
  );
};

export default Home;
