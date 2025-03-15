import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';

interface SceneObjectParams {
    id: string;
    object: THREE.Object3D;
    selectable?: boolean;
    static?: boolean;
    lodLevels?: [number, THREE.Object3D][];
}

export class SceneManager {
    private static instance: SceneManager;

    private scene: THREE.Scene;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private controls: OrbitControls;
    private raycaster = new THREE.Raycaster();
    private composer?: EffectComposer;

    private objectMap = new Map<string, SceneObjectParams>();
    private staticObjects = new Set<string>();
    private lodObjects = new Map<string, THREE.LOD>();

    private animationCallbacks = new Map<string, FrameRequestCallback>();
    private needsUpdate = true;
    private frameCount = 0;
    private updateInterval = 2;

    private pointerCoords = new THREE.Vector2();
    private lastIntersection: THREE.Intersection | null = null;

    private constructor(private container: HTMLDivElement) {
        this.scene = this.initScene();
        this.camera = this.initCamera();
        this.renderer = this.initRenderer();
        this.controls = this.initControls();
        this.initEventListeners();
        this.initPostProcessing();
        this.tick();
    }

    /* 初始化方法群 */
    private initScene(): THREE.Scene {
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x111111);
        return scene;
    }

    private initCamera(): THREE.PerspectiveCamera {
        const camera = new THREE.PerspectiveCamera(
            75,
            this.container!.clientWidth / this.container!.clientHeight,
            0.1,
            1000
        );
        camera.position.set(50, 50, 50);
        return camera;
    }

    private initRenderer(): THREE.WebGLRenderer {
        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            powerPreference: "high-performance"
        });
        renderer.setSize(this.container!.clientWidth, this.container!.clientHeight);
        renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
        this.container.appendChild(renderer.domElement);
        return renderer;
    }

    private initControls(): OrbitControls {
        const controls = new OrbitControls(this.camera, this.renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
        controls.addEventListener('change', () => this.markNeedsUpdate());
        return controls;
    }

    private initPostProcessing(): void {
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
    }

    /* 核心逻辑 */
    public addObject(params: SceneObjectParams): void {
        const { id, object, selectable = true, static: isStatic = false } = params;

        // 注入元数据
        object.userData = {
            id,
            selectable,
            version: 0
        };

        // LOD处理
        if (params.lodLevels) {
            const lod = new THREE.LOD();
            params.lodLevels.forEach(([distance, obj]) => {
                lod.addLevel(obj, distance);
            });
            this.lodObjects.set(id, lod);
            this.scene.add(lod);
        } else {
            this.scene.add(object);
        }

        // 存储元信息
        this.objectMap.set(id, { ...params, object });
        if (isStatic) this.staticObjects.add(id);

        this.markNeedsUpdate();
    }

    public getObject<T extends THREE.Object3D>(id: string): T | null {
        return this.objectMap.get(id)?.object as T ?? null;
    }

    public updateObject(id: string, updater: (obj: THREE.Object3D) => void): void {
        const params = this.objectMap.get(id);
        if (!params) return;

        updater(params.object);
        params.object.userData.version++;

        if (!this.staticObjects.has(id)) {
            this.markNeedsUpdate();
        }
    }

    public removeObject(id: string): void {
        const params = this.objectMap.get(id);
        if (!params) return;

        // 清理资源
        if (params.lodLevels) {
            params.lodLevels.forEach(([_, obj]) => this.disposeObject(obj));
            this.lodObjects.delete(id);
        } else {
            this.disposeObject(params.object);
        }

        this.objectMap.delete(id);
        this.staticObjects.delete(id);
        this.markNeedsUpdate();
    }

    private disposeObject(obj: THREE.Object3D): void {
        obj.traverse(child => {
            if (child instanceof THREE.Mesh) {
                child.geometry?.dispose();
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material?.dispose();
                }
            }
        });
        this.scene.remove(obj);
    }

    /* 射线检测系统 */
    public getIntersections(): THREE.Intersection[] {
        this.raycaster.setFromCamera(this.pointerCoords, this.camera);
        return this.raycaster.intersectObjects(
            Array.from(this.objectMap.values())
                .filter(p => p.object.userData.selectable)
                .map(p => p.object)
        );
    }

    public getObjectUnderPointer(): THREE.Object3D | null {
        const intersects = this.getIntersections();
        return intersects[0]?.object || null;
    }

    /* 交互事件处理 */
    private initEventListeners(): void {
        // 指针移动追踪
        this.container!.addEventListener('pointermove', e => {
            const rect = this.container!.getBoundingClientRect();
            this.pointerCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            this.pointerCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        });

        // 智能点击检测
        this.container!.addEventListener('click', () => {
            const currentIntersection = this.getIntersections()[0];
            if (this.lastIntersection?.object === currentIntersection?.object) {
                this.dispatchEvent('doubleclick', currentIntersection);
            } else {
                this.dispatchEvent('click', currentIntersection);
            }
            this.lastIntersection = this.getIntersections()[0] ?? null;
        });
    }

    /* 性能优化系统 */
    private markNeedsUpdate(): void {
        this.needsUpdate = true;
    }

    private smartRender(): void {
        if (this.frameCount % this.updateInterval !== 0 && !this.needsUpdate) return;

        if (this.composer) {
            this.composer.render();
        } else {
            this.renderer.render(this.scene, this.camera);
        }
        this.needsUpdate = false;
        this.frameCount++;
    }

    private tick = (): void => {
        requestAnimationFrame(this.tick);

        // 按需更新静态对象
        this.staticObjects.forEach(id => {
            const obj = this.objectMap.get(id)?.object;
            if (obj && obj.userData.version !== obj.userData.lastVersion) {
                obj.updateMatrixWorld();
                obj.userData.lastVersion = obj.userData.version;
            }
        });

        this.controls.update();
        this.smartRender();
    };

    /* 事件系统（示例） */
    private eventHandlers = new Map<string, Function>();
    public on(event: string, handler: Function): void {
        this.eventHandlers.set(event, handler);
    }

    private dispatchEvent(event: string, data?: any): void {
        const handler = this.eventHandlers.get(event);
        if (handler) handler(data);
    }

    /* 扩展方法 */
    public setLODVisibility(id: string, distance: number): void {
        const lod = this.lodObjects.get(id);
        if (lod) {
            lod.update(this.camera);
            lod.getObjectForDistance(distance);
        }
    }

    public batchUpdate(updater: (manager: this) => void): void {
        this.renderer.autoClear = false;
        updater(this);
        this.renderer.autoClear = true;
        this.markNeedsUpdate();
    }

    public static getInstance(container?: HTMLDivElement): SceneManager {
        if (!SceneManager.instance) {
            if (!container) {
                throw new Error("Container is required for initializing SceneManager");
            }
            SceneManager.instance = new SceneManager(container);
        }
        return SceneManager.instance;
    }
}