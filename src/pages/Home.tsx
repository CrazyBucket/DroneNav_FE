import { useState, useEffect, useRef } from "react";
import { Mosaic, MosaicNode, MosaicParent } from "react-mosaic-component";
import Navbar from "@components/layout/Navbar";
import "react-mosaic-component/react-mosaic-component.css";
import Sidebar from "@/components/layout/Sidebar";
// import { apis } from "@/services/api";
import "./index.css";
import { useScene, SceneProvider } from "../core/SceneContext";
import * as THREE from "three";
import { SceneManager } from "@/core/SceneManager";

type ViewId = "left-pane" | "right-pane";

type AppMosaicNode = MosaicNode<ViewId>;
type AppMosaicParent = MosaicParent<ViewId> & {
  splitPercentage: number;
};

const MIN_PANE_WIDTH = 200; // 最小宽度 200px
const DEFAULT_WIDTH = 300; // 默认宽度 300px

const getSplitPercentage = (widthPx: number) => {
  const viewportWidth = window.innerWidth;
  return Math.min(Math.max((widthPx / viewportWidth) * 100, 0), 100);
};

const getInitialLayout = (): AppMosaicParent => {
  const saved = localStorage.getItem("mosaic-layout");
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (
        typeof parsed === "object" &&
        parsed?.splitPercentage &&
        parsed.direction === "row"
      ) {
        return {
          direction: "row",
          first: "left-pane",
          second: "right-pane",
          splitPercentage: parsed.splitPercentage,
        };
      }
    } catch (e) {
      console.warn("Invalid layout data", e);
    }
  }

  return {
    direction: "row",
    first: "left-pane",
    second: "right-pane",
    splitPercentage: getSplitPercentage(DEFAULT_WIDTH),
  };
};

const HomeContent = () => {
  const [layout, setLayout] = useState<AppMosaicParent>(getInitialLayout());
  const { containerRef } = useScene();
  const sceneManagerRef = useRef<SceneManager | null>(null);

  // useEffect(() => {
  //   const fetchData = async () => {
  //     const res = await apis.getTest();
  //     console.log(res);
  //   };
  //   fetchData();
  // }, []);

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
      setLayout(prev => ({
        ...prev,
        splitPercentage: getSplitPercentage(
          (prev.splitPercentage * window.innerWidth) / 100
        ),
      }));

      // 确保在窗口大小变化时也更新场景尺寸
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
  }, [layout]);

  // 处理布局变更
  const handleLayoutChange = (newNode: AppMosaicNode | null) => {
    if (newNode && typeof newNode !== "string") {
      const validNode = newNode as AppMosaicParent;
      setLayout({
        ...validNode,
        splitPercentage: validNode.splitPercentage,
      });
    }
  };

  useEffect(() => {
    const manager = SceneManager.getInstance(containerRef.current!);
    sceneManagerRef.current = manager;

    // 在useEffect中添加立方体
    const cubeGeometry = new THREE.BoxGeometry(10, 10, 10);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0x00ff00,
      metalness: 0.7,
      roughness: 0.2,
      emissive: 0x004400,
      emissiveIntensity: 0.5,
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.castShadow = true;
    cube.receiveShadow = true;

    const animateCube = () => {
      requestAnimationFrame(animateCube);
    };
    animateCube();

    manager.addObject({
      id: "test-cube",
      object: cube,
      selectable: true,
    });

    return () => {
      manager.removeObject("test-cube");
      sceneManagerRef.current = null;
    };
  }, [containerRef]);

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 relative">
        <Mosaic<ViewId>
          renderTile={id => (
            <div className="h-full">
              {id === "left-pane" ? (
                <Sidebar />
              ) : (
                <div className="h-full">
                  <div
                    id="scene-container"
                    ref={containerRef}
                    style={{ width: "100%", height: "100%" }}
                  />
                </div>
              )}
            </div>
          )}
          value={layout}
          onChange={handleLayoutChange}
          resize={{
            minimumPaneSizePercentage: getSplitPercentage(MIN_PANE_WIDTH),
          }}
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
