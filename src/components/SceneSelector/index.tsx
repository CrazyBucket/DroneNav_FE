import React, { useEffect, useState } from "react";
import { List, Avatar, Spin, Typography, Divider, message } from "antd";
import { PictureOutlined, AppstoreOutlined } from "@ant-design/icons";
import * as THREE from "three"; // 添加THREE导入
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

const SceneSelector: React.FC<SceneSelectorProps> = ({}) => {
  const [scenes, setScenes] = useState<SceneInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [isChangingScene, setIsChangingScene] = useState(false);
  const {
    setIsLoading: setSimulationLoading,
    isLoading,
    currentSceneId,
    setCurrentSceneId,
  } = useSimulationStore();

  // 组件挂载时检查全局状态与本地状态的一致性
  useEffect(() => {
    // 确保全局状态中有正确的场景ID
    const checkGlobalState = () => {
      // 如果全局状态为空但本地状态已有选择，则更新全局状态
      if (!currentSceneId && selectedSceneId) {
        console.log(`[SceneSelector] 同步场景ID到全局状态: ${selectedSceneId}`);
        setCurrentSceneId(selectedSceneId);
      }
      // 如果全局状态与本地状态不一致，以全局状态为准
      else if (currentSceneId && currentSceneId !== selectedSceneId) {
        console.log(
          `[SceneSelector] 本地状态(${selectedSceneId})与全局状态(${currentSceneId})不同，以全局状态为准`
        );
        setSelectedSceneId(currentSceneId);
      }
    };

    // 首次检查
    checkGlobalState();

    // 创建一个定时器，定期检查确保状态一致
    const intervalId = setInterval(checkGlobalState, 2000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentSceneId, selectedSceneId, setCurrentSceneId]);

  // 更新选中场景ID的函数
  const updateSelectedSceneId = (sceneId: string) => {
    setSelectedSceneId(sceneId);
    setCurrentSceneId(sceneId); // 同时更新全局状态
  };

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

    try {
      // 先获取所有场景对象信息
      const objectsInfo = sceneManager.getAllObjectsInfo();
      const obstacleIds = objectsInfo
        .filter(
          obj =>
            !["drone-model", "axes-helper", "debug-sphere"].includes(obj.id)
        )
        .map(obj => obj.id);

      console.log(`需要清理 ${obstacleIds.length} 个场景对象`);

      // 使用强制删除模式移除所有对象
      for (const id of obstacleIds) {
        console.log(`删除场景对象: ${id}`);
        sceneManager.removeObject(id, true); // 强制删除
      }

      // 手动请求执行一次渲染，确保场景已被清空
      sceneManager.requestRender();

      // 等待一段时间确保对象被完全删除
      await new Promise(resolve => setTimeout(resolve, 500));

      // 再次检查是否有残留对象
      const remainingObjects = sceneManager
        .getAllObjectsInfo()
        .filter(
          obj =>
            !["drone-model", "axes-helper", "debug-sphere"].includes(obj.id)
        );

      if (remainingObjects.length > 0) {
        console.warn(`警告: 仍有 ${remainingObjects.length} 个对象未被清理`);
        // 再次尝试强制清理
        for (const obj of remainingObjects) {
          console.log(`强制二次清理: ${obj.id}`);
          try {
            // 使用更严格的方式清理
            const object3D = sceneManager.getObject(obj.id);
            if (object3D) {
              // 手动解除所有引用
              object3D.clear();
              // 从父级移除
              if (object3D.parent) {
                object3D.parent.remove(object3D);
              }
              // 分离材质和几何体
              if (object3D instanceof THREE.Mesh) {
                if (object3D.geometry) {
                  object3D.geometry.dispose();
                }
                if (object3D.material) {
                  if (Array.isArray(object3D.material)) {
                    object3D.material.forEach((m: THREE.Material) =>
                      m.dispose()
                    );
                  } else {
                    object3D.material.dispose();
                  }
                }
              }
            }

            // 最后尝试再次通过管理器移除
            sceneManager.removeObject(obj.id, true);
          } catch (e) {
            console.error(`清理对象${obj.id}时出错:`, e);
          }
        }

        // 再次请求渲染
        sceneManager.requestRender();
        await new Promise(resolve => setTimeout(resolve, 300));

        // 如果仍有残留的对象，记录日志但继续加载新场景
        const stillRemaining = sceneManager
          .getAllObjectsInfo()
          .filter(
            obj =>
              !["drone-model", "axes-helper", "debug-sphere"].includes(obj.id)
          );

        if (stillRemaining.length > 0) {
          console.error(
            `警告: 尝试深度清理后仍有 ${stillRemaining.length} 个对象残留`,
            stillRemaining.map(o => o.id)
          );
        }
      }
    } catch (cleanupError) {
      console.error("清理场景对象时出错:", cleanupError);
      // 继续执行，尝试加载新场景
    }

    // 加载新场景
    console.log(
      `开始将 ${response.scene.obstacles.length} 个障碍物加载到场景...`
    );

    try {
      await loadScene(response.scene.obstacles, sceneManager);
      console.log("场景加载完成");

      // 请求重新渲染
      sceneManager.requestRender();

      // 主动触发垃圾回收
      setTimeout(() => {
        try {
          // 使用any类型来处理非标准的gc函数
          const win = window as any;
          if (typeof win.gc === "function") {
            win.gc();
            console.log("已请求垃圾回收");
          }
        } catch (e) {
          // 忽略错误
        }
      }, 1000);
    } catch (loadError) {
      console.error("加载新场景时出错:", loadError);
      throw loadError;
    }
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
      console.log(`[SceneSelector] 开始加载场景: ${sceneId}`);

      // 强制更新全局状态和本地状态
      console.log(
        `[SceneSelector] 更新全局状态currentSceneId: ${currentSceneId} -> ${sceneId}`
      );

      // 使用Promise和重试机制确保状态更新成功
      const updateStateWithRetry = async () => {
        // 更新全局状态 - 使用直接访问store实例的方式更新状态，确保即时生效
        useSimulationStore.setState({ currentSceneId: sceneId });

        // 更新本地状态
        setSelectedSceneId(sceneId);

        // 给状态更新一点时间
        await new Promise(resolve => setTimeout(resolve, 100)); // 增加等待时间

        // 验证状态是否成功更新
        const updatedState = useSimulationStore.getState().currentSceneId;
        if (updatedState !== sceneId) {
          console.warn(
            `[SceneSelector] 状态更新失败！预期=${sceneId}, 实际=${updatedState}`
          );

          // 再次尝试强制更新 - 使用正确的方式调用setState
          useSimulationStore.setState({ currentSceneId: sceneId });
          return false;
        }

        // 添加额外日志便于调试
        console.log(`[SceneSelector] 状态更新成功: ${updatedState}`);
        return true;
      };

      // 尝试最多5次更新状态 (增加重试次数)
      let stateUpdated = false;
      for (let retry = 0; retry < 5 && !stateUpdated; retry++) {
        if (retry > 0) {
          console.log(`[SceneSelector] 第${retry + 1}次尝试更新状态...`);
        }
        stateUpdated = await updateStateWithRetry();

        // 添加重试间隔
        if (!stateUpdated && retry < 4) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }

      if (!stateUpdated) {
        console.error(
          `[SceneSelector] 无法更新场景状态！加载可能使用了错误的场景!`
        );
        // 发出一个错误警告
        message.warning("场景状态更新异常，请重试");
      }

      // 设置全局加载状态
      setSimulationLoading(true);

      // 直接使用loadSceneById方法加载场景
      await loadSceneById(sceneId);

      // 最终确认 - 检查全局状态是否与预期一致
      const finalState = useSimulationStore.getState().currentSceneId;
      if (finalState !== sceneId) {
        console.error(
          `[SceneSelector] 场景加载完成，但状态不一致! 预期=${sceneId}, 实际=${finalState}`
        );
        // 最后一次尝试修复 - 使用正确的方式调用setState
        useSimulationStore.setState({ currentSceneId: sceneId });

        // 验证最后一次修复是否成功
        const lastCheck = useSimulationStore.getState().currentSceneId;
        console.log(`[SceneSelector] 最终状态检查: ${lastCheck}`);
      } else {
        console.log(`[SceneSelector] 状态一致性验证通过: ${sceneId}`);
      }

      // 加载完成后的处理
      message.success(`场景「${sceneId}」加载成功`);
    } catch (error) {
      console.error(`[SceneSelector] 加载场景 ${sceneId} 失败:`, error);
      message.error(
        `加载场景失败: ${error instanceof Error ? error.message : "未知错误"}`
      );

      // 场景加载失败，但仍保持选择的场景ID不变
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
