// src/core/models/obstacles/CubeObstacle.ts
import { BaseObject } from '../BaseObject';
import * as THREE from 'three';

export class CubeObstacle extends BaseObject<THREE.Mesh> {
    constructor(
        id: string,
        size: number = 1,
        color: number = 0xff0000,
        position: [number, number, number] = [0, 0, 0]
    ) {
        const geometry = new THREE.BoxGeometry(size, size, size);
        const material = new THREE.MeshStandardMaterial({ color });
        super(id, new THREE.Mesh(geometry, material));
        this.object.position.set(...position);
        this.object.userData.type = 'CUBE_OBSTACLE';
    }

    update(deltaTime: number) {
        // 立方体特有的更新逻辑
    }
}