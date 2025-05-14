import React, { useEffect, useState } from "react";
import { List, Avatar, Spin, Typography, Divider, message } from "antd";
import { PictureOutlined, AppstoreOutlined } from "@ant-design/icons";
import { apis } from "@/services/api";
import { useSimulationStore } from "@/store/simulationState";
import { RenderHandle } from "../Render/Render";
import { SceneManager } from "@/core/SceneManager";
import { loadScene } from "@/core/loadScene";
import { sanitizeText } from "@/utils/security";
import "./style.css"; // 引入样式文件

const { Title, Text } = Typography;

interface SceneInfo {
  id: string;
  name: string;
  description: string;
  object_count: number;
}

interface SceneSelectorProps {
  renderRef?: React.RefObject<RenderHandle>;
}

const SceneSelector: React.FC<SceneSelectorProps> = ({ renderRef }) => {
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isChangingScene, setIsChangingScene] = useState(false);
  const { setIsLoading: setSimulationLoading, isLoading } =
    useSimulationStore();

  // 通过场景ID加载新场景
  const loadSceneById = async (sceneId: string) => {
    console.log(`直接加载场景: ${sceneId}`);

    // 尝试获取SceneManager实例
    let sceneManager: SceneManager;
    try {
      sceneManager = SceneManager.safeGetInstance();
      console.log("成功获取场景管理器实例");
    } catch (error) {
      console.error("获取场景管理器失败:", error);
      throw new Error("场景管理器未初始化");
    }

    // 获取场景数据
    console.log("请求场景数据...");
    const response = await apis.getScene(sceneId);
    console.log(`获取场景数据成功: ${sceneId}`, response);

    if (
      response.status !== "success" ||
      !response.scene ||
      !response.scene.obstacles
    ) {
      throw new Error(`无效的场景数据: ${response.message || "缺少obstacles"}`);
    }

    // 清理当前场景中的所有物体(除了无人机和辅助对象)
    console.log("清理现有场景...");
    const objectsInfo = sceneManager.getAllObjectsInfo();
    for (const obj of objectsInfo) {
      if (!["drone-model", "axes-helper", "debug-sphere"].includes(obj.id)) {
        console.log(`删除场景对象: ${obj.id}`);
        sceneManager.removeObject(obj.id, true); // 强制删除
      }
    }

    // 等待一小段时间确保场景清理完成
    await new Promise(resolve => setTimeout(resolve, 300));

    // 加载新场景
    console.log(
      `开始将 ${response.scene.obstacles.length} 个障碍物加载到场景...`
    );
    await loadScene(response.scene.obstacles, sceneManager);
    console.log("场景加载完成");

    // 请求重新渲染
    sceneManager.requestRender();
  };

  useEffect(() => {
    fetchScenes();
  }, []);

  const fetchScenes = async () => {
    try {
      setLoading(true);
      console.log("正在获取场景列表...");
      const response = await apis.getScenes();

      if (response.status === "success") {
        setScenes(response.scenes);
        console.log(`获取到 ${response.scenes.length} 个场景`);

        // 如果有场景，默认选择第一个
        if (response.scenes && response.scenes.length > 0 && !selectedSceneId) {
          setSelectedSceneId(response.scenes[0]?.id || "");
        }
      } else {
        console.error("获取场景列表失败，状态不是success");
        message.error("获取场景列表失败");
      }
    } catch (error) {
      console.error("获取场景列表失败:", error);
      message.error("无法连接到服务器获取场景列表");
    } finally {
      setLoading(false);
    }
  };

  const handleSceneSelect = async (sceneId: string) => {
    if (selectedSceneId === sceneId || isChangingScene || isLoading) {
      console.log("跳过场景切换：相同场景ID或正在切换中");
      return;
    }

    try {
      setIsChangingScene(true);
      console.log(`开始加载场景: ${sceneId}`);

      // 预先更新选中项，提供更好的用户体验
      setSelectedSceneId(sceneId);

      // 设置全局加载状态
      setSimulationLoading(true);

      // 直接使用loadSceneById方法加载场景
      await loadSceneById(sceneId);

      // 加载完成后的处理
      message.success(`场景「${sceneId}」加载成功`);
    } catch (error) {
      console.error(`加载场景 ${sceneId} 失败:`, error);
      message.error(
        `加载场景失败: ${error instanceof Error ? error.message : "未知错误"}`
      );

      // 恢复以前的选择
      if (selectedSceneId && selectedSceneId !== sceneId) {
        setSelectedSceneId(selectedSceneId);
      }
    } finally {
      // 发生错误时也需要重置加载状态
      setSimulationLoading(false);
      setIsChangingScene(false);
    }
  };

  const getSceneIcon = (scene: SceneInfo) => {
    // 根据场景类型返回不同的图标
    if (scene.id.includes("city")) {
      return (
        <AppstoreOutlined
          style={{
            fontSize: 24,
            color: "#1890ff",
            display: "flex",
            alignItems: "center",
          }}
        />
      );
    } else if (scene.id.includes("park")) {
      return (
        <PictureOutlined
          style={{
            fontSize: 24,
            color: "#52c41a",
            display: "flex",
            alignItems: "center",
          }}
        />
      );
    } else if (scene.id.includes("mountain")) {
      return (
        <PictureOutlined
          style={{
            fontSize: 24,
            color: "#722ed1",
            display: "flex",
            alignItems: "center",
          }}
        />
      );
    }
    return (
      <PictureOutlined
        style={{
          fontSize: 24,
          color: "#faad14",
          display: "flex",
          alignItems: "center",
        }}
      />
    );
  };

  return (
    <div className="h-full">
      <div className="p-3 h-[calc(100%-80px)] overflow-auto">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <Spin tip="加载场景列表..." />
          </div>
        ) : (
          <List
            itemLayout="horizontal"
            dataSource={scenes}
            className="scene-list"
            renderItem={scene => (
              <List.Item
                className={`
                  cursor-pointer transition-all duration-200
                  hover:bg-white/10 rounded-lg mb-2 p-2
                  flex items-center
                  ${selectedSceneId === scene.id ? "bg-white/10" : ""}
                  ${
                    isChangingScene || isLoading
                      ? "opacity-50 pointer-events-none"
                      : ""
                  }
                `}
                onClick={() => handleSceneSelect(scene.id)}
              >
                <List.Item.Meta
                  avatar={
                    <Avatar
                      icon={getSceneIcon(scene)}
                      className="bg-transparent flex items-center ml-4"
                    />
                  }
                  title={
                    <Text className="text-white/90">
                      {sanitizeText(scene.name)}
                    </Text>
                  }
                  description={
                    <Text className="text-white/60 text-xs">
                      {sanitizeText(scene.description)} ({scene.object_count}
                      个物体)
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default SceneSelector;
