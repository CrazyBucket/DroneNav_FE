import { useState, useEffect } from "react";
import { Mosaic, MosaicNode, MosaicParent } from "react-mosaic-component";
import Navbar from "@components/layout/Navbar";
import "react-mosaic-component/react-mosaic-component.css";
import Sidebar from "@/components/layout/Sidebar";
import { apis } from "@/services/api";

type ViewId = "left-pane" | "right-pane";

type AppMosaicNode = MosaicNode<ViewId>;
type AppMosaicParent = MosaicParent<ViewId> & {
  splitPercentage: number;
};

const MIN_PANE_WIDTH = 200; // 改为固定最小200px
const DEFAULT_WIDTH = 300;

const getSplitPercentage = (widthPx: number) => {
  const viewportWidth = window.innerWidth;
  return Math.min(Math.max((widthPx / viewportWidth) * 100, 0), 100);
};

const getInitialLayout = (): AppMosaicParent => {
  // 从本地存储读取
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

  // 初始化默认
  return {
    direction: "row",
    first: "left-pane",
    second: "right-pane",
    splitPercentage: getSplitPercentage(DEFAULT_WIDTH),
  };
};

const Home = () => {
  const [layout, setLayout] = useState<AppMosaicParent>(getInitialLayout());

  useEffect(() => {
    const fetchData = async () => {
      const res = await apis.getTest();
      console.log(res);
    };
    fetchData();
  }, []);

  // 处理窗口大小变化
  useEffect(() => {
    const handleResize = () => {
      setLayout(prev => ({
        ...prev,
        splitPercentage: getSplitPercentage(
          (prev.splitPercentage * window.innerWidth) / 100
        ),
      }));
    };

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
                <div className="h-full bg-white">右侧主内容区</div>
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

export default Home;
