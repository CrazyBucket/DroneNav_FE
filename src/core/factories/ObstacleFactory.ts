import * as THREE from "three";
import { Obstacle } from "@/types/obstacles";

type Creator = (obstacle: Obstacle) => THREE.Object3D | Promise<THREE.Object3D>;

export class ObstacleFactory {
  private static registry = new Map<string, Creator>();

  static register(type: string, creator: Creator) {
    console.log(`注册障碍物工厂: ${type}`);
    this.registry.set(type, creator);
  }

  static async create(obstacle: Obstacle): Promise<THREE.Object3D> {
    try {
      console.log(`创建障碍物: ${obstacle.id}, 类型: ${obstacle.type}`);
      const creator = this.registry.get(obstacle.type);

      if (!creator) {
        console.error(`未注册的障碍物类型: ${obstacle.type}`);
        // 创建默认的错误指示器对象
        const errorGeometry = new THREE.SphereGeometry(1, 16, 8);
        const errorMaterial = new THREE.MeshBasicMaterial({
          color: 0xff00ff,
          wireframe: true,
        });
        const errorMesh = new THREE.Mesh(errorGeometry, errorMaterial);

        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 256;
        labelCanvas.height = 64;
        const ctx = labelCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "black";
          ctx.fillRect(0, 0, 256, 64);
          ctx.font = "16px Arial";
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.fillText(`未知类型: ${obstacle.type}`, 128, 32);

          const texture = new THREE.CanvasTexture(labelCanvas);
          const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
          const sprite = new THREE.Sprite(spriteMaterial);
          sprite.position.y = 2;
          sprite.scale.set(2, 0.5, 1);
          errorMesh.add(sprite);
        }

        this.applyCommonProperties(errorMesh, obstacle);
        return errorMesh;
      }

      const obj = await Promise.resolve(creator(obstacle));
      this.applyCommonProperties(obj, obstacle);
      return obj;
    } catch (error) {
      console.error(`创建障碍物 ${obstacle.id} 失败:`, error);

      // 创建错误指示器
      const errorGeometry = new THREE.BoxGeometry(1, 1, 1);
      const errorMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
      const errorMesh = new THREE.Mesh(errorGeometry, errorMaterial);

      // 添加错误标签
      const labelCanvas = document.createElement("canvas");
      labelCanvas.width = 256;
      labelCanvas.height = 64;
      const ctx = labelCanvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "black";
        ctx.fillRect(0, 0, 256, 64);
        ctx.font = "16px Arial";
        ctx.fillStyle = "white";
        ctx.textAlign = "center";
        ctx.fillText(`错误: ${obstacle.id}`, 128, 32);

        const texture = new THREE.CanvasTexture(labelCanvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.y = 2;
        sprite.scale.set(2, 0.5, 1);
        errorMesh.add(sprite);
      }

      this.applyCommonProperties(errorMesh, obstacle);
      return errorMesh;
    }
  }

  private static applyCommonProperties(
    obj: THREE.Object3D,
    obstacle: Obstacle
  ) {
    if (!obj.position) {
      console.warn(`传入对象 ${obstacle.id} 缺少position属性`);
      return;
    }

    try {
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
    } catch (error) {
      console.error(`应用属性到对象 ${obstacle.id} 失败:`, error);
    }
  }
}
