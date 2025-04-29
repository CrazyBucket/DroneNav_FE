// core/loadScene.ts
import * as THREE from "three";
import { Obstacle } from "@/types/obstacles";
import { ObstacleFactory } from "./factories/ObstacleFactory";
import { SceneManager } from "./SceneManager";
import { initFactories } from "./factories/InitFactories";

// 坐标系转换器
const coordinateTransformer = {
  ENU: (pos: { x: number; y: number; z: number }) =>
    new THREE.Vector3(pos.x, pos.z, pos.y), // Z轴对应垂直方向
  NED: (pos: { x: number; y: number; z: number }) =>
    new THREE.Vector3(pos.x, pos.z, -pos.y), // 保持Y轴为垂直方向
};

// 智能对象分类器
const objectClassifier = {
  isStatic: (type: Obstacle["type"]) => !["AD", "DY_OBJECT"].includes(type),
  isSelectable: (type: Obstacle["type"]) => !["ROAD", "TREE"].includes(type),
};

export async function loadScene(
  obstacles: Obstacle[],
  sceneManager: SceneManager,
  coordinateSystem: "ENU" | "NED" = "ENU"
): Promise<void> {
  try {
    initFactories();

    // 批量创建障碍物
    const creationPromises = obstacles.map(async obstacle => {
      console.log("obstacle", obstacle);

      // 深拷贝避免数据污染
      const processed = JSON.parse(JSON.stringify(obstacle)) as Obstacle;

      // 执行坐标系转换
      processed.position = coordinateTransformer[coordinateSystem](
        processed.position
      );

      // 创建Three对象
      const obj = ObstacleFactory.create(processed);

      // 添加到场景管理器
      return sceneManager.addObject({
        id: obstacle.id,
        object: await obj,
        static: objectClassifier.isStatic(obstacle.type),
        collidable: true,
      });
    });

    await Promise.all(creationPromises);
    console.log("testScene");
    console.table(sceneManager.getAllObjectsInfo(), [
      "id",
      "type",
      "position",
      "rotation",
      "static",
    ]);
  } catch (error) {
    console.error("Scene loading failed:", error);
    throw new Error(
      `场景加载失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
