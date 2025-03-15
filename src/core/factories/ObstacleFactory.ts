import * as THREE from 'three'
import { ObstacleConfig, ObstacleType } from '../models/obstacles/ObstacleTypes';
import { CubeObstacle } from '../models/obstacles/CubeObstacle';
import { SceneManager } from '../SceneManager';

export class ObstacleFactory {
    private static DEFAULT_COLOR = 0xff0000;
    private static DEFAULT_SIZE = 1;

    create(config: ObstacleConfig) {
        const color = config.color
            ? new THREE.Color(config.color).getHex()
            : ObstacleFactory.DEFAULT_COLOR;

        switch (config.type) {
            case 'CUBE':
                return this.createCube({
                    size: config.size ?? ObstacleFactory.DEFAULT_SIZE,
                    color,
                    position: config.position
                });

            case 'SPHERE':
                return this.createSphere({
                    radius: config.size ?? ObstacleFactory.DEFAULT_SIZE,
                    color,
                    position: config.position
                });

            default:
                throw new Error(`Unsupported obstacle type: ${config.type}`);
        }
    }

    private createCube(params: {
        size: number;
        color: number;
        position: [number, number, number];
    }) {
        const obstacle = new CubeObstacle(
            `cube_${Date.now()}`,
            params.size,
            params.color,
            params.position
        );
        SceneManager.getInstance().add(obstacle);
        return obstacle;
    }

    private createSphere(params: {
        radius: number;
        color: number;
        position: [number, number, number];
    }) {
        const obstacle = new SphereObstacle(
            `sphere_${Date.now()}`,
            params.radius,
            params.color,
            params.position
        );
        SceneManager.getInstance().add(obstacle);
        return obstacle;
    }
}