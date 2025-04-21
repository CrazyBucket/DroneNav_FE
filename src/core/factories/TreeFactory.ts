import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/Addons.js";
import type { TreeObstacle } from "@/types/obstacles";

const loader = new GLTFLoader();
const modelCache = new Map<string, THREE.Group>();

export async function createTree(obstacle: TreeObstacle): Promise<THREE.Group> {
  const { model = "tree_1", scale = 1 } = obstacle.feature;
  const position = obstacle.position;
  const rotation = obstacle.rotation;

  // 带缓存的模型加载
  let baseModel = modelCache.get(model);
  if (!baseModel) {
    baseModel = await loader.loadAsync(`/models/${model}.glb`).then(gltf => {
      const model = gltf.scene;
      // 预处理模型材质和阴影
      model.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      return model;
    });
    if (baseModel) modelCache.set(model, baseModel);
  }

  if (!baseModel) throw new Error(`无法加载模型: ${model}`);
  const tree = baseModel.clone();

  // 应用变换
  tree.scale.set(scale, scale, scale);
  tree.position.set(position.x, position.y, position.z);
  if (rotation) {
    tree.rotation.set(
      THREE.MathUtils.degToRad(rotation.pitch),
      THREE.MathUtils.degToRad(rotation.yaw),
      THREE.MathUtils.degToRad(rotation.roll)
    );
  }
  tree.updateMatrixWorld(true);
  const boundingBox = new THREE.Box3().setFromObject(tree);
  const actualSize = new THREE.Vector3();
  boundingBox.getSize(actualSize);

  // 将尺寸存储在 userData 中方便后续使用
  tree.userData.originalSize = actualSize;
  console.log(`模型实际尺寸: ${actualSize.x}x${actualSize.y}x${actualSize.z}`);

  return tree;
}
