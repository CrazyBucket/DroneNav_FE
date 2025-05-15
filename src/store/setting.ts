import { create } from "zustand";
import { SceneManager } from "@/core/SceneManager";
import * as THREE from "three";

interface SettingState {
  showDebugView: boolean;
  toggleDebugView: () => void;
  setDebugView: (show: boolean) => void;

  // 轨迹显示设置
  showPlannedPath: boolean;
  showRealTimePath: boolean;
  setShowPlannedPath: (show: boolean) => void;
  setShowRealTimePath: (show: boolean) => void;

  // 无人机物理设置
  droneSize: { width: number; height: number; depth: number };
  droneSpeed: number;
  followDroneView: boolean;
  firstPersonView: boolean;
  gravityEffect: boolean;
  windEffect: number;
  windDirection: { x: number; y: number; z: number }; // 风向设置

  // 无人机设置方法
  setDroneSize: (size: {
    width: number;
    height: number;
    depth: number;
  }) => void;
  setDroneSpeed: (speed: number) => void;
  setFollowDroneView: (follow: boolean) => void;
  setFirstPersonView: (enabled: boolean) => void;
  setGravityEffect: (enabled: boolean) => void;
  setWindEffect: (value: number) => void;
  setWindDirection: (direction: { x: number; y: number; z: number }) => void;

  // 全局设置应用方法
  applyViewModes: () => void;
  applyPhysicsSettings: () => void;
  applyDroneSize: () => void;
  applyAllSettings: () => void;
}

export const useSettingStore = create<SettingState>((set, get) => ({
  showDebugView: false, // 默认不显示调试视图
  toggleDebugView: () =>
    set(state => ({ showDebugView: !state.showDebugView })),
  setDebugView: (show: boolean) => set({ showDebugView: show }),

  // 轨迹显示设置
  showPlannedPath: true, // 默认显示计划轨迹
  showRealTimePath: true, // 默认显示实时轨迹
  setShowPlannedPath: (show: boolean) => set({ showPlannedPath: show }),
  setShowRealTimePath: (show: boolean) => set({ showRealTimePath: show }),

  // 无人机物理设置（默认值）
  droneSize: { width: 0.25, height: 0.06, depth: 0.2 }, // 默认尺寸与后端匹配
  droneSpeed: 1.0, // 默认速度为1.0
  followDroneView: false, // 默认不跟随无人机视角
  firstPersonView: false, // 默认不启用第一人称视角
  gravityEffect: false, // 默认不考虑重力
  windEffect: 0, // 默认无风效果
  windDirection: { x: 1, y: 0, z: 0 }, // 默认风向：东风（从东向西）

  // 无人机设置方法
  setDroneSize: size => {
    set({ droneSize: size });
    const { applyDroneSize } = get();
    applyDroneSize(); // 自动应用无人机尺寸设置
  },
  setDroneSpeed: speed => {
    set({ droneSpeed: speed });
    get().applyAllSettings(); // 自动应用设置
  },
  setFollowDroneView: follow => {
    set(state => {
      // 如果启用跟随视角，则禁用第一人称视角
      const newState: Partial<
        Pick<SettingState, "followDroneView" | "firstPersonView">
      > = {
        followDroneView: follow,
      };
      if (follow && state.firstPersonView) {
        newState.firstPersonView = false;
      }
      return newState;
    });
    get().applyViewModes(); // 自动应用视角设置
  },
  setFirstPersonView: enabled => {
    set(state => {
      // 如果启用第一人称视角，则禁用跟随视角
      const newState: Partial<
        Pick<SettingState, "firstPersonView" | "followDroneView">
      > = {
        firstPersonView: enabled,
      };
      if (enabled && state.followDroneView) {
        newState.followDroneView = false;
      }
      return newState;
    });
    get().applyViewModes(); // 自动应用视角设置
  },
  setGravityEffect: enabled => {
    set({ gravityEffect: enabled });
    get().applyPhysicsSettings(); // 自动应用物理设置
  },
  setWindEffect: value => {
    set({ windEffect: value });

    // 增强逻辑：先通知状态更新，然后应用物理设置
    setTimeout(() => {
      const state = get();
      const sceneManager = SceneManager.safeGetInstance();

      // 先应用物理设置
      state.applyPhysicsSettings();

      // 确保计划轨迹的风力变体可见
      if (
        value > 0 &&
        state.showPlannedPath &&
        sceneManager.getObject("planned-trajectory")
      ) {
        sceneManager.generateWindTrajectory();
        console.log(`[设置] 风力效果设置为 ${value}，生成风力轨迹`);
      } else if (value <= 0) {
        // 如果风力为0，隐藏风力轨迹
        sceneManager.setTrajectoryVisibility("wind", false);
        console.log(`[设置] 风力效果设置为 ${value}，隐藏风力轨迹`);
      }
    }, 0);
  },

  setWindDirection: direction => {
    set({ windDirection: direction });

    // 增强逻辑：先通知状态更新，然后应用物理设置
    setTimeout(() => {
      const state = get();
      const sceneManager = SceneManager.safeGetInstance();

      // 先应用物理设置
      state.applyPhysicsSettings();

      // 如果风力大于0并且有计划轨迹，则更新风力轨迹
      if (
        state.windEffect > 0 &&
        state.showPlannedPath &&
        sceneManager.getObject("planned-trajectory")
      ) {
        sceneManager.generateWindTrajectory();
        console.log(
          `[设置] 风向设置为 [${direction.x}, ${direction.y}, ${direction.z}]，更新风力轨迹`
        );
      }
    }, 0);
  },

  // 全局设置应用方法
  applyViewModes: () => {
    try {
      const { followDroneView, firstPersonView } = get();
      const sceneManager = SceneManager.safeGetInstance();

      // 视角模式优先级：第一人称 > 跟随视角 > 默认
      if (firstPersonView) {
        sceneManager.setFirstPersonView("drone-model");
        console.log("[设置] 应用第一人称视角");
      } else if (followDroneView) {
        sceneManager.setCameraFollowObject("drone-model");
        console.log("[设置] 应用跟随视角");
      } else {
        sceneManager.resetCameraFollow();
        console.log("[设置] 重置视角为默认");
      }

      // 请求渲染更新
      sceneManager.requestRender();
    } catch (error) {
      console.error("[设置] 应用视角模式失败:", error);
    }
  },

  applyPhysicsSettings: () => {
    try {
      const { gravityEffect, windEffect, windDirection, showPlannedPath } =
        get();
      const sceneManager = SceneManager.safeGetInstance();

      sceneManager.applyPhysicsSettings({
        gravityEnabled: gravityEffect,
        windStrength: windEffect,
        windDirection: new THREE.Vector3(
          windDirection.x,
          windDirection.y,
          windDirection.z
        ).normalize(),
      });
      console.log(
        `[设置] 应用物理设置: 重力=${gravityEffect}, 风力=${windEffect}, 风向=[${windDirection.x}, ${windDirection.y}, ${windDirection.z}]`
      );

      // 控制风力轨迹的可见性 - 只有当有风力且计划轨迹可见时才显示
      const showWindTrajectory = windEffect > 0 && showPlannedPath;
      sceneManager.setTrajectoryVisibility("wind", showWindTrajectory);

      // 请求渲染更新
      sceneManager.requestRender();
    } catch (error) {
      console.error("[设置] 应用物理设置失败:", error);
    }
  },

  applyDroneSize: () => {
    try {
      const { droneSize } = get();
      const sceneManager = SceneManager.safeGetInstance();
      const droneObj = sceneManager.getObject("drone-model");

      if (droneObj) {
        // 应用无人机尺寸（比例缩放）
        const scale = new THREE.Vector3(
          droneSize.width / 0.25, // 相对于默认宽度缩放
          droneSize.height / 0.06, // 相对于默认高度缩放
          droneSize.depth / 0.2 // 相对于默认深度缩放
        );

        sceneManager.setObjectScale("drone-model", scale);
        console.log(`[设置] 应用无人机尺寸: ${JSON.stringify(droneSize)}`);

        // 请求渲染更新
        sceneManager.requestRender();
      }
    } catch (error) {
      console.error("[设置] 应用无人机尺寸失败:", error);
    }
  },

  applyAllSettings: () => {
    try {
      const state = get();
      const sceneManager = SceneManager.safeGetInstance();

      // 应用视角模式
      state.applyViewModes();

      // 应用物理设置
      state.applyPhysicsSettings();

      // 应用无人机尺寸
      state.applyDroneSize();

      // 应用无人机速度
      sceneManager.setDroneSpeed(state.droneSpeed);
      console.log(`[设置] 应用无人机速度: ${state.droneSpeed}`);

      // 设置轨迹可见性
      sceneManager.setTrajectoryVisibility("planned", state.showPlannedPath);
      sceneManager.setTrajectoryVisibility("flight", state.showRealTimePath);

      // 如果有风力且显示计划轨迹，则显示风力轨迹
      const showWindTrajectory = state.windEffect > 0 && state.showPlannedPath;
      sceneManager.setTrajectoryVisibility("wind", showWindTrajectory);

      // 确保生成风力轨迹
      if (state.windEffect > 0) {
        sceneManager.generateWindTrajectory();
      }

      // 请求渲染更新
      sceneManager.requestRender();
      console.log("[设置] 已应用所有设置");
    } catch (error) {
      console.error("[设置] 应用所有设置失败:", error);
    }
  },
}));
