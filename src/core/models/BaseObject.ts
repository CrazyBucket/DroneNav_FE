// src/core/models/BaseObject.ts
import * as THREE from 'three';
import { ObstacleMetadata } from '../types/obstacles';

export abstract class BaseObject<T extends THREE.Object3D = THREE.Object3D> {
    readonly id: string;
    protected object: T;
    private _isDestroyed = false;
    metadata: ObstacleMetadata;

    constructor(
        id: string, 
        baseObject: T,
        metadata: ObstacleMetadata = {}
    ) {
        this.id = id;
        this.object = baseObject;
        this.metadata = metadata;
        
        this.object.userData = {
            classInstance: this,
            createdAt: Date.now(),
            ...metadata
        };
    }

    get position(): THREE.Vector3 {
        return this.object.position.clone();
    }

    get rotation(): THREE.Euler {
        return this.object.rotation.clone();
    }

    get scale(): THREE.Vector3 {
        return this.object.scale.clone();
    }

    setPosition(x: number, y: number, z: number): this {
        this.object.position.set(x, y, z);
        return this;
    }

    setRotation(x: number, y: number, z: number): this {
        this.object.rotation.set(
            THREE.MathUtils.degToRad(x),
            THREE.MathUtils.degToRad(y),
            THREE.MathUtils.degToRad(z)
        );
        return this;
    }

    setScale(x: number, y: number, z: number): this {
        this.object.scale.set(x, y, z);
        return this;
    }

    abstract update(deltaTime: number): void;

    destroy(): void {
        if (this._isDestroyed) return;
        
        this.object.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });

        if (this.object.parent) {
            this.object.parent.remove(this.object);
        }
        
        this._isDestroyed = true;
    }

    get isDestroyed(): boolean {
        return this._isDestroyed;
    }

    get threeObject(): T {
        return this.object;
    }
}