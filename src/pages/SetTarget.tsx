// 定义仿真逻辑函数
const startSimulation = async () => {
  // 获取最新的场景ID - 确保使用当前选择的场景
  const currentSelectedSceneId = useSimulationStore.getState().currentSceneId;

  // 使用lastPositionRef中存储的最后位置作为起点，而不是currentCoordinate
  const startPosition = lastPositionRef.current;

  // 设置加载状态
  setIsLoading(true);
  setSimulationStatus("planning" as SimulationStatus);

  // 应用所有设置（无人机大小、速度等）
  applyAllSettings();

  // 应用视图模式（包括轨迹显示设置）
  applyViewModes();

  // 开启强制渲染，确保轨迹平滑显示
  scene.setForceRender(true);

  // 添加页面可见性监听，确保在页面切换焦点后继续强制渲染
  const enableForcedRender = () => {
    if (document.visibilityState === "visible") {
      scene.setForceRender(true);
    }
  };
  document.addEventListener("visibilitychange", enableForcedRender);

  // 设置无人机速度
  scene.setDroneSpeed(droneSpeed);

  // 配置API参数 - 确保场景ID字段正确设置，使用最新的currentCoordinate
  const params = {
    current: lastPositionRef.current || { x: 0, y: 0, z: 0 },
    target: coordinates,
    speed: droneSpeed,
    droneSize: droneSize,
    scene_id: currentSelectedSceneId || undefined,
  };

  // ... existing code ...
};
