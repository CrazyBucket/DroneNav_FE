import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { Sky } from "three/examples/jsm/objects/Sky.js";

type EventType = "click" | "doubleclick" | "hover" | "select";
type EventHandler<T = unknown> = (data: T) => void;

interface SceneObjectParams {
  id: string;
  object: THREE.Object3D;
  selectable?: boolean;
  static?: boolean;
  lodLevels?: [number, THREE.Object3D][];
  collidable?: boolean;
}

export class SceneManager {
  private static instance: SceneManager;

  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private controls!: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private composer?: EffectComposer;
  private static _isInitialized = false;
  public static get isInitialized() {
    return this._isInitialized;
  }
  public static safeGetInstance(): SceneManager {
    if (!this.instance) {
      throw new Error("SceneManager must be initialized first");
    }
    return this.instance;
  }
  private objectMap = new Map<string, SceneObjectParams>();
  private staticObjects = new Set<string>();
  private lodObjects = new Map<string, THREE.LOD>();
  private persistentObjects = new Set<string>(); // 跟踪持久对象
  private trajectoryPaths = {
    planned: [] as THREE.Vector3[],
    flight: [] as THREE.Vector3[],
    wind: [] as THREE.Vector3[], // 添加风力轨迹
  };
  private trajectoryVisible = {
    planned: false,
    flight: false,
    wind: false, // 添加风力轨迹可见性控制
  };
  private trajectories = new Map<string, THREE.Object3D>(); // 添加trajectories属性

  private animationCallbacks = new Map<string, FrameRequestCallback>();
  private needsUpdate = true;
  private frameCount = 0;
  private updateInterval = 2;
  private forceRender = false;
  private visibilityChangeHandler: (() => void) | null = null;

  private pointerCoords = new THREE.Vector2();
  private lastIntersection: THREE.Intersection | null = null;
  private markerMap = new Map<string, THREE.Object3D>();
  private clock = new THREE.Clock();
  private animations = new Map<
    string,
    {
      update: (deltaTime: number) => boolean;
      onComplete?: () => void;
    }
  >();

  private droneSpeed = 1.0;
  private followingObjectId: string | null = null;
  private firstPersonMode = false;
  private firstPersonObjectId: string | null = null;
  private physicsSettings = {
    gravityEnabled: false,
    windStrength: 0,
    windDirection: new THREE.Vector3(1, 0, 0), // 默认风向：东风（从东向西）
  };

  private _lastRenderTime = 0;
  private animationFrameId: number | null = null;

  // 添加速度控制相关属性
  private positionQueue: THREE.Vector3[] = []; // 位置队列
  private isMoving = false; // 是否正在移动
  private lastMoveTime = 0; // 上次移动时间
  private moveInterval = 16; // 移动间隔(ms)，约60fps
  private currentTargetIndex = 0; // 当前目标点索引
  private moveDistance = 0.5; // 每次移动的距离单位

  private constructor(private container: HTMLDivElement) {
    if (SceneManager._isInitialized) {
      return;
    }
    this.scene = this.initScene();
    this.camera = this.initCamera();
    this.renderer = this.initRenderer();
    this.controls = this.initControls();
    this.initEventListeners();
    SceneManager._isInitialized = true;
    this.initPostProcessing();
    this.tick();
  }

  public static reset(): void {
    if (SceneManager.instance) {
      // 清理现有实例
      SceneManager.instance.dispose();
      SceneManager.instance = null!;
      SceneManager._isInitialized = false;
    }
  }

  private dispose(): void {
    // 停止渲染循环
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    // 清理资源
    if (this.renderer) {
      this.renderer.dispose();
    }
    if (this.scene) {
      this.scene.clear();
    }
    if (this.controls) {
      this.controls.dispose();
    }
    if (this.composer) {
      this.composer.dispose();
    }

    // 清理事件监听器
    if (this.visibilityChangeHandler) {
      document.removeEventListener(
        "visibilitychange",
        this.visibilityChangeHandler
      );
      this.visibilityChangeHandler = null;
    }

    // 清理其他资源
    this.animations.clear();
    this.animationCallbacks.clear();
    this.eventHandlers.clear();
    this.objectMap.clear();
    this.staticObjects.clear();
    this.lodObjects.clear();
    this.persistentObjects.clear();
    this.trajectoryPaths = {
      planned: [],
      flight: [],
      wind: [],
    };
    this.trajectoryVisible = {
      planned: false,
      flight: false,
      wind: false,
    };
    this.trajectories.clear();
  }

  /* 初始化方法群 */
  private initScene(): THREE.Scene {
    const scene = new THREE.Scene();

    const GROUND_SIZE = 100; // 单位：米
    const TEXTURE_REPEAT = 20 * 10; // 纹理重复次数增加10倍
    const textureLoader = new THREE.TextureLoader();
    const groundTexture = textureLoader.load("/texture/ground/ground.jpg");
    groundTexture.wrapS = THREE.RepeatWrapping;
    groundTexture.wrapT = THREE.RepeatWrapping;
    groundTexture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT); // 修改2：增加纹理重复密度
    groundTexture.anisotropy = 16;

    // 法线贴图设置
    const normalTexture = textureLoader.load("/textures/ground/normal.jpg");
    normalTexture.wrapS = THREE.RepeatWrapping;
    normalTexture.wrapT = THREE.RepeatWrapping;
    normalTexture.repeat.set(TEXTURE_REPEAT, TEXTURE_REPEAT);
    const groundMaterial = new THREE.MeshStandardMaterial({
      map: groundTexture,
      normalMap: normalTexture,
      roughness: 0.8,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const groundGeometry = new THREE.PlaneGeometry(
      GROUND_SIZE,
      GROUND_SIZE,
      100,
      100
    );
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y -= 0.1;

    scene.add(ground);

    const gridHelper = new THREE.GridHelper(100, 50, 0xaaaaaa, 0x666666);
    scene.add(gridHelper);

    const sky = new Sky();
    sky.scale.setScalar(1000);

    // 严格类型检查
    if (sky.material && "uniforms" in sky.material) {
      const uniforms = (sky.material as THREE.ShaderMaterial).uniforms;

      // 设置更明显的太阳效果
      const sunPosition = new THREE.Vector3(0.5, 0.8, -0.5).normalize();
      uniforms["sunPosition"]!.value = sunPosition;
      uniforms["turbidity"]!.value = 3; // 更清晰的天空
      uniforms["rayleigh"]!.value = 1.2; // 适中的蓝色
      uniforms["mieCoefficient"]!.value = 0.005;
      uniforms["mieDirectionalG"]!.value = 0.7; // 更强的太阳光晕

      // 添加更明亮的太阳光源
      const sunLight = new THREE.DirectionalLight(0xfff4e6, 2.0);
      sunLight.position.copy(sunPosition).multiplyScalar(100);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      scene.add(sunLight);
    }

    scene.add(sky);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 调整方向光参数
    const sunLight = new THREE.DirectionalLight(0xfff0e6, 1.0);
    sunLight.position.set(50, 100, 50);
    sunLight.shadow.camera.far = 500;
    scene.add(sunLight);

    const hemisphereLight = new THREE.HemisphereLight(
      0xffffbb, // 天空颜色
      0x080820, // 地面颜色
      0.5 // 强度
    );
    scene.add(hemisphereLight);
    return scene;
  }

  private initCamera(): THREE.PerspectiveCamera {
    const camera = new THREE.PerspectiveCamera(
      75,
      this.container!.clientWidth / this.container!.clientHeight,
      0.1,
      500 // 增大远截面距离以确保可以看到更远的对象
    );
    // 调整相机位置，更好地观察场景中心
    camera.position.set(3, 3, 3);
    camera.lookAt(0, 0, 0); // 让相机看向场景中心
    return camera;
  }

  private initRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(this.container!.clientWidth, this.container!.clientHeight);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    this.container.appendChild(renderer.domElement);
    return renderer;
  }

  private initControls(): OrbitControls {
    const controls = new OrbitControls(this.camera, this.renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1; // 允许更近距离观察
    controls.maxDistance = 1000; // 允许更远距离观察
    controls.maxPolarAngle = Math.PI; // 允许完全翻转视角
    controls.minPolarAngle = 0; // 允许完全俯视
    controls.enablePan = true; // 启用平移
    controls.screenSpacePanning = true; // 使用屏幕空间平移
    controls.addEventListener("change", () => this.markNeedsUpdate());
    return controls;
  }

  private initPostProcessing(): void {
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
  }

  /* 核心逻辑 */
  public addObject(params: SceneObjectParams): void {
    const { id, object, selectable = true, static: isStatic = false } = params;
    if (this.objectMap.has(id)) {
      this.removeObject(id);
    }
    // 注入元数据
    object.userData = {
      id,
      selectable,
      version: 0,
      type: object.type,
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
    return (this.objectMap.get(id)?.object as T) ?? null;
  }

  // 添加获取相机的方法
  public getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  public updateObject(
    id: string,
    updater: (obj: THREE.Object3D) => void
  ): void {
    const params = this.objectMap.get(id);
    if (!params) return;

    updater(params.object);
    params.object.userData.version++;

    if (!this.staticObjects.has(id)) {
      this.markNeedsUpdate();
    }
  }

  public removeObject(id: string, force: boolean = false): void {
    if (
      (id === "planned-trajectory" ||
        id === "flight-trajectory" ||
        id === "wind-trajectory") &&
      !force
    ) {
      return;
    }

    const params = this.objectMap.get(id);
    if (!params) {
      return;
    }

    if (
      !force &&
      (this.persistentObjects.has(id) || params.object.userData.persistent)
    ) {
      return;
    }

    try {
      if (params.lodLevels) {
        params.lodLevels.forEach(([_, obj]) => this.disposeObject(obj));
        this.lodObjects.delete(id);
      } else {
        this.disposeObject(params.object);
      }

      this.objectMap.delete(id);
      this.staticObjects.delete(id);
      this.persistentObjects.delete(id);

      let removedCount = 0;
      this.scene.traverse(child => {
        if (child.userData && child.userData.id === id) {
          if (child.parent) {
            child.parent.remove(child);
            removedCount++;
          }
        }
      });

      this.markNeedsUpdate();
      this.requestRender();
    } catch (error) {
      throw new Error(`移除对象 ${id} 时出错: ${error}`);
    }
  }

  private disposeObject(obj: THREE.Object3D): void {
    if (!obj) {
      return;
    }

    try {
      if (obj.userData && obj.userData.listeners) {
        for (const event in obj.userData.listeners) {
          (obj as any).removeEventListener(
            event as any,
            obj.userData.listeners[event]
          );
        }
      }

      const childrenToRemove = [...obj.children];
      childrenToRemove.forEach(child => {
        this.disposeObject(child);
        obj.remove(child);
      });

      if (obj instanceof THREE.Mesh) {
        if (obj.geometry) {
          obj.geometry.dispose();
          obj.geometry = null!;
        }

        if (Array.isArray(obj.material)) {
          obj.material.forEach(m => {
            this.disposeMaterial(m);
          });
          obj.material.length = 0;
        } else if (obj.material) {
          this.disposeMaterial(obj.material);
        }

        obj.material = null!;
      }

      if (obj.userData && obj.userData.mixer) {
        obj.userData.mixer.stopAllAction();
        obj.userData.mixer.uncacheRoot(obj);
        obj.userData.mixer = null;
      }

      if ("dispose" in obj && typeof (obj as any).dispose === "function") {
        (obj as any).dispose();
      }

      if (obj.parent) {
        obj.parent.remove(obj);
      }

      this.scene.remove(obj);
      obj.userData = {};
      obj.clear();
    } catch (error) {
      throw new Error(`清理对象资源时出错: ${error}`);
    }
  }

  // 新增辅助方法：清理材质和纹理
  private disposeMaterial(material: THREE.Material): void {
    if (!material) return;

    try {
      const mat = material as any;

      if (mat.map && typeof mat.map.dispose === "function") {
        mat.map.dispose();
      }
      if (mat.lightMap && typeof mat.lightMap.dispose === "function") {
        mat.lightMap.dispose();
      }
      if (mat.bumpMap && typeof mat.bumpMap.dispose === "function") {
        mat.bumpMap.dispose();
      }
      if (mat.normalMap && typeof mat.normalMap.dispose === "function") {
        mat.normalMap.dispose();
      }
      if (mat.specularMap && typeof mat.specularMap.dispose === "function") {
        mat.specularMap.dispose();
      }
      if (mat.envMap && typeof mat.envMap.dispose === "function") {
        mat.envMap.dispose();
      }
      if (mat.alphaMap && typeof mat.alphaMap.dispose === "function") {
        mat.alphaMap.dispose();
      }
      if (mat.aoMap && typeof mat.aoMap.dispose === "function") {
        mat.aoMap.dispose();
      }
      if (
        mat.displacementMap &&
        typeof mat.displacementMap.dispose === "function"
      ) {
        mat.displacementMap.dispose();
      }
      if (mat.emissiveMap && typeof mat.emissiveMap.dispose === "function") {
        mat.emissiveMap.dispose();
      }
      if (mat.gradientMap && typeof mat.gradientMap.dispose === "function") {
        mat.gradientMap.dispose();
      }
      if (mat.metalnessMap && typeof mat.metalnessMap.dispose === "function") {
        mat.metalnessMap.dispose();
      }
      if (mat.roughnessMap && typeof mat.roughnessMap.dispose === "function") {
        mat.roughnessMap.dispose();
      }

      material.dispose();
    } catch (error) {
      throw new Error(`清理材质时出错: ${error}`);
    }
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

  public getAllObjectsInfo() {
    return Array.from(this.objectMap.values()).map(
      ({ id, object, static: isStatic }) => ({
        id,
        type: object.userData.type || "unknown",
        position: object.position.toArray(),
        rotation: object.rotation
          ? {
              x: THREE.MathUtils.radToDeg(object.rotation.x),
              y: THREE.MathUtils.radToDeg(object.rotation.y),
              z: THREE.MathUtils.radToDeg(object.rotation.z),
            }
          : null,
        metadata: object.userData.metadata || {},
        static: isStatic,
        scale: object.scale.toArray(),
      })
    );
  }

  /* 交互事件处理 */
  private initEventListeners(): void {
    // 指针移动追踪
    this.container!.addEventListener("pointermove", e => {
      const rect = this.container!.getBoundingClientRect();
      this.pointerCoords.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointerCoords.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });

    // 智能点击检测
    this.container!.addEventListener("click", () => {
      const currentIntersection = this.getIntersections()[0];
      if (this.lastIntersection?.object === currentIntersection?.object) {
        this.dispatchEvent("doubleclick", currentIntersection);
      } else {
        this.dispatchEvent("click", currentIntersection);
      }
      this.lastIntersection = this.getIntersections()[0] ?? null;
    });
  }
  /* 性能优化系统 */
  private markNeedsUpdate(): void {
    this.needsUpdate = true;
  }

  /**
   * 请求场景重新渲染
   * 提供给外部组件使用
   */
  public requestRender(): void {
    this.markNeedsUpdate();
  }

  private tick = (): void => {
    try {
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
      }
      this.animationFrameId = requestAnimationFrame(this.tick);

      const delta = this.clock.getDelta();

      this.frameCount++;
      const lowPriorityUpdateInterval = 3;
      const mediumPriorityUpdateInterval = 2;

      if (this.animations.size > 0) {
        const completedAnimations: string[] = [];
        const completionCallbacks: Array<() => void> = [];

        this.animations.forEach((animation, key) => {
          try {
            const completed = animation.update(delta);
            if (completed) {
              completedAnimations.push(key);
              if (typeof animation.onComplete === "function") {
                completionCallbacks.push(animation.onComplete);
              }
            }
          } catch (error) {
            throw new Error(`动画'${key}'执行出错: ${error}`);
          }
        });

        if (completedAnimations.length > 0) {
          completedAnimations.forEach(key => this.animations.delete(key));
          if (completionCallbacks.length > 0) {
            setTimeout(() => {
              completionCallbacks.forEach(callback => callback());
            }, 0);
          }
        }

        this.markNeedsUpdate();
      }

      const highPriorityCallbacks = ["firstPersonView", "cameraFollow"];
      highPriorityCallbacks.forEach(key => {
        const callback = this.animationCallbacks.get(key);
        if (callback) callback(0);
      });

      if (this.frameCount % mediumPriorityUpdateInterval === 0) {
        this.animationCallbacks.forEach((callback, key) => {
          if (!highPriorityCallbacks.includes(key)) {
            callback(0);
          }
        });
      }

      if (this.frameCount % lowPriorityUpdateInterval === 0) {
        this.ensureViewModes();
      }

      this.smartRender();
    } catch (error) {
      throw new Error(`帧处理发生错误: ${error}`);
    }
  };

  // 优化的智能渲染方法
  private smartRender(): void {
    // 优化渲染逻辑，减少不必要的渲染
    const now = performance.now();
    const timeSinceLastRender = now - this._lastRenderTime;

    // 强制渲染模式：按照合理的帧率渲染
    if (this.forceRender) {
      // 使用默认的60fps(约16.7ms)限制渲染频率，避免过度渲染
      if (timeSinceLastRender >= 16) {
        this.doRender();
        this._lastRenderTime = now;
        this.needsUpdate = false; // 重置更新标记
      }
      return;
    }

    // 非强制模式：只在需要更新且满足最小间隔时才渲染
    const minRenderInterval = 16; // 约等于60fps，单位毫秒
    const maxIdleRenderInterval = 300; // 空闲状态最大渲染间隔

    if (
      (this.needsUpdate && timeSinceLastRender > minRenderInterval) ||
      // 即使没有needsUpdate标记，也应该偶尔渲染以保持UI响应
      timeSinceLastRender > maxIdleRenderInterval
    ) {
      this.doRender();
      this._lastRenderTime = now;
      this.needsUpdate = false; // 重置更新标记
    }
  }

  // 提取渲染代码，避免重复
  private doRender(): void {
    if (!this.scene || !this.camera || !this.renderer) return;

    if (this.composer) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  private eventHandlers = new Map<EventType, Set<EventHandler>>();

  /**
   * 设置物体位置
   * @param id 物体ID
   * @param position 三维坐标
   */
  public setObjectPosition(id: string, position: THREE.Vector3): void {
    this.updateObject(id, obj => {
      obj.position.copy(position);
    });
  }

  /**
   * 平滑移动物体到指定位置
   * @param id 物体ID
   * @param targetPosition 目标位置
   * @param duration 移动时长（秒）
   */
  public animateToPosition(
    id: string,
    targetPosition: THREE.Vector3,
    duration: number = 1
  ): Promise<void> {
    return new Promise(resolve => {
      const obj = this.getObject(id);
      if (!obj) {
        return resolve();
      }

      const startPosition = obj.position.clone();
      const distance = startPosition.distanceTo(targetPosition);
      const startTime = this.clock.getElapsedTime();
      const animationKey = `move_${id}_${Date.now()}`;

      const customEasing = (t: number): number => {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      };

      this.animations.set(animationKey, {
        update: () => {
          const elapsed = this.clock.getElapsedTime() - startTime;
          const rawProgress = Math.min(elapsed / duration, 1);

          const progress = customEasing(rawProgress);

          const newPosition = new THREE.Vector3().lerpVectors(
            startPosition,
            targetPosition,
            progress
          );

          obj.position.copy(newPosition);

          if (this.frameCount % 3 === 0) {
            this.ensureViewModes();
          }

          if (rawProgress >= 1) {
            obj.position.copy(targetPosition);
            this.animations.delete(animationKey);
            resolve();
            return false;
          }

          return true;
        },
        onComplete: resolve,
      });
    });
  }

  /**
   * 设置物体旋转（欧拉角）
   * @param id 物体ID
   * @param rotation 三维旋转角度（弧度）
   */
  public setObjectRotation(id: string, rotation: THREE.Euler): void {
    this.updateObject(id, obj => {
      obj.rotation.copy(rotation);
    });
  }

  /**
   * 设置物体缩放
   * @param id 物体ID
   * @param scale 三维缩放比例
   */
  public setObjectScale(id: string, scale: THREE.Vector3): void {
    this.updateObject(id, obj => {
      obj.scale.copy(scale);
    });
  }

  // 在SceneManager类中添加以下扩展
  private flightQueue: THREE.Vector3[] = [];
  private isAnimating = false;

  /**
   * 设置无人机速度
   * @param speed 速度倍率
   */
  public setDroneSpeed(speed: number): void {
    this.droneSpeed = Math.max(0.1, Math.min(10, speed));
    this.moveInterval = 100 / this.droneSpeed;
  }

  /**
   * 设置第一人称视角
   * @param objectId 要使用第一人称视角的物体ID
   */
  public setFirstPersonView(objectId: string): void {
    try {
      const obj = this.getObject(objectId);
      if (!obj) {
        return;
      }

      this.resetCameraFollow();

      this.firstPersonMode = true;
      this.firstPersonObjectId = objectId;

      // 在第一人称视角下隐藏无人机模型
      this.setObjectVisibility(objectId, false);

      this.updateFirstPersonView(true);

      this.configureFirstPersonControls();

      const updateCamera = () => {
        if (!this.firstPersonMode || !this.firstPersonObjectId) return;
        this.updateFirstPersonView();
      };

      this.animationCallbacks.set("firstPersonView", updateCamera);

      this.markNeedsUpdate();
      this.forceRender = true;
    } catch (error) {
      throw new Error(`设置第一人称视角时出错: ${error}`);
    }
  }

  /**
   * 为第一人称视角配置控制器
   * 允许鼠标控制视角旋转，但不控制位置
   */
  private configureFirstPersonControls(): void {
    if (this.controls) {
      // 启用旋转，禁用其他功能
      this.controls.enabled = true;
      this.controls.enableZoom = false; // 禁用缩放
      this.controls.enablePan = false; // 禁用平移
      this.controls.enableRotate = true; // 启用旋转
      this.controls.enableDamping = true; // 启用阻尼效果使旋转更平滑

      // 限制垂直旋转角度
      this.controls.minPolarAngle = Math.PI * 0.1; // 限制仰角
      this.controls.maxPolarAngle = Math.PI * 0.9; // 限制俯角

      // 设置旋转速度
      this.controls.rotateSpeed = 0.5;

      // 确保控制器不会自动更新目标
      this.controls.target = new THREE.Vector3(0, 0, -1)
        .applyQuaternion(this.camera.quaternion)
        .add(this.camera.position);
    }
  }

  /**
   * 更新第一人称视角相机位置
   * @private
   * @param forceLog 是否强制输出日志
   */
  private updateFirstPersonView(forceLog: boolean = false): void {
    if (!this.firstPersonMode || !this.firstPersonObjectId) return;

    try {
      const droneModel = this.getObject(this.firstPersonObjectId);
      if (!droneModel) {
        if (forceLog) {
          this.resetCameraFollow();
        }
        return;
      }

      const dronePosition = droneModel.position.clone();
      const droneQuaternion = droneModel.quaternion.clone();

      const cameraOffset = new THREE.Vector3(0, 0.1, -0.2);

      cameraOffset.applyQuaternion(droneQuaternion);

      const cameraPosition = new THREE.Vector3().addVectors(
        dronePosition,
        cameraOffset
      );

      const currentRotation = this.camera.quaternion.clone();
      this.camera.position.copy(cameraPosition);

      const lookDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
        currentRotation
      );
      this.controls.target.copy(cameraPosition.clone().add(lookDirection));

      this.camera.updateProjectionMatrix();
      this.camera.updateMatrixWorld();

      this.controls.update();

      this.markNeedsUpdate();
      this.forceRender = true;
    } catch (error) {
      throw new Error(`更新第一人称视角时出错: ${error}`);
    }
  }

  /**
   * 确保视角跟随状态在全局持续生效
   * 此方法应该被定期调用，例如在动画循环或状态更新时
   */
  public ensureViewModes(): void {
    // 优化：降低调用频率，不需要每帧都检查
    if (this.frameCount % 10 !== 0) return; // 更新为每10帧检查一次，减少开销

    // 如果没有活跃的视角模式，直接返回
    if (!this.firstPersonMode && !this.followingObjectId) return;

    // 检查第一人称模式
    if (this.firstPersonMode && this.firstPersonObjectId) {
      this.updateFirstPersonView();
    }
    // 检查跟随模式
    else if (this.followingObjectId) {
      this.updateCameraFollow();
    }
  }

  /**
   * 取消相机跟随或第一人称视角
   */
  public resetCameraFollow(): void {
    const wasInFirstPerson = this.firstPersonMode;
    const wasFollowing = this.followingObjectId !== null;

    this.animationCallbacks.delete("cameraFollow");
    this.animationCallbacks.delete("firstPersonView");

    // 如果正在第一人称视角模式，退出时显示无人机模型
    if (wasInFirstPerson && this.firstPersonObjectId) {
      this.setObjectVisibility(this.firstPersonObjectId, true);
    }

    this.followingObjectId = null;
    this.firstPersonMode = false;
    this.firstPersonObjectId = null;

    if (this.controls) {
      this.controls.enabled = true;
      this.controls.enableZoom = true;
      this.controls.enablePan = true;
      this.controls.enableRotate = true;
      this.controls.enableDamping = true;
      this.controls.maxPolarAngle = Math.PI;
      this.controls.minPolarAngle = 0;
      this.controls.rotateSpeed = 1.0;
    }

    this.markNeedsUpdate();
    this.requestRender();
  }

  /**
   * 设置相机跟随指定物体（第三人称视角）
   * @param objectId 要跟随的物体ID
   */
  public setCameraFollowObject(objectId: string): void {
    if (this.firstPersonMode) {
      this.resetCameraFollow();
    }

    const obj = this.getObject(objectId);
    if (!obj) {
      return;
    }

    this.followingObjectId = objectId;

    if (!this.animationCallbacks.has("cameraFollow")) {
      this.animationCallbacks.set("cameraFollow", () =>
        this.updateCameraFollow()
      );
    }

    this.updateCameraFollow();
  }

  /**
   * 更新相机跟随位置（第三人称）
   * @private
   */
  private updateCameraFollow(): void {
    if (!this.followingObjectId) return;

    const obj = this.getObject(this.followingObjectId);
    if (!obj) {
      this.resetCameraFollow();
      return;
    }

    const objectPosition = obj.position.clone();
    const objectDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      obj.quaternion
    );

    const cameraPosition = objectPosition
      .clone()
      .sub(objectDirection.multiplyScalar(5))
      .add(new THREE.Vector3(0, 2, 0));

    this.camera.position.copy(cameraPosition);

    const lookAtPosition = objectPosition
      .clone()
      .add(new THREE.Vector3(0, 0.1, 0));
    this.camera.lookAt(lookAtPosition);

    this.controls.target.copy(lookAtPosition);

    this.controls.enabled = false;

    this.markNeedsUpdate();

    this.requestRender();
  }

  /**
   * 应用物理系统设置
   * @param settings 物理设置选项
   */
  public applyPhysicsSettings(settings: {
    gravityEnabled: boolean;
    windStrength: number;
    windDirection?: THREE.Vector3;
  }): void {
    this.physicsSettings.gravityEnabled = settings.gravityEnabled;
    this.physicsSettings.windStrength = settings.windStrength;

    if (settings.windDirection) {
      this.physicsSettings.windDirection = settings.windDirection
        .clone()
        .normalize();
    }

    this.generateWindTrajectory();
  }

  /**
   * 增强版动画方法 - 支持连续路径
   * @param id 物体ID
   * @param target 目标位置
   * @param options 配置参数
   */
  public async smartAnimate(
    id: string,
    target: THREE.Vector3,
    options: {
      duration?: number;
      lookAtTarget?: boolean;
      addToQueue?: boolean;
      applyPhysics?: boolean;
    } = {}
  ): Promise<void> {
    const obj = this.getObject(id);
    if (!obj) {
      return;
    }

    const {
      duration = 1 / this.droneSpeed,
      lookAtTarget = true,
      addToQueue = false,
      applyPhysics = true,
    } = options;

    const startTime = performance.now();

    if (addToQueue) {
      this.flightQueue.push(target);
      if (!this.isAnimating) this.processQueue(id);
      return;
    }

    this.isAnimating = true;

    if (applyPhysics) {
      this.applySimulatedPhysics(id, target);
    }

    if (lookAtTarget) {
      const startRotation = obj.rotation.clone();
      const targetRotation = this.calculateLookAt(obj.position, target);

      const rotationDuration = Math.min(duration * 0.4, 0.3);

      await this.animateRotation(
        id,
        startRotation,
        targetRotation,
        rotationDuration
      );
    }

    await this.animateToPosition(id, target, duration);

    try {
      // 使用当前轨迹可见性设置，而不是强制设为可见
      // this.setTrajectoryVisibility("flight", true);
      this.addFlightPoint(target.clone());
      this.ensureViewModes();
    } catch (error) {
      throw new Error(`添加飞行轨迹点失败: ${error}`);
    }

    this.isAnimating = false;
  }

  /**
   * 应用模拟的物理效果（不实际改变飞行路径）
   * @param id 物体ID
   * @param target 目标位置
   * @private
   */
  private applySimulatedPhysics(id: string, target: THREE.Vector3): void {
    const { gravityEnabled, windStrength, windDirection } =
      this.physicsSettings;

    // 如果没有启用任何物理效果，直接返回
    if (!gravityEnabled && windStrength <= 0) return;

    // 减少日志输出频率，降低性能开销
    const shouldLog = Math.random() < 0.2; // 只有20%的概率输出日志

    if (shouldLog) {
      console.log(
        `[SceneManager] 应用物理模拟 - 物体: ${id}, ` +
          `重力: ${gravityEnabled ? "开启" : "关闭"}, ` +
          `风力: ${windStrength}, ` +
          `风向: [${windDirection.x.toFixed(2)}, ${windDirection.y.toFixed(
            2
          )}, ${windDirection.z.toFixed(2)}]`
      );
    }

    const obj = this.getObject(id);
    if (!obj) return;

    // 获取物体当前位置和目标位置
    const startPosition = obj.position.clone();
    const targetPosition = target.clone();
    const distance = startPosition.distanceTo(targetPosition);

    // 飞行方向向量
    const direction = new THREE.Vector3()
      .subVectors(targetPosition, startPosition)
      .normalize();

    // 物理偏移量（初始为零）
    let physicsOffset = new THREE.Vector3(0, 0, 0);

    // 应用重力影响
    if (gravityEnabled) {
      // 模拟重力偏移 - 重力会使无人机下降，尤其是在长距离飞行时
      // 计算受重力影响的程度（与距离成正比，但有上限）
      const gravityIntensity = Math.min(distance * 0.02, 0.5);
      const gravityVector = new THREE.Vector3(0, -9.8, 0);
      const gravityOffset = gravityVector
        .clone()
        .normalize()
        .multiplyScalar(gravityIntensity * 0.2); // 适当缩小影响

      physicsOffset.add(gravityOffset);

      if (shouldLog) {
        console.log(
          `[物理模拟] 重力影响: 飞行距离=${distance.toFixed(2)}m, ` +
            `重力强度=${gravityIntensity.toFixed(2)}, ` +
            `下降量=${gravityOffset.y.toFixed(2)}m`
        );
      }
    }

    // 应用风力影响
    if (windStrength > 0) {
      // 使用设置的风向，而不是随机生成
      const currentWindDirection = windDirection.clone();

      // 风力强度与距离和设定的风力值成正比
      const windIntensity = windStrength * Math.min(distance * 0.01, 0.5);
      const windOffset = currentWindDirection
        .clone()
        .multiplyScalar(windIntensity * 0.3); // 适当缩小影响

      physicsOffset.add(windOffset);

      if (shouldLog) {
        console.log(
          `[物理模拟] 风力影响: 风向=${currentWindDirection
            .toArray()
            .map(v => v.toFixed(2))}, ` +
            `风力强度=${windIntensity.toFixed(2)}, ` +
            `偏移量=[${windOffset.x.toFixed(2)}, ${windOffset.y.toFixed(
              2
            )}, ${windOffset.z.toFixed(2)}]`
        );
      }
    }

    // 仅在需要时输出理论位置信息
    if (shouldLog) {
      // 计算理论上的最终位置
      const theoreticalPosition = targetPosition.clone().add(physicsOffset);

      console.log(
        `[物理模拟] 理论路径: 起点=${startPosition
          .toArray()
          .map(v => v.toFixed(2))}, ` +
          `终点=${targetPosition.toArray().map(v => v.toFixed(2))}, ` +
          `理论终点=${theoreticalPosition.toArray().map(v => v.toFixed(2))}`
      );
    }
  }

  /**
   * 处理飞行队列
   */
  private async processQueue(id: string) {
    while (this.flightQueue.length > 0) {
      const target = this.flightQueue.shift()!;
      await this.smartAnimate(id, target, { lookAtTarget: true });
    }
  }

  /**
   * 计算朝向目标的欧拉角
   * @param current 当前位置
   * @param target 目标位置
   * @returns 朝向目标的欧拉角
   */
  public calculateLookAtEuler(
    current: THREE.Vector3,
    target: THREE.Vector3
  ): THREE.Euler {
    const direction = new THREE.Vector3()
      .subVectors(target, current)
      .normalize();
    return new THREE.Euler(
      0, // 保持X轴水平
      Math.atan2(direction.x, direction.z), // Y轴旋转
      0
    );
  }

  /**
   * 计算朝向目标的角度（内部使用）
   * @private
   */
  private calculateLookAt(
    current: THREE.Vector3,
    target: THREE.Vector3
  ): THREE.Euler {
    return this.calculateLookAtEuler(current, target);
  }

  /**
   * 旋转动画方法
   */
  private animateRotation(
    id: string,
    start: THREE.Euler,
    end: THREE.Euler,
    duration: number
  ): Promise<void> {
    return new Promise(resolve => {
      const animationKey = `rotate_${id}_${Date.now()}`;
      const startTime = this.clock.getElapsedTime();

      this.animations.set(animationKey, {
        update: () => {
          const elapsed = this.clock.getElapsedTime() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          const obj = this.getObject(id);
          if (!obj) return false;

          obj.rotation.x = THREE.MathUtils.lerp(start.x, end.x, progress);
          obj.rotation.y = THREE.MathUtils.lerp(start.y, end.y, progress);
          obj.rotation.z = THREE.MathUtils.lerp(start.z, end.z, progress);

          if (progress >= 1) {
            this.animations.delete(animationKey);
            resolve();
            return false;
          }
          return true;
        },
      });
    });
  }

  public on(event: EventType, handler: EventHandler): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
    return () => this.off(event, handler);
  }

  public off(event: EventType, handler?: EventHandler): void {
    if (!handler) {
      this.eventHandlers.delete(event);
      return;
    }
    this.eventHandlers.get(event)?.delete(handler);
  }

  private dispatchEvent<T>(event: EventType, data: T): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

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

  /**
   * 调整场景大小
   * @param width 宽度
   * @param height 高度
   */
  public resize(width: number, height: number): void {
    // 更严格的参数验证和边界检查
    if (!width || !height || isNaN(width) || isNaN(height)) {
      return;
    }

    // 强制转换为整数并确保最小值
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));

    // 检查尺寸变化是否明显
    if (this.renderer) {
      const currentSize = this.renderer.getSize(new THREE.Vector2());

      // 如果尺寸未变化，只触发渲染
      if (currentSize.width === width && currentSize.height === height) {
        this.requestRender();
        return;
      }
    }

    try {
      // 1. 调整渲染器尺寸
      if (this.renderer) {
        try {
          this.renderer.setSize(width, height, true); // 使用updateStyle=true确保CSS尺寸同步
        } catch (err) {
          console.error(`[SceneManager] 更新渲染器尺寸失败:`, err);
        }
      }

      // 2. 更新相机参数
      if (this.camera) {
        try {
          this.camera.aspect = width / height;
          this.camera.updateProjectionMatrix();
        } catch (err) {
          console.error(`[SceneManager] 更新相机参数失败:`, err);
        }
      }

      // 3. 更新控制器
      if (this.controls) {
        try {
          this.controls.update();
        } catch (err) {
          console.error(`[SceneManager] 更新相机控制器失败:`, err);
        }
      }

      // 4. 更新后处理效果（如果有）
      if (this.composer) {
        try {
          this.composer.setSize(width, height);
        } catch (err) {
          console.error(`[SceneManager] 更新后处理效果失败:`, err);
        }
      }

      // 立即触发一次渲染，确保变化立即可见
      this.requestRender();
      this.markNeedsUpdate();

      // 如果处于强制渲染模式，执行一次额外的smartRender
      if (this.forceRender) {
        try {
          this.smartRender();
        } catch (err) {
          console.error(`[SceneManager] resize后强制渲染失败:`, err);
        }
      }
    } catch (error) {
      console.error(`[SceneManager] resize过程中发生错误:`, error);
    }
  }

  public static getInstance(container?: HTMLDivElement): SceneManager {
    if (!SceneManager.instance) {
      if (!container) {
        throw new Error("Container is required for initializing SceneManager");
      }
      SceneManager.instance = new SceneManager(container);
    } else if (container && container !== SceneManager.instance.container) {
      // 如果提供了新的container且与当前container不同，更新container
      SceneManager.instance.container = container;
      SceneManager.instance.resize(
        container.clientWidth,
        container.clientHeight
      );
    }
    return SceneManager.instance;
  }
  public checkCollision(
    position: THREE.Vector3,
    radius: number = 0.01 // 大幅缩小检测半径
  ): boolean {
    // 添加安全平面过滤
    if (position.y < -0.01) return true; // 地面碰撞判断

    const sphere = new THREE.Sphere(position, radius);

    return Array.from(this.objectMap.values()).some(params => {
      // 严格过滤条件
      if (
        !params.collidable ||
        params.object.userData.isDecorative // 装饰性物体
      )
        return false;

      // 精确计算物体实际尺寸
      const box = new THREE.Box3().setFromObject(params.object);
      const size = box.getSize(new THREE.Vector3());

      // 忽略微观尺寸物体
      if (size.length() < 0.1) return false;

      return box.intersectsSphere(sphere);
    });
  }
  public isPositionReachable(position: THREE.Vector3): boolean {
    // 实现你的碰撞检测逻辑
    const collisionRadius = 0.5; // 检测半径
    return !this.checkCollision(position, collisionRadius);
  }

  // 修改后的标记点添加方法
  public addMarker(
    position: THREE.Vector3,
    id: string = "target-point"
  ): boolean {
    this.removeMarker(id);

    // 创建标记点
    const geometry = new THREE.SphereGeometry(0.1, 32, 32);

    // 根据可达性设置颜色
    const isReachable = this.isPositionReachable(position);
    const material = new THREE.MeshPhongMaterial({
      color: isReachable ? 0x00ff00 : 0xff0000,
      emissive: isReachable ? 0x00ff00 : 0xff0000,
      emissiveIntensity: 0.8,
      transparent: true,
      opacity: 0.8,
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.copy(position);
    sphere.castShadow = true;

    // 添加脉冲动画
    this.animationCallbacks.set(id, (time: number) => {
      sphere.scale.setScalar(1 + Math.sin(time * 5) * 0.1);
    });

    this.addObject({
      id,
      object: sphere,
      selectable: true,
      collidable: false,
    });

    this.markerMap.set(id, sphere);
    return isReachable;
  }

  // 新增获取当前可达状态的方法
  public getCurrentMarkerStatus(position: THREE.Vector3): boolean {
    return this.isPositionReachable(position);
  }
  // 移除标记点
  public removeMarker(id: string) {
    if (this.markerMap.has(id)) {
      this.removeObject(id);
      this.animationCallbacks.delete(id);
      this.markerMap.delete(id);
    }
  }
  public listCollidableObjects(): void {
    console.log("场景中的碰撞物体:");
    this.objectMap.forEach(params => {
      if (params.collidable) {
        const pos = params.object.position;
        console.log(
          `ID: ${params.id} | 类型: ${params.object.type} | 位置: (${pos.x}, ${pos.y}, ${pos.z})`
        );
      }
    });
  }

  /**
   * 设置强制渲染模式
   * @param force 是否强制渲染
   */
  public setForceRender(force: boolean): void {
    this.forceRender = force;

    // 如果开启强制渲染，马上标记需要更新
    if (force) {
      this.markNeedsUpdate();

      // 移除之前的监听器（如果有）
      if (this.visibilityChangeHandler) {
        document.removeEventListener(
          "visibilitychange",
          this.visibilityChangeHandler
        );
        this.visibilityChangeHandler = null;
      }

      // 添加新的监听器
      this.visibilityChangeHandler = () => {
        if (document.hidden && this.forceRender) {
          // 如果页面隐藏但需要强制渲染，创建一个渲染循环
          const renderLoop = () => {
            if (this.forceRender && document.hidden) {
              this.markNeedsUpdate();
              this.smartRender();
              setTimeout(renderLoop, 16); // 约60fps
            }
          };
          renderLoop();
        }
      };

      // 监听页面可见性变化
      document.addEventListener(
        "visibilitychange",
        this.visibilityChangeHandler
      );
    } else {
      // 关闭强制渲染时，移除监听器
      if (this.visibilityChangeHandler) {
        document.removeEventListener(
          "visibilitychange",
          this.visibilityChangeHandler
        );
        this.visibilityChangeHandler = null;
      }
    }
  }

  /**
   * 设置对象的持久显示
   * @param id 对象ID
   * @param persistent 是否持久显示
   */
  public setPersistent(id: string, persistent: boolean = true): void {
    const params = this.objectMap.get(id);
    if (!params) return;

    params.object.userData.persistent = persistent;

    // 添加或移除对象ID到持久对象集合
    if (persistent) {
      this.persistentObjects.add(id);
    } else {
      this.persistentObjects.delete(id);
    }

    // 确保场景重新渲染
    this.requestRender();
  }

  /**
   * 获取所有持久对象的ID列表
   */
  public getPersistentObjects(): string[] {
    // 检查轨迹对象是否存在，但不在persistentObjects集合中
    if (!this.persistentObjects.has("planned-trajectory")) {
      const plannedExists = !!this.getObject("planned-trajectory");
      if (plannedExists) {
        this.persistentObjects.add("planned-trajectory");
      }
    }

    if (!this.persistentObjects.has("flight-trajectory")) {
      const flightExists = !!this.getObject("flight-trajectory");
      if (flightExists) {
        this.persistentObjects.add("flight-trajectory");
      }
    }

    // 检查是否有数据但没有对象，如果有则重新渲染
    if (
      this.trajectoryPaths.planned.length >= 2 &&
      !this.getObject("planned-trajectory")
    ) {
      this.renderTrajectory("planned");
    }

    if (
      this.trajectoryPaths.flight.length >= 2 &&
      !this.getObject("flight-trajectory")
    ) {
      this.renderTrajectory("flight");
    }

    // 返回持久对象列表
    const objects = Array.from(this.persistentObjects);
    return objects;
  }

  /**
   * 检查对象是否为持久显示
   * @param id 对象ID
   */
  public isPersistent(id: string): boolean {
    return this.persistentObjects.has(id);
  }

  /**
   * 轨迹管理功能
   */

  // 设置计划轨迹路径
  public setPlannedPath(points: THREE.Vector3[]): void {
    // 更新轨迹点数组
    this.trajectoryPaths.planned = points.map(p => p.clone());

    // 直接渲染计划轨迹
    const id = "planned-trajectory";
    const visible = this.trajectoryVisible.planned;

    // 移除旧的轨迹（如果存在）
    this.removeObject(id, true);

    // 如果没有足够的点来渲染，直接返回
    if (points.length < 2 || !visible) {
      return;
    }

    // 创建计划轨迹
    const material = new THREE.LineDashedMaterial({
      color: 0x38b6ff,
      dashSize: 0.6,
      gapSize: 0.2,
      opacity: 0.9,
      transparent: true,
      linewidth: 3,
    });

    // 创建几何体
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    for (let i = 0; i < points.length; i++) {
      const point = points[i];
      if (point) {
        positions[i * 3] = point.x;
        positions[i * 3 + 1] = point.y;
        positions[i * 3 + 2] = point.z;
      }
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();

    // 添加到场景
    this.addObject({
      id,
      object: line,
      selectable: false,
      static: false,
    });

    // 确保轨迹可见
    line.visible = visible;

    // 标记为永久对象
    this.setPersistent(id, true);

    // 强制渲染
    this.requestRender();
    this.markNeedsUpdate();

    // 当计划路径更新时，重新生成风力轨迹
    this.generateWindTrajectory();
  }

  // 设置飞行轨迹路径
  public setFlightPath(points: THREE.Vector3[]): void {
    // 复制点以避免外部修改
    this.trajectoryPaths.flight = points.map(p => p.clone());
    console.log(`[SceneManager] 设置飞行轨迹，点数: ${points.length}`);
    this.renderTrajectories();
  }

  // 添加飞行点
  public addFlightPoint(point: THREE.Vector3): void {
    // 添加到轨迹点数组
    this.trajectoryPaths.flight.push(point.clone());

    // 如果点数足够，创建或更新轨迹
    if (this.trajectoryPaths.flight.length >= 2) {
      const id = "flight-trajectory";
      const points = this.trajectoryPaths.flight;

      // 创建或更新轨迹
      const material = new THREE.MeshBasicMaterial({
        color: 0x00ff7f,
        transparent: true,
        opacity: 0.9,
      });

      // 创建弯曲路径
      const curve = new THREE.CatmullRomCurve3(points);

      // 创建管道几何体
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        Math.max(20, points.length * 2), // 管道分段数
        0.08, // 管道直径
        8, // 管道横截面分段数
        false // 不闭合
      );

      const tube = new THREE.Mesh(tubeGeometry, material);

      // 移除旧的轨迹（如果存在）
      this.removeObject(id, true);

      // 添加新的轨迹
      this.addObject({
        id,
        object: tube,
        selectable: false,
        static: false,
      });

      // 使用当前轨迹可见性设置，而不是强制设为可见
      tube.visible = this.trajectoryVisible.flight;

      // 标记为永久对象
      this.setPersistent(id, true);

      // 强制渲染
      this.requestRender();
      this.markNeedsUpdate();
    }
  }

  // 设置轨迹可见性
  public setTrajectoryVisibility(
    type: "planned" | "flight" | "wind",
    visible: boolean
  ): void {
    this.trajectoryVisible[type] = visible;
    const id = `${type}-trajectory`;
    const trajectoryObject = this.getObject(id);

    if (trajectoryObject) {
      trajectoryObject.visible = visible;
      this.requestRender();
      this.markNeedsUpdate();
    } else if (type === "planned" && this.trajectoryPaths.planned.length >= 2) {
      // 如果计划轨迹对象不存在但有数据，重新渲染
      this.setPlannedPath(this.trajectoryPaths.planned);
    }
  }

  // 清除轨迹
  public clearTrajectories(options: {
    clearPlanned?: boolean;
    clearFlight?: boolean;
    clearWind?: boolean;
  }): void {
    if (options.clearPlanned) {
      this.trajectoryPaths.planned = [];
      this.removeObject("planned-trajectory", true);
    }

    if (options.clearFlight) {
      this.trajectoryPaths.flight = [];
      this.removeObject("flight-trajectory", true);
    }

    if (options.clearWind) {
      this.trajectoryPaths.wind = [];
      this.removeObject("wind-trajectory", true);
    }

    console.log("轨迹清理完成", {
      plannedRemaining: this.trajectoryPaths.planned.length,
      flightRemaining: this.trajectoryPaths.flight.length,
      windRemaining: this.trajectoryPaths.wind.length,
    });

    // 刷新渲染
    this.renderTrajectories();
  }

  // 渲染所有轨迹
  private renderTrajectories(): void {
    this.renderTrajectory("planned");
    this.renderTrajectory("flight");
    this.renderTrajectory("wind");
  }

  // 渲染单个轨迹
  private renderTrajectory(type: "planned" | "flight" | "wind"): void {
    const id = `${type}-trajectory`;
    const points = this.trajectoryPaths[type];
    const visible = this.trajectoryVisible[type];

    // 先检查现有对象
    const existingObject = this.getObject(id);

    // 如果对象已存在，直接设置可见性
    if (existingObject) {
      existingObject.visible = visible;
      if (!visible) return;
      this.removeObject(id, true);
    }

    // 如果没有足够的点来渲染，直接返回
    if (points.length < 2 || !visible) {
      return;
    }

    // 根据轨迹类型确定参数
    let color, tubeDiameter;
    if (type === "planned") {
      color = 0x38b6ff; // 鲜艳的蓝色
      tubeDiameter = 0.05; // 较细的预测轨迹
    } else if (type === "wind") {
      color = 0xff3333; // 更鲜艳的红色
      tubeDiameter = 0.08; // 使风力轨迹略粗于计划轨迹
    } else {
      color = 0x00ff7f; // 鲜艳的绿色
      tubeDiameter = 0.08; // 较粗的实际轨迹
    }

    let object3D;

    if (type === "planned" || type === "wind") {
      // 对计划轨迹和风力轨迹使用虚线效果
      const material = new THREE.LineDashedMaterial({
        color: color,
        dashSize: type === "wind" ? 0.8 : 0.6, // 风力轨迹虚线更长
        gapSize: type === "wind" ? 0.15 : 0.2, // 风力轨迹间隙更小
        opacity: type === "wind" ? 1.0 : 0.9, // 风力轨迹不透明度更高
        transparent: true,
        linewidth: type === "wind" ? 4 : 3, // 风力轨迹线宽更大
      });

      // 创建三维路径
      const pathGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(points.length * 3);

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        if (p) {
          positions[i * 3] = p.x;
          positions[i * 3 + 1] = p.y;
          positions[i * 3 + 2] = p.z;
        }
      }

      pathGeometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3)
      );

      // 设置虚线
      const line = new THREE.Line(pathGeometry, material);
      line.computeLineDistances();

      object3D = line;
    } else {
      // 对于飞行轨迹，使用管道几何体以获得更好的可视效果
      // 首先创建弯曲路径
      const curve = new THREE.CatmullRomCurve3(points);

      // 创建管道几何体
      const tubeGeometry = new THREE.TubeGeometry(
        curve,
        Math.max(20, points.length * 2), // 管道分段数
        tubeDiameter, // 管道直径
        8, // 管道横截面分段数
        false // 不闭合
      );

      // 创建管道材质
      const tubeMaterial = new THREE.MeshBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.9,
      });

      // 创建管道mesh
      object3D = new THREE.Mesh(tubeGeometry, tubeMaterial);
    }

    // 设置对象属性
    object3D.visible = visible;
    object3D.renderOrder = type === "planned" ? 1 : type === "wind" ? 3 : 2;

    // 添加到场景
    this.addObject({
      id,
      object: object3D,
      selectable: false,
      static: false,
    });

    // 确保轨迹在每一帧都被渲染
    this.forceRender = true;

    // 标记为永久对象 - 确保不会被意外删除
    this.setPersistent(id, true);

    // 强制保存一个永久引用，确保不会被垃圾回收
    // @ts-ignore: 在类上添加动态属性
    this[`_${id}_permanent_ref`] = object3D;

    // 强制刷新一次渲染
    this.requestRender();
    this.forceRefreshAnimations();
  }

  /**
   * 调试轨迹状态
   */
  public debugTrajectoryStatus(): void {
    // 减少调试日志频率
    if (Math.random() > 0.1) return; // 只有10%的概率输出日志

    const flightObj = this.getObject("flight-trajectory");
    const plannedObj = this.getObject("planned-trajectory");
    const windObj = this.getObject("wind-trajectory");

    console.log("轨迹状态调试信息:", {
      计划轨迹点数: this.trajectoryPaths.planned.length,
      实际轨迹点数: this.trajectoryPaths.flight.length,
      风力轨迹点数: this.trajectoryPaths.wind.length,
      计划轨迹对象: plannedObj
        ? {
            type: plannedObj.type,
            visible: plannedObj.visible,
            persistent: this.isPersistent("planned-trajectory"),
          }
        : "不存在",
      实际轨迹对象: flightObj
        ? {
            type: flightObj.type,
            visible: flightObj.visible,
            persistent: this.isPersistent("flight-trajectory"),
          }
        : "不存在",
      风力轨迹对象: windObj
        ? {
            type: windObj.type,
            visible: windObj.visible,
            persistent: this.isPersistent("wind-trajectory"),
          }
        : "不存在",
      计划轨迹可见性: this.trajectoryVisible.planned,
      实际轨迹可见性: this.trajectoryVisible.flight,
      风力轨迹可见性: this.trajectoryVisible.wind,
      物理设置: {
        重力: this.physicsSettings.gravityEnabled,
        风力强度: this.physicsSettings.windStrength,
        风向: [
          this.physicsSettings.windDirection.x.toFixed(2),
          this.physicsSettings.windDirection.y.toFixed(2),
          this.physicsSettings.windDirection.z.toFixed(2),
        ],
      },
    });

    // 如果发现轨迹点存在但轨迹对象不存在，尝试重建
    if (this.trajectoryPaths.flight.length >= 2 && !flightObj) {
      console.log("检测到实际轨迹点存在但轨迹对象缺失，尝试重建...");
      this.renderTrajectory("flight");
    }

    if (this.trajectoryPaths.planned.length >= 2 && !plannedObj) {
      console.log("检测到计划轨迹点存在但轨迹对象缺失，尝试重建...");
      this.renderTrajectory("planned");
    }

    if (this.trajectoryPaths.wind.length >= 2 && !windObj) {
      console.log("检测到风力轨迹点存在但轨迹对象缺失，尝试重建...");
      this.renderTrajectory("wind");
    }
  }

  /**
   * 强制刷新所有动画
   * 当动画系统似乎没有正常工作时调用此方法
   */
  public forceRefreshAnimations(): void {
    console.log(
      `[SceneManager] 强制刷新动画系统，当前动画数: ${this.animations.size}`
    );

    // 显示当前所有活跃的动画
    if (this.animations.size > 0) {
      console.log("动画列表:", Array.from(this.animations.keys()));
    }

    // 确保一帧渲染
    this.markNeedsUpdate();
    this.forceRender = true;

    // 强制触发一次tick
    this.tick();
  }

  /**
   * 紧急更新无人机模型位置
   * 当检测到无人机模型无法正常移动时，使用此方法进行强制更新
   * @param position 目标位置
   * @param rotation 目标旋转（可选）
   */
  public emergencyUpdateDrone(
    position: THREE.Vector3,
    rotation?: THREE.Euler
  ): void {
    try {
      // 1. 获取无人机模型
      const droneModel = this.getObject("drone-model");
      if (!droneModel) {
        return;
      }

      // 2. 计算已移动的距离
      const currentPosition = droneModel.position.clone();
      const distance = currentPosition.distanceTo(position);

      // 3. 更新位置和旋转
      droneModel.position.copy(position);
      if (rotation) {
        droneModel.rotation.copy(rotation);
      }

      // 4. 如果在第一人称视角模式，保持无人机模型隐藏
      if (this.firstPersonMode && this.firstPersonObjectId === "drone-model") {
        droneModel.visible = false;
      }

      // 5. 标记需要更新
      this.markNeedsUpdate();
      this.forceRender = true; // 强制渲染标记

      // 6. 如果当前是第一人称视角，立即更新相机位置
      // 注意：我们不影响用户通过鼠标设置的旋转
      if (this.firstPersonMode && this.firstPersonObjectId === "drone-model") {
        // 直接调用，无需等待下一帧
        this.updateFirstPersonView(distance > 0.5); // 只有距离大的移动才记录日志
      }
    } catch (error) {
      throw new Error(`紧急更新无人机模型失败: ${error}`);
    }
  }

  /**
   * 生成风力影响下的轨迹
   * 基于计划轨迹计算风力偏移后的轨迹
   */
  public generateWindTrajectory(): void {
    const { windStrength, windDirection } = this.physicsSettings;
    const plannedPoints = this.trajectoryPaths.planned;

    // 减少日志输出
    const shouldLog = Math.random() < 0.1;
    if (shouldLog) {
      console.log(
        `[SceneManager] 生成风力轨迹: 风力=${windStrength.toFixed(2)}, ` +
          `风向=[${windDirection.x.toFixed(2)}, ${windDirection.y.toFixed(
            2
          )}, ${windDirection.z.toFixed(2)}], ` +
          `计划轨迹点数=${plannedPoints.length}`
      );
    }

    // 如果没有启用风力或没有计划轨迹，清除风力轨迹并返回
    if (windStrength <= 0 || plannedPoints.length < 2) {
      this.trajectoryPaths.wind = [];
      this.setTrajectoryVisibility("wind", false);
      if (shouldLog) {
        console.log("[SceneManager] 风力轨迹条件不满足，清除风力轨迹");
      }
      return;
    }

    // 计算风力轨迹
    const windPoints: THREE.Vector3[] = [];

    // 计算总飞行距离，用于风力影响的缩放
    let totalDistance = 0;
    for (let i = 1; i < plannedPoints.length; i++) {
      const prevPoint = plannedPoints[i - 1];
      const currentPoint = plannedPoints[i];
      if (prevPoint && currentPoint) {
        totalDistance += currentPoint.distanceTo(prevPoint);
      }
    }

    // 增加风力影响因子，使效果更明显
    const windFactor = 0.8; // 增大风力影响

    // 生成风力轨迹点
    let accumulatedDistance = 0;
    for (let i = 0; i < plannedPoints.length; i++) {
      const currentPoint = plannedPoints[i];
      if (!currentPoint) continue;

      const point = currentPoint.clone();

      // 计算当前点到起点的累计距离占总距离的比例
      if (i > 0) {
        const prevPoint = plannedPoints[i - 1];
        if (prevPoint) {
          accumulatedDistance += currentPoint.distanceTo(prevPoint);
        }
      }

      // 防止除零
      const distanceRatio =
        totalDistance > 0
          ? Math.min((accumulatedDistance / totalDistance) * 2, 1)
          : 0;

      // 风力影响随距离增加而增强，最大为设定风力值的80%
      const windIntensity = windStrength * Math.min(distanceRatio, 0.8);

      // 风力偏移 = 风向单位向量 * 风力强度 * 影响系数 * 增强因子
      const windOffset = windDirection
        .clone()
        .normalize()
        .multiplyScalar(windIntensity * windFactor * accumulatedDistance);

      // 应用风力偏移
      point.add(windOffset);
      windPoints.push(point);
    }

    // 确保风力轨迹有足够明显的偏移
    if (windPoints.length >= 2) {
      const firstPoint = windPoints[0];
      const lastPoint = windPoints[windPoints.length - 1];
      const plannedLastPoint = plannedPoints[plannedPoints.length - 1];

      if (
        plannedLastPoint &&
        lastPoint &&
        lastPoint.distanceTo(plannedLastPoint) < 0.1
      ) {
        // 如果风力影响太小，人为增加终点偏移，使轨迹更明显
        const endOffset = windDirection
          .clone()
          .normalize()
          .multiplyScalar(totalDistance * 0.2 * windStrength);
        lastPoint.add(endOffset);
      }
    }

    // 更新风力轨迹
    this.trajectoryPaths.wind = windPoints;

    // 保持当前可见性设置，而不是强制可见
    const wasVisible = this.trajectoryVisible.wind;

    if (shouldLog) {
      console.log(
        `[SceneManager] 生成风力轨迹: ${
          windPoints.length
        }个点, 风力=${windStrength.toFixed(2)}, ` +
          `风向=[${windDirection.x.toFixed(2)}, ${windDirection.y.toFixed(
            2
          )}, ${windDirection.z.toFixed(2)}], ` +
          `可见性: ${wasVisible} (保持不变)`
      );
    }

    // 强制渲染一次轨迹 - 使用当前可见性设置
    this.renderTrajectory("wind");

    // 请求重新渲染
    this.requestRender();
  }

  /**
   * 添加位置到队列
   * @param position 目标位置
   */
  public addPositionToQueue(position: THREE.Vector3): void {
    if (!position) return;
    this.positionQueue.push(position.clone());
    if (!this.isMoving) {
      this.startMoving();
    }
  }

  /**
   * 开始移动处理
   */
  private startMoving(): void {
    if (this.isMoving || this.positionQueue.length === 0) return;
    this.isMoving = true;
    this.lastMoveTime = performance.now();
    this.processNextMove();
  }

  /**
   * 处理下一次移动
   */
  private processNextMove(): void {
    if (!this.isMoving || this.positionQueue.length === 0) {
      this.isMoving = false;
      return;
    }

    const now = performance.now();
    const elapsed = now - this.lastMoveTime;

    if (elapsed >= this.moveInterval) {
      const droneModel = this.getObject<THREE.Object3D>("drone-model");
      if (!droneModel) {
        this.isMoving = false;
        return;
      }

      const targetPosition = this.positionQueue[0]; // 只查看不移除
      if (!targetPosition) {
        this.isMoving = false;
        return;
      }

      // 更新无人机位置和朝向
      const currentPosition = droneModel.position.clone();
      const direction = new THREE.Vector3().subVectors(
        targetPosition,
        currentPosition
      );

      if (direction.length() > this.moveDistance) {
        // 如果距离目标点还有一定距离，进行插值移动
        direction.normalize().multiplyScalar(this.moveDistance);
        const nextPosition = currentPosition.add(direction);

        // 更新朝向
        const targetRotationY = Math.atan2(direction.x, direction.z);
        const rotation = new THREE.Euler(
          droneModel.rotation.x,
          targetRotationY,
          droneModel.rotation.z,
          "XYZ"
        );

        this.emergencyUpdateDrone(nextPosition, rotation);
        this.addFlightPoint(nextPosition.clone());
      } else {
        // 到达目标点，移除队列中的第一个点
        this.positionQueue.shift();
        this.emergencyUpdateDrone(targetPosition);
        this.addFlightPoint(targetPosition.clone());
      }

      this.lastMoveTime = now;
    }

    // 继续处理下一个移动
    if (this.isMoving) {
      requestAnimationFrame(() => this.processNextMove());
    }
  }

  /**
   * 清除位置队列
   */
  public clearPositionQueue(): void {
    this.positionQueue = [];
    this.isMoving = false;
  }

  /**
   * 设置场景对象的可见性
   * @param objectId 对象ID
   * @param visible 是否可见
   */
  public setObjectVisibility(objectId: string, visible: boolean): void {
    try {
      const obj = this.getObject(objectId);
      if (obj) {
        obj.visible = visible;
        this.markNeedsUpdate();
        this.requestRender();
        console.log(`[SceneManager] 设置对象 ${objectId} 可见性: ${visible}`);
      }
    } catch (error) {
      console.error(`[SceneManager] 设置对象可见性失败: ${error}`);
    }
  }
}
