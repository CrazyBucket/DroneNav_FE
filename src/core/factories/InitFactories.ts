import { ObstacleFactory } from "./ObstacleFactory";
import { createCube } from "./CubeFactory";
import { createTree } from "./TreeFactory";
import { createBuilding } from "./BuildingFactories";
import * as THREE from "three";

// 简单的通用障碍物创建函数，用于支持未实现具体工厂的障碍物类型
function createGenericObstacle(obstacle: any): THREE.Object3D {
  console.log(`使用通用处理器创建 ${obstacle.type} 类型障碍物`);

  // 创建一个简单的彩色立方体作为占位符
  const size = 2;
  const geometry = new THREE.BoxGeometry(size, size, size);

  // 为不同类型的障碍物分配不同颜色
  let color: string;
  switch (obstacle.type) {
    case "WATER":
      color = "#4FA4D4"; // 蓝色
      break;
    case "TERRAIN":
      color = "#8B4513"; // 棕色
      break;
    case "CAVE":
      color = "#696969"; // 深灰色
      break;
    case "FOREST":
      color = "#228B22"; // 森林绿
      break;
    case "STRUCTURE":
      color = "#CD853F"; // 木质色
      break;
    default:
      color = "#FF00FF"; // 亮粉色（用于未知类型）
  }

  const material = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geometry, material);

  // 添加标签，表明这是未实现的障碍物类型
  const text = document.createElement("canvas");
  text.width = 256;
  text.height = 128;
  const ctx = text.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(0, 0, 256, 128);
    ctx.font = "24px Arial";
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.fillText(obstacle.type, 128, 64);

    const texture = new THREE.CanvasTexture(text);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.set(0, size / 2 + 1, 0);
    sprite.scale.set(2, 1, 1);
    mesh.add(sprite);
  }

  return mesh;
}

export function initFactories() {
  // 注册已实现的障碍物工厂
  ObstacleFactory.register("CUBE", obstacle => createCube(obstacle as any));

  ObstacleFactory.register("TREE", obstacle => createTree(obstacle as any));

  ObstacleFactory.register("BUILDING", obstacle =>
    createBuilding(obstacle as any)
  );

  // 注册通用处理器，处理其他类型的障碍物
  ObstacleFactory.register("WATER", createGenericObstacle);
  ObstacleFactory.register("TERRAIN", createGenericObstacle);
  ObstacleFactory.register("CAVE", createGenericObstacle);
  ObstacleFactory.register("FOREST", createGenericObstacle);
  ObstacleFactory.register("STRUCTURE", createGenericObstacle);
}
