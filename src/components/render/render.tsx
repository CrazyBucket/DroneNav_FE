import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  useState,
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
  resize: (width: number, height: number) => void;
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

    // 清理场景对象的辅助函数
    const clearScene = () => {
      if (!sceneManagerRef.current) {
        console.error("无法清理场景：场景管理器未初始化");
        return;
      }

      console.log("开始清理场景对象...");

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

        // 记录删除的对象数量
        console.log(`将删除 ${objectsToRemove.length} 个场景对象`);

        // 批量删除所有对象
        for (const id of objectsToRemove) {
          console.log(`删除场景对象: ${id}`);
          sceneManagerRef.current.removeObject(id, true); // 强制删除
        }

        // 最后执行一次垃圾收集以释放内存
        // 注意：window.gc 不是标准 API，这里只是为了某些特定环境
        const w = window as any;
        if (typeof w.gc === "function") {
          try {
            w.gc();
            console.log("已请求垃圾收集");
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

    // 暴露组件方法
    useImperativeHandle(
      ref,
      () => {
        console.log("初始化Render组件引用...");

        // 创建要暴露的对象
        const exposedMethods = {
          resize: (width: number, height: number) => {
            console.log(`调整大小: ${width}x${height}`);
            sceneManagerRef.current?.resize(width, height);
          },
          loadScene: async (sceneId?: string) => {
            console.log(
              `暴露的loadScene方法被调用，场景ID: ${sceneId || "默认"}`
            );
            return loadSceneById(sceneId);
          },
        };

        console.log("Render组件引用创建完成:", exposedMethods);
        return exposedMethods;
      },
      []
    );

    // 添加一个useEffect来监听引用的初始化
    useEffect(() => {
      console.log("Render组件已挂载，准备暴露方法");

      // 如果已经有ref对象传入，立即记录日志
      if (
        ref &&
        typeof ref === "object" &&
        "current" in ref &&
        ref.current !== null
      ) {
        console.log("Render组件ref对象存在:", ref);
      } else {
        console.warn("Render组件ref未提供或格式不正确");
      }

      return () => {
        console.log("Render组件即将卸载");
      };
    }, [ref]);

    useEffect(() => {
      if (!containerRef.current) return;

      const manager = SceneManager.getInstance(containerRef.current);
      if (manager.getObject("drone-model")) return;
      sceneManagerRef.current = manager;

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
        manager.removeObject("drone-model");
        manager.removeObject("debug-sphere");
        manager.removeObject("axes-helper");
        sceneManagerRef.current = null;
      };
    }, []);

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
