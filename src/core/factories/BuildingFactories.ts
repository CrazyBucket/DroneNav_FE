// core/factories/BuildingFactories.ts
import * as THREE from "three";
import type { BuildingObstacle } from "@/types/obstacles";
import { TextureLoader } from "three";

export async function createBuilding(
  obstacle: BuildingObstacle
): Promise<THREE.Mesh> {
  const { footprint, height, style } = obstacle.feature;

  // 处理贴图风格建筑
  if ("main_texture" in style) {
    const [length, width] = footprint;
    const geometry = new THREE.BoxGeometry(length, height, width);
    // 将几何体原点移动到底部中心（假设场景使用Y轴向上坐标系）
    geometry.translate(0, height / 2, 0);
    // 加载主墙面贴图
    const textureLoader = new TextureLoader();
    try {
      const wallTexture = await textureLoader.loadAsync(
        `/texture/building/${style.main_texture}.jpg`
      );

      if (!wallTexture?.image) {
        throw new Error("贴图资源已加载但内容为空");
      }

      // 配置贴图重复模式
      wallTexture.wrapS = THREE.RepeatWrapping;
      wallTexture.wrapT = THREE.RepeatWrapping;
      const textureScale = 4; // 贴图每重复单元的尺寸（单位：米）
      wallTexture.repeat.set(
        length / textureScale, // X轴方向重复次数 = 建筑长度 / 贴图单元尺寸
        height / textureScale // Y轴方向重复次数 = 建筑高度 / 贴图单元尺寸
      );

      // 添加贴图过滤配置（避免模糊）
      wallTexture.minFilter = THREE.LinearMipmapLinearFilter;
      wallTexture.magFilter = THREE.LinearFilter;

      const materials = [
        new THREE.MeshStandardMaterial({ map: wallTexture }), // 右面
        new THREE.MeshStandardMaterial({ map: wallTexture }), // 左面
        new THREE.MeshStandardMaterial({ color: 0xcccccc }), // 顶面（灰色）
        new THREE.MeshStandardMaterial({ color: 0x666666 }), // 底面（深灰）
        new THREE.MeshStandardMaterial({ map: wallTexture }), // 前面
        new THREE.MeshStandardMaterial({ map: wallTexture }), // 后面
      ];

      const building = new THREE.Mesh(geometry, materials);

      // 添加自定义属性
      building.userData = {
        footprintType: "textured",
        originalFootprint: footprint,
      };

      return building;
    } catch (error) {
      console.error("贴图加载失败:", error);
      throw new Error(`无法加载贴图资源: ${style.main_texture}.jpg`);
    }
  }

  throw new Error("Model-style buildings are not implemented yet");
}
