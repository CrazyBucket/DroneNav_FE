import { ObstacleFactory } from "./ObstacleFactory";
import { createCube } from "./CubeFactory";
import { createTree } from "./TreeFactory";

export function initFactories() {
  ObstacleFactory.register("CUBE", obstacle =>
    createCube(obstacle as { type: "CUBE" } & Parameters<typeof createCube>[0])
  );

  ObstacleFactory.register("TREE", obstacle =>
    createTree(obstacle as { type: "TREE" } & Parameters<typeof createTree>[0])
  );
}
