import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';
import { Obstacle, CubeObstacle, CylinderObstacle, TreeObstacle, BuildingObstacle, DynamicObstacle, PoleObstacle } from '@/types/obstacles';
import { SceneManager } from '../SceneManager';

export class ObstacleFactory {
    private static loader = new GLTFLoader();
    
    async create(obstacle: Obstacle): Promise<THREE.Object3D> {
        let object3D: THREE.Object3D;
        
        switch (obstacle.type) {
            case 'CUBE':
                object3D = this.createCube(obstacle);
                break;
            case 'CYLINDER':
                object3D = this.createCylinder(obstacle);
                break;
            case 'TREE':
                object3D = await this.createTree(obstacle);
                break;
            case 'BUILDING':
                object3D = this.createBuilding(obstacle);
                break;
            case 'POLE':
                object3D = this.createPole(obstacle);
                break;
            case 'DYNAMIC':
                object3D = this.createDynamic(obstacle);
                break;
            default:
                throw new Error(`Unsupported obstacle type: ${(obstacle as any).type}`);
        }

        this.setCommonProperties(object3D, obstacle);
        SceneManager.getInstance().addObject({ object: object3D });        return object3D;
    }

    private setCommonProperties(object3D: THREE.Object3D, obstacle: Obstacle) {
        object3D.position.set(...obstacle.position);
        
        if (obstacle.rotation) {
            object3D.rotation.set(
                THREE.MathUtils.degToRad(obstacle.rotation[0]),
                THREE.MathUtils.degToRad(obstacle.rotation[1]),
                THREE.MathUtils.degToRad(obstacle.rotation[2])
            );
        }

        object3D.userData = {
            id: obstacle.id,
            type: obstacle.type,
            ...obstacle.metadata
        };
    }

    private createCube(obstacle: CubeObstacle): THREE.Mesh {
        const { size } = obstacle.feature;
        const geometry = new THREE.BoxGeometry(...size);
        const material = new THREE.MeshStandardMaterial({ color: 0x3498db });
        return new THREE.Mesh(geometry, material);
    }

    private createCylinder(obstacle: CylinderObstacle): THREE.Mesh {
        const { radius, height } = obstacle.feature;
        const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        const material = new THREE.MeshStandardMaterial({ color: 0xe74c3c });
        return new THREE.Mesh(geometry, material);
    }

    private async createTree(obstacle: TreeObstacle): Promise<THREE.Group> {
        const { trunkRadius, canopySize } = obstacle.feature;
        const group = new THREE.Group();
        
        // 树干
        const trunkGeometry = new THREE.CylinderGeometry(
            trunkRadius, trunkRadius, canopySize * 0.6, 8
        );
        const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        
        // 树冠
        const canopyGeometry = new THREE.SphereGeometry(canopySize, 16, 16);
        const canopyMaterial = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = canopySize * 0.6;
        
        group.add(trunk, canopy);
        return group;
    }

    private createBuilding(obstacle: BuildingObstacle): THREE.Mesh {
        const { footprint, floors } = obstacle.feature;
        const height = floors * 3; // 假设每层3米高
        
        const geometry = new THREE.BoxGeometry(footprint[0], height, footprint[1]);
        const material = new THREE.MeshStandardMaterial({ 
            color: 0x708090,
            transparent: true,
            opacity: 0.8
        });
        
        return new THREE.Mesh(geometry, material);
    }

    private createPole(obstacle: PoleObstacle): THREE.Mesh {
        const { height } = obstacle.feature;
        const geometry = new THREE.CylinderGeometry(0.2, 0.2, height, 8);
        const material = new THREE.MeshStandardMaterial({ color: 0x696969 });
        
        const pole = new THREE.Mesh(geometry, material);
        if (obstacle.feature.hasWires) {
            // 可以在这里添加电线逻辑
            pole.userData.hasWires = true;
        }
        return pole;
    }

    private createDynamic(obstacle: DynamicObstacle): THREE.Mesh {
        const geometry = new THREE.BoxGeometry(2, 2, 4);
        const material = new THREE.MeshStandardMaterial({ color: 0xFFA500 });
        
        const mesh = new THREE.Mesh(geometry, material);
        mesh.userData.speed = obstacle.feature.speed;
        mesh.userData.direction = obstacle.feature.direction;
        return mesh;
    }
}