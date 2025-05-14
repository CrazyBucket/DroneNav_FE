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
  console.log(
    `开始加载场景，共 ${obstacles.length} 个障碍物，坐标系: ${coordinateSystem}`
  );

  try {
    // 初始化工厂，确保支持所有类型的障碍物
    initFactories();

    // 批量创建障碍物
    console.log("开始创建障碍物...");
    const creationPromises = obstacles.map(async (obstacle, index) => {
      console.log(
        `处理障碍物 ${index + 1}/${obstacles.length}: ${obstacle.id} (${
          obstacle.type
        })`
      );

      try {
        // 深拷贝避免数据污染
        const processed = JSON.parse(JSON.stringify(obstacle)) as Obstacle;

        // 执行坐标系转换
        processed.position = coordinateTransformer[coordinateSystem](
          processed.position
        );

        // 创建Three对象
        console.log(`为障碍物 ${obstacle.id} 创建3D对象`);
        const obj = await ObstacleFactory.create(processed);

        // 添加到场景管理器
        console.log(`将障碍物 ${obstacle.id} 添加到场景`);
        sceneManager.addObject({
          id: obstacle.id,
          object: obj,
          static: objectClassifier.isStatic(obstacle.type as any),
          collidable: true,
        });

        return obstacle.id;
      } catch (error) {
        console.error(`创建障碍物 ${obstacle.id} 失败:`, error);
        return null;
      }
    });

    const results = await Promise.all(creationPromises);
    const successCount = results.filter(Boolean).length;
    console.log(`障碍物创建完成，成功: ${successCount}/${obstacles.length}`);

    // 日志场景信息
    console.table(sceneManager.getAllObjectsInfo(), [
      "id",
      "type",
      "position",
      "rotation",
      "static",
    ]);

    // 请求场景渲染更新
    sceneManager.requestRender();
  } catch (error) {
    console.error("场景加载失败:", error);
    throw new Error(
      `场景加载失败: ${error instanceof Error ? error.message : "未知错误"}`
    );
  }
}
