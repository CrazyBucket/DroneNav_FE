import { ObstacleFactory } from "./ObstacleFactory";
import { createCube } from "./CubeFactory";
import { createTree } from "./TreeFactory";
import { createBuilding } from "./BuildingFactories";
import * as THREE from "three";

export function initFactories() {
  // 注册已实现的障碍物工厂
  ObstacleFactory.register("CUBE", obstacle => createCube(obstacle as any));

  ObstacleFactory.register("TREE", obstacle => createTree(obstacle as any));

  ObstacleFactory.register("BUILDING", obstacle =>
    createBuilding(obstacle as any)
  );
}
