import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { SceneManager } from "@/core/SceneManager";
import { useSettingStore } from "@/store/setting";
import { loadScene } from "@/core/loadScene";
import { apis } from "@/services/api";

export type RenderHandle = {
  resize: (width: number, height: number) => void;
};

const Render = forwardRef<RenderHandle>((_, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const boxHelperRef = useRef<THREE.BoxHelper | null>(null);
  const axesHelperRef = useRef<THREE.AxesHelper | null>(null);
  const debugSphereRef = useRef<THREE.Mesh | null>(null);
  const { showDebugView } = useSettingStore();

  useImperativeHandle(ref, () => ({
    resize: (width: number, height: number) => {
      sceneManagerRef.current?.resize(width, height);
    },
  }));

  const InitScene = async () => {
    const res = await apis.getScene();
    console.log("API response:", res.scene.obstacles);
    console.log("sceneManagerRef:", sceneManagerRef.current);
    if (sceneManagerRef.current && res.scene.obstacles) {
      await loadScene(res.scene.obstacles, sceneManagerRef.current);
    }
  };

  useEffect(() => {
    if (!containerRef.current) return;

    const manager = SceneManager.getInstance(containerRef.current);
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

        // 调整模型显示 - 增加比例并设置位置
        drone.scale.set(10.0, 10.0, 10.0);
        drone.position.set(0, 15, 0);
        drone.rotation.y = Math.PI / 2;

        // 添加模型到场景
        manager.addObject({
          id: "drone-model",
          object: drone,
          selectable: true,
        });
        // 添加辅助调试物体
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(5, 16, 16),
          new THREE.MeshBasicMaterial({ color: 0xff0000, wireframe: true })
        );
        sphere.position.set(0, 15, 0); // 与无人机同一位置
        debugSphereRef.current = sphere;
        sphere.visible = showDebugView; // 根据设置初始化可见性
        manager.addObject({
          id: "debug-sphere",
          object: sphere,
          selectable: false,
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
        // 调整相机位置以确保更好地观察模型
        const camera = manager.getCamera();
        if (camera) {
          camera.position.set(20, 30, 20);
          camera.lookAt(0, 15, 0); // 看向无人机的位置
        }
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

    InitScene();
    return () => {
      manager.removeObject("drone-model");
      manager.removeObject("debug-sphere");
      manager.removeObject("axes-helper");
      sceneManagerRef.current = null;
    };
  }, []);

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
    <div
      id="scene-container"
      ref={containerRef}
      className="rounded-xl overflow-hidden h-full w-full"
    />
  );
});

Render.displayName = "Render";

export default Render;
