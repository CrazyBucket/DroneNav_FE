// src/core/models/obstacles/ObstacleTypes.ts
export type ObstacleType = 'CUBE' | 'SPHERE' | 'CYLINDER';

export type ObstacleConfig = {
    type: ObstacleType;
    position: [number, number, number];
    size?: number;
    color?: string;
    wireframe?: boolean;
};