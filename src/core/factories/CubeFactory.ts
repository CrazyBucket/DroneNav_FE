// core/factories/CubeFactory.ts
import * as THREE from 'three';
import type { CubeObstacle } from '@/types/obstacles';

export function createCube(obstacle: CubeObstacle): THREE.Mesh {
  const { size, color } = obstacle.feature;
  
  // 颜色转换优化
  const colorHex = color 
    ? new THREE.Color(color).getHex() 
    : 0x3498db;

  const geometry = new THREE.BoxGeometry(...size);
  const material = new THREE.MeshStandardMaterial({ color: colorHex });

  return new THREE.Mesh(geometry, material);
}
