import { ObstacleFactory } from "./ObstacleFactory";
import { createCube } from "./CubeFactory";
import { Obstacle } from "@/types/obstacles";

export function initFactories() {
  ObstacleFactory.register("CUBE", obstacle =>
    createCube(obstacle as { type: "CUBE" } & Parameters<typeof createCube>[0])
  );
}
