import * as THREE from "three";
import { Obstacle } from "@/types/obstacles";

type Creator = (obstacle: Obstacle) => THREE.Object3D | Promise<THREE.Object3D>;

export class ObstacleFactory {
  private static registry = new Map<string, Creator>();

  static register(type: string, creator: Creator) {
    this.registry.set(type, creator);
  }

  static async create(obstacle: Obstacle): Promise<THREE.Object3D> {
    const creator = this.registry.get(obstacle.type);
    if (!creator) throw new Error(`Unregistered type: ${obstacle.type}`);

    const obj = await Promise.resolve(creator(obstacle));
    this.applyCommonProperties(obj, obstacle);
    return obj;
  }

  private static applyCommonProperties(
    obj: THREE.Object3D,
    obstacle: Obstacle
  ) {
    if (!obj.position) throw new Error("传入对象缺少position属性");

    obj.position.set(
      obstacle.position.x,
      obstacle.position.y,
      obstacle.position.z
    );

    if (obstacle.rotation) {
      obj.rotation.set(
        THREE.MathUtils.degToRad(obstacle.rotation.pitch),
        THREE.MathUtils.degToRad(obstacle.rotation.yaw),
        THREE.MathUtils.degToRad(obstacle.rotation.roll)
      );
    }

    obj.userData = {
      id: obstacle.id,
      type: obstacle.type,
      ...obstacle.metadata,
    };
  }
}
