// src/core/models/BaseObject.ts
import * as THREE from 'three';

export abstract class BaseObject<T extends THREE.Object3D = THREE.Object3D> {
    readonly id: string;
    protected object: T;
    private _isDestroyed = false;

    constructor(id: string, baseObject: T) {
        this.id = id;
        this.object = baseObject;
        this.object.userData = {
            classInstance: this,
            createdAt: Date.now()
        };
    }

    get position(): THREE.Vector3 {
        return this.object.position.clone();
    }

    setPosition(x: number, y: number, z: number): void {
        this.object.position.set(x, y, z);
    }

    abstract update(deltaTime: number): void;

    destroy(): void {
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
        this._isDestroyed = true;
    }

    get isDestroyed(): boolean {
        return this._isDestroyed;
    }
}