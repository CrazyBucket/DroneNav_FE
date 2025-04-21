import { ObstacleFactory } from "./ObstacleFactory";
import { createCube } from "./CubeFactory";
import { createTree } from "./TreeFactory";
import { createBuilding } from "./BuildingFactories";
import { BuildingObstacle } from "@/types/obstacles";

export function initFactories() {
  ObstacleFactory.register("CUBE", obstacle =>
    createCube(obstacle as { type: "CUBE" } & Parameters<typeof createCube>[0])
  );

  ObstacleFactory.register("TREE", obstacle =>
    createTree(obstacle as { type: "TREE" } & Parameters<typeof createTree>[0])
  );

  ObstacleFactory.register("BUILDING", obstacle =>
    createBuilding(obstacle as BuildingObstacle)
  );
}
