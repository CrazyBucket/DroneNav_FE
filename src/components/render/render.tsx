import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { SceneManager } from "@/core/SceneManager";
import { useSettingStore } from "@/store/setting";
import { loadScene } from "@/core/loadScene";
import { apis } from "@/services/api";
import { useCoordinatesStore } from "@/store/coordinates";
import { useSimulationStore } from "@/store/simulationState";
import CircularText from "../CircularText";
import EnergyPanel from "../EnergyPanel";

export type RenderHandle = {
  resize: (width: number, height: number, immediate?: boolean) => void;
  loadScene: (sceneId?: string) => Promise<void>;
};

// 定义组件属性类型
interface RenderProps {
  scene?: SceneManager | null;
  currentSceneId?: string;
}

// 本地加载组件
const RenderLoading = () => {
  const { isLoading, simulationStatus } = useSimulationStore();

  if (!isLoading) {
    return null;
  }

  let loadingText = "LOADING * SCENE * ";
  if (simulationStatus === "planning") {
    loadingText = "PLANNING * PATH * ";
  } else if (simulationStatus === "flying") {
    loadingText = "DRONE * FLYING * ";
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-50 rounded-xl backdrop-blur-sm">
      <CircularText text={loadingText} onHover="speedUp" spinDuration={20} />
    </div>
  );
};

const Render = forwardRef<RenderHandle, RenderProps>(
  ({ scene, currentSceneId }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const sceneManagerRef = useRef<SceneManager | null>(null);
    const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
    const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
    const debugSphereRef = useRef<THREE.Mesh | null>(null);
    const { showDebugView } = useSettingStore();
    const { setCurrentCoordinate } = useCoordinatesStore();
    const [lastLoadedScene, setLastLoadedScene] = useState<string | null>(null);
    const { isLoading, setIsLoading } = useSimulationStore();
    // 添加防抖和尺寸跟踪数据结构
    const resizeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const latestSizeRef = useRef<{ width: number; height: number } | null>(
      null
    );
    const refInitializedRef = useRef(false);
    const refRetryCountRef = useRef(0); // 添加重试计数器
    const MAX_RETRY_COUNT = 3; // 最大重试次数
    const refInitCheckIntervalRef = useRef<ReturnType<
      typeof setInterval
    > | null>(null); // 添加ref检查间隔引用

    // 记录组件ref初始化状态的函数
    const logRefInitialized = useCallback(() => {
      console.log("Render", ref);
    }, [ref]);

    // 清理场景对象的辅助函数
    const clearScene = () => {
      if (!sceneManagerRef.current) {
        console.error("无法清理场景：场景管理器未初始化");
        return;
      }

      try {
        // 获取所有场景对象
        const objectsInfo = sceneManagerRef.current.getAllObjectsInfo();
        const objectsToRemove = [];

        // 先收集需要删除的对象ID
        for (const obj of objectsInfo) {
          // 保留无人机和辅助对象，删除其他所有对象
          if (
            !["drone-model", "axes-helper", "debug-sphere"].includes(obj.id)
          ) {
            objectsToRemove.push(obj.id);
          }
        }
        // 批量删除所有对象
        for (const id of objectsToRemove) {
          sceneManagerRef.current.removeObject(id, true); // 强制删除
        }

        // 最后执行一次垃圾收集以释放内存
        // 注意：window.gc 不是标准 API，这里只是为了某些特定环境
        const w = window as any;
        if (typeof w.gc === "function") {
          try {
            w.gc();
          } catch (e) {
            // 忽略错误
          }
        }

        // 请求渲染更新以确保场景已清空
        sceneManagerRef.current.requestRender();
        console.log("场景清理完成");
      } catch (error) {
        console.error("清理场景时发生错误:", error);
      }
    };

    // 添加带防抖功能的resize处理函数
    const handleResize = useCallback(
      (width: number, height: number, immediate = false) => {
        // 记录尺寸请求到latestSizeRef，无论如何确保保存
        latestSizeRef.current = { width, height };

        // 如果场景管理器未就绪，只记录警告并保存请求
        if (!sceneManagerRef.current) {
          console.warn(
            `[Render] 场景管理器未就绪，缓存尺寸请求: ${width}x${height}`
          );
          return;
        }

        // 如果请求立即执行或者当前没有计划中的resize
        if (immediate) {
          // 清除任何已存在的计时器
          if (resizeTimeoutRef.current) {
            clearTimeout(resizeTimeoutRef.current);
            resizeTimeoutRef.current = null;
          }

          // 执行尺寸调整前记录日志

          try {
            // 直接执行resize
            sceneManagerRef.current.resize(width, height);
          } catch (err) {
            console.error(`[Render] 调整场景大小时出错:`, err);
          }
          return;
        }

        // 防抖处理
        if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
        }

        // 延迟执行实际更新
        resizeTimeoutRef.current = setTimeout(() => {
          if (sceneManagerRef.current && latestSizeRef.current) {
            const { width: finalWidth, height: finalHeight } =
              latestSizeRef.current;
            try {
              sceneManagerRef.current.resize(finalWidth, finalHeight);
            } catch (err) {
              console.error(`[Render] 防抖后调整场景大小时出错:`, err);
            }

            resizeTimeoutRef.current = null;
          }
        }, 100);
      },
      []
    );

    // 加载场景的实现
    const loadSceneById = async (sceneId?: string) => {
      if (!sceneManagerRef.current) {
        console.error("场景管理器未初始化");
        return;
      }

      try {
        setIsLoading(true);
        console.log(`正在加载场景 ID: ${sceneId || "默认"}`);
        // 先清空当前场景
        clearScene();
        // 获取新场景数据
        const res = await apis.getScene(sceneId);
        console.log("API响应:", res);

        if (res.status === "success" && res.scene && res.scene.obstacles) {
          console.log(
            `准备加载新场景，包含 ${res.scene.obstacles.length} 个障碍物`
          );

          // 确保场景中的3D对象已完全移除
          await new Promise(resolve => setTimeout(resolve, 300));

          try {
            // 加载新场景
            console.log("开始加载场景对象...");
            await loadScene(res.scene.obstacles, sceneManagerRef.current);
            console.log("场景对象加载完成");

            // 更新最后加载的场景
            setLastLoadedScene(sceneId || "default");

            // 强制重新渲染场景
            sceneManagerRef.current.requestRender();
            console.log("请求重新渲染场景");
          } catch (loadError) {
            console.error("加载场景对象时出错:", loadError);
            throw loadError;
          }
        } else {
          console.error("无效的场景数据:", res);
          throw new Error("无效的场景数据或缺少障碍物信息");
        }
      } catch (error) {
        console.error("加载场景失败:", error);
        throw error; // 向上传播错误
      } finally {
        // 无论成功或失败，都需要重置加载状态
        setTimeout(() => {
          setIsLoading(false);
          console.log("重置加载状态");

          // 再次请求渲染以确保显示正确
          if (sceneManagerRef.current) {
            sceneManagerRef.current.requestRender();
          }
        }, 700);
      }
    };

    // 添加ref兜底初始化机制
    const ensureRefInitialized = useCallback(() => {
      // 如果ref已经初始化，直接返回
      if (
        refInitializedRef.current &&
        ref &&
        typeof ref === "object" &&
        "current" in ref &&
        ref.current
      ) {
        console.log("[Render] ref已经正确初始化，无需兜底处理");
        return;
      }

      // 如果超过最大重试次数，停止尝试
      if (refRetryCountRef.current >= MAX_RETRY_COUNT) {
        console.error(
          `[Render] ref初始化失败，已达到最大重试次数(${MAX_RETRY_COUNT})`
        );
        return;
      }

      console.log(
        `[Render] 尝试兜底初始化ref (尝试次数: ${
          refRetryCountRef.current + 1
        }/${MAX_RETRY_COUNT})`
      );
      refRetryCountRef.current += 1;

      // 手动重新执行useImperativeHandle的逻辑
      if (ref && typeof ref === "object") {
        try {
          // 创建固定的方法对象，确保引用稳定
          const exposedMethods: RenderHandle = {
            resize: (width: number, height: number, immediate = false) => {
              console.log(
                `[Render] 接收resize调用: ${width}x${height}, immediate=${immediate}`
              );
              handleResize(width, height, immediate);
            },
            loadScene: async (sceneId?: string) => {
              console.log(
                `[Render] 接收loadScene调用, 场景ID: ${sceneId || "默认"}`
              );
              return loadSceneById(sceneId);
            },
          };

          // 直接设置ref.current
          (ref as React.MutableRefObject<RenderHandle>).current =
            exposedMethods;
          refInitializedRef.current = true;
          console.log(
            "[Render] ✅ 通过兜底机制完成Render组件引用初始化:",
            exposedMethods
          );
          logRefInitialized();
        } catch (err) {
          console.error("[Render] 兜底初始化ref过程中出错:", err);
        }
      }
    }, [ref, handleResize, logRefInitialized]);

    // 立即初始化并暴露组件方法
    useImperativeHandle(
      ref,
      () => {
        console.log("[Render] ⚡ 初始化Render组件引用...");
        refInitializedRef.current = true;
        refRetryCountRef.current = 0; // 重置重试计数器

        // 创建固定的方法对象，确保引用稳定
        const exposedMethods: RenderHandle = {
          resize: handleResize,
          loadScene: loadSceneById,
        };

        console.log("[Render] ✅ Render组件引用创建完成:", exposedMethods);
        logRefInitialized();

        return exposedMethods;
      },
      [handleResize, loadSceneById] // 添加必要的依赖
    );

    // 监听ref状态变化，确保ref正确初始化
    useEffect(() => {
      console.log("[Render] 组件已挂载，检查ref初始化状态");
      logRefInitialized();

      // 设置定期检查并自动修复ref初始化问题
      refInitCheckIntervalRef.current = setInterval(() => {
        // 测试ref连接是否正确
        if (ref && typeof ref === "object" && "current" in ref) {
          if (ref.current) {
            // 一切正常，关闭检查
            if (refInitCheckIntervalRef.current) {
              clearInterval(refInitCheckIntervalRef.current);
              refInitCheckIntervalRef.current = null;
              console.log("[Render] ✅ ref连接正确，停止自动检查");
            }
          } else {
            console.warn("[Render] ❌ ref.current为null，尝试重新初始化");
            ensureRefInitialized();
          }
        }
      }, 500);

      // 立即执行一次兜底检查
      setTimeout(() => {
        if (ref && typeof ref === "object" && "current" in ref) {
          if (!ref.current) {
            console.warn(
              "[Render] ❌ 初始挂载后ref.current仍为null，立即尝试重新初始化"
            );
            ensureRefInitialized();
          }
        }
      }, 100);

      return () => {
        console.log("[Render] 组件即将卸载，清理ref检查定时器");
        if (refInitCheckIntervalRef.current) {
          clearInterval(refInitCheckIntervalRef.current);
          refInitCheckIntervalRef.current = null;
        }
      };
    }, [ref, logRefInitialized, ensureRefInitialized]);

    // 初始化场景管理器和模型
    useEffect(() => {
      console.log("[Render] 进入场景初始化useEffect");

      // 确保组件未卸载时才进行初始化
      let isComponentMounted = true;

      if (!containerRef.current) {
        console.warn(
          "[Render] containerRef.current为null，无法初始化场景管理器"
        );
        return;
      }

      console.log("[Render] 开始初始化场景管理器");
      const manager = SceneManager.getInstance(containerRef.current);

      // 只在组件挂载状态下更新ref
      if (isComponentMounted) {
        sceneManagerRef.current = manager;
        console.log("[Render] 场景管理器已初始化并保存到ref");
        logRefInitialized();
      }

      if (manager.getObject("drone-model")) {
        console.log("[Render] 无人机模型已存在，跳过初始化");
        // 即使已存在无人机模型，仍需保存场景管理器引用
        sceneManagerRef.current = manager;
        // 应用缓存的尺寸请求
        if (latestSizeRef.current) {
          const { width, height } = latestSizeRef.current;
          console.log(`[Render] 应用缓存的尺寸请求: ${width}x${height}`);
          manager.resize(width, height);
        }
        return;
      }

      // 保存场景管理器引用
      sceneManagerRef.current = manager;
      console.log("[Render] 场景管理器已初始化并保存到ref");
      logRefInitialized();

      // 如果有缓存的尺寸请求，立即应用
      if (latestSizeRef.current) {
        const { width, height } = latestSizeRef.current;
        console.log(
          `[Render] 场景管理器初始化后，应用缓存的尺寸请求: ${width}x${height}`
        );
        manager.resize(width, height);
      }

      // 创建 GLTFLoader 并设置解码器
      const loader = new GLTFLoader();

      // 初始化 DRACOLoader
      const dracoLoader = new DRACOLoader();
      // 设置 Draco 解码器路径 - 指向 three.js 资源目录
      dracoLoader.setDecoderPath("/draco/");
      // 将 DRACOLoader 附加到 GLTFLoader
      loader.setDRACOLoader(dracoLoader);

      // 初始化 MeshoptDecoder
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        "/models/drone_optimized.glb",
        gltf => {
          const drone = gltf.scene;

          // 添加调试信息 - 打印模型的边界信息
          const box = new THREE.Box3().setFromObject(drone);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          console.log("模型尺寸:", size);
          console.log("模型中心:", center);

          // 创建边界盒辅助对象，使模型更容易看到
          const boxHelper = new THREE.BoxHelper(drone, 0xff0000);
          boxHelperRef.current = boxHelper;
          boxHelper.visible = showDebugView; // 根据设置初始化可见性
          drone.add(boxHelper);

          // 自动处理材质转换
          drone.traverse(child => {
            if (child instanceof THREE.Mesh) {
              child.castShadow = true;
              child.receiveShadow = true;
            }
          });
          const scale = 2;
          // 调整模型显示 - 增加比例并设置位置
          drone.scale.set(scale, scale, scale);
          const initialPosition = { x: 0, y: 0, z: 1 };

          drone.position.set(
            initialPosition.x,
            initialPosition.z,
            initialPosition.y
          );
          setCurrentCoordinate(initialPosition);
          drone.rotation.y = Math.PI / 2;

          // 添加模型到场景
          manager.addObject({
            id: "drone-model",
            object: drone,
            selectable: true,
          });
          // 添加坐标轴辅助对象
          const axesHelper = new THREE.AxesHelper(20);
          axesHelperRef.current = axesHelper;
          axesHelper.visible = showDebugView; // 根据设置初始化可见性
          manager.addObject({
            id: "axes-helper",
            object: axesHelper,
            selectable: false,
          });

          // 模型加载后，再次检查是否有缓存的尺寸请求
          if (latestSizeRef.current) {
            const { width, height } = latestSizeRef.current;
            console.log(
              `[Render] 无人机模型加载后，再次应用缓存的尺寸请求: ${width}x${height}`
            );
            manager.resize(width, height);
          }

          // 加载初始场景
          loadSceneById();
        },
        xhr => {
          // 可以在这里添加加载进度处理
          console.log(
            `模型加载进度: ${((xhr.loaded / xhr.total) * 100).toFixed(2)}%`
          );
        },
        error => {
          console.error("模型加载失败:", error);
        }
      );

      return () => {
        console.log("[Render] 清理场景资源");
        isComponentMounted = false;

        try {
          if (manager) {
            manager.removeObject("drone-model");
            manager.removeObject("debug-sphere");
            manager.removeObject("axes-helper");
          }
        } catch (e) {
          console.warn("[Render] 清理场景资源时出错:", e);
        }

        // 只在组件真正卸载时才清空ref
        if (!isComponentMounted) {
          sceneManagerRef.current = null;
        }
      };
    }, [setCurrentCoordinate, showDebugView, logRefInitialized]);

    // 监听场景ID变化
    useEffect(() => {
      if (
        currentSceneId &&
        currentSceneId !== lastLoadedScene &&
        sceneManagerRef.current
      ) {
        console.log(
          `检测到场景ID变更: ${lastLoadedScene} -> ${currentSceneId}`
        );
        loadSceneById(currentSceneId);
      }
    }, [currentSceneId, lastLoadedScene]);

    // 监听 showDebugView 状态变化以更新调试视图可见性
    useEffect(() => {
      if (boxHelperRef.current) {
        boxHelperRef.current.visible = showDebugView;
      }
      if (axesHelperRef.current) {
        axesHelperRef.current.visible = showDebugView;
      }
      if (debugSphereRef.current) {
        debugSphereRef.current.visible = showDebugView;
      }
    }, [showDebugView]);

    return (
      <div>
        <div
          id="scene-container"
          ref={containerRef}
          className="rounded-xl overflow-hidden h-full w-full relative"
        >
          <RenderLoading />
        </div>
        <EnergyPanel />
      </div>
    );
  }
);

Render.displayName = "Render";

export default Render;
