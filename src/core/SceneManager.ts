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

  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
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
  };
  private trajectoryVisible = {
    planned: true,
    flight: true,
  };

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

  private constructor(private container: HTMLDivElement) {
    this.scene = this.initScene();
    this.camera = this.initCamera();
    this.renderer = this.initRenderer();
    this.controls = this.initControls();
    this.initEventListeners();
    SceneManager._isInitialized = true;
    this.initPostProcessing();
    this.tick();
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
    // 轨迹对象特殊处理，确保不会被意外删除
    if ((id === "planned-trajectory" || id === "flight-trajectory") && !force) {
      console.log(`[SceneManager] 轨迹对象${id}被保护，跳过移除`);
      return;
    }

    const params = this.objectMap.get(id);
    if (!params) return;

    // 检查是否为持久对象，且不是强制移除
    if (
      !force &&
      (this.persistentObjects.has(id) || params.object.userData.persistent)
    ) {
      console.log(`对象 ${id} 被标记为持久显示，跳过移除`);
      return;
    }

    // 清理资源
    if (params.lodLevels) {
      params.lodLevels.forEach(([_, obj]) => this.disposeObject(obj));
      this.lodObjects.delete(id);
    } else {
      this.disposeObject(params.object);
    }

    this.objectMap.delete(id);
    this.staticObjects.delete(id);
    this.persistentObjects.delete(id); // 从持久对象集合中移除
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

  private smartRender(): void {
    // 如果存在持久对象，增加刷新频率
    const hasPersistentObjects = this.persistentObjects.size > 0;

    // 如果设置了强制渲染标志，或有持久对象，或需要按帧率更新，就执行渲染
    if (
      this.forceRender ||
      hasPersistentObjects ||
      this.frameCount % this.updateInterval === 0 ||
      this.needsUpdate
    ) {
      // 强制渲染或标记需要更新
      this.markNeedsUpdate();

      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
      this.needsUpdate = false;
    }

    this.frameCount++;
  }

  private tick = (): void => {
    requestAnimationFrame(this.tick);
    const deltaTime = this.clock.getDelta();

    const hasActiveAnimations = this.animations.size > 0;

    // 在强制渲染模式或有活跃动画时更新所有对象
    if (this.forceRender || hasActiveAnimations) {
      this.markNeedsUpdate();
    }

    // 更新动画
    this.animations.forEach((animation, key) => {
      const shouldContinue = animation.update(deltaTime);
      if (!shouldContinue) {
        this.animations.delete(key);
      }
    });

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
        console.warn(`Object ${id} not found`);
        return resolve();
      }

      const startPosition = obj.position.clone();
      const startTime = this.clock.getElapsedTime();

      const animationKey = `move_${id}_${Date.now()}`;

      this.animations.set(animationKey, {
        update: (deltaTime: number) => {
          const elapsed = this.clock.getElapsedTime() - startTime;
          const progress = Math.min(elapsed / duration, 1);

          obj.position.lerpVectors(startPosition, targetPosition, progress);

          if (progress >= 1) {
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
    } = {}
  ): Promise<void> {
    const { duration = 1, lookAtTarget = true, addToQueue = false } = options;
    const obj = this.getObject(id);
    if (!obj) return;

    if (addToQueue) {
      this.flightQueue.push(target);
      if (!this.isAnimating) this.processQueue(id);
      return;
    }

    this.isAnimating = true;

    // 方向控制
    if (lookAtTarget) {
      const startRotation = obj.rotation.clone();
      const targetRotation = this.calculateLookAt(obj.position, target);
      this.animateRotation(id, startRotation, targetRotation, duration / 2);
    }

    await this.animateToPosition(id, target, duration);
    // 动画完成后添加飞行轨迹点
    try {
      this.addFlightPoint(target.clone());
      console.log(
        `[SceneManager] 添加动画结束后的飞行轨迹点: ${target.toArray()}`
      );
    } catch (error) {
      console.error("[SceneManager] 添加飞行轨迹点失败:", error);
    }
    this.isAnimating = false;
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
   * 计算朝向目标的角度
   */
  private calculateLookAt(
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

  public resize(width: number, height: number): void {
    this.renderer.setSize(width, height);

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    if (this.composer) {
      this.composer.setSize(width, height);
    }

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
      console.log(
        `对象 ${id} 被标记为持久对象，现有 ${this.persistentObjects.size} 个持久对象`
      );
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
      console.log("[SceneManager] 检测到计划轨迹缺失，正在恢复");
      this.renderTrajectory("planned");
    }

    if (
      this.trajectoryPaths.flight.length >= 2 &&
      !this.getObject("flight-trajectory")
    ) {
      console.log("[SceneManager] 检测到飞行轨迹缺失，正在恢复");
      this.renderTrajectory("flight");
    }

    // 返回持久对象列表
    const objects = Array.from(this.persistentObjects);

    // 添加调试信息 - 应用程序全局状态下可见
    console.log(`[SceneManager] 持久对象: ${objects.length}个`, {
      objects,
      plannedPath: this.trajectoryPaths.planned.length,
      flightPath: this.trajectoryPaths.flight.length,
    });

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
    // 保留旧点数据用于渐变动画
    const oldPoints = [...this.trajectoryPaths.planned];
    this.trajectoryPaths.planned = points.map(p => p.clone());

    // 创建渐变动画
    if (oldPoints.length > 0) {
      const duration = 1000; // 动画时长1秒
      const startTime = Date.now();

      const animate = () => {
        const progress = Math.min((Date.now() - startTime) / duration, 1);

        // 插值生成中间点
        const interpolatedPoints = oldPoints.map((oldPt, i) => {
          const newPt = points[i] || oldPt.clone();
          return oldPt.clone().lerp(newPt, progress);
        });

        // 更新几何体
        const plannedLine = this.getObject("planned-trajectory") as THREE.Line;
        if (plannedLine) {
          plannedLine.geometry.setFromPoints(interpolatedPoints);
        }

        if (progress < 1) requestAnimationFrame(animate);
      };

      animate();
    }

    this.renderTrajectory("planned");
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
    // 检查是否是重复点
    if (this.trajectoryPaths.flight.length > 0) {
      const lastPoint =
        this.trajectoryPaths.flight[this.trajectoryPaths.flight.length - 1];
      if (lastPoint && lastPoint.distanceTo(point) < 0.001) {
        return; // 忽略几乎相同的点
      }
    }

    this.trajectoryPaths.flight.push(point.clone());
    const flightLine = this.getObject("flight-trajectory") as THREE.Line;
    if (flightLine) {
      const newGeometry = new THREE.BufferGeometry().setFromPoints(
        this.trajectoryPaths.flight
      );
      flightLine.geometry.dispose();
      flightLine.geometry = newGeometry;
    }
    this.smartRender();
  }

  // 设置轨迹可见性
  public setTrajectoryVisibility(
    type: "planned" | "flight",
    visible: boolean
  ): void {
    // 如果可见性状态没有变化，则不需要进一步处理
    if (this.trajectoryVisible[type] === visible) {
      return;
    }

    console.log(
      `[SceneManager] 设置${
        type === "planned" ? "计划" : "飞行"
      }轨迹可见性: ${visible}`
    );

    // 更新可见性状态
    this.trajectoryVisible[type] = visible;

    // 直接设置轨迹对象的可见性属性（如果存在）
    const id = `${type}-trajectory`;
    const trajectoryObject = this.getObject(id);
    if (visible && this.trajectoryPaths[type].length === 0) {
      this.trajectoryPaths[type] = [new THREE.Vector3(), new THREE.Vector3()];
    }
    if (trajectoryObject) {
      trajectoryObject.visible = visible;
      // 请求重新渲染以反映可见性变化
      this.requestRender();
    } else if (visible && this.trajectoryPaths[type].length >= 2) {
      // 如果轨迹对象不存在，但应该可见并且有足够的点数据，则渲染它
      this.renderTrajectory(type);
    }
  }

  // 清除轨迹
  public clearTrajectories(options: {
    clearPlanned?: boolean;
    clearFlight?: boolean;
  }): void {
    if (options.clearPlanned) {
      this.trajectoryPaths.planned = [];
      this.removeObject("planned-trajectory", true);
    }

    if (options.clearFlight) {
      this.trajectoryPaths.flight = [];
      this.removeObject("flight-trajectory", true);
    }

    console.log("[SceneManager] 轨迹清除完成", {
      plannedRemaining: this.trajectoryPaths.planned.length,
      flightRemaining: this.trajectoryPaths.flight.length,
    });
  }

  // 渲染所有轨迹
  private renderTrajectories(): void {
    this.renderTrajectory("planned");
    this.renderTrajectory("flight");
  }

  // 渲染单个轨迹
  private renderTrajectory(type: "planned" | "flight"): void {
    const id = `${type}-trajectory`;
    const points = this.trajectoryPaths[type];
    const visible = this.trajectoryVisible[type];

    // 先检查现有对象
    const existingObject = this.getObject(id);

    // 如果对象已存在，直接设置可见性
    if (existingObject) {
      existingObject.visible = visible;

      // 如果设置为不可见，或者不需要重新渲染，直接返回
      if (visible && points.length >= 2) {
        const line = existingObject as THREE.Line;
        const oldGeometry = line.geometry;

        // 创建新几何体
        const newGeometry = new THREE.BufferGeometry().setFromPoints(points);

        // 拷贝几何体属性（避免dispose问题）
        line.geometry = newGeometry;

        // 如果是虚线需要重新计算
        if (type === "planned") {
          (line as THREE.Line).computeLineDistances();
        }

        // 清理旧几何体
        oldGeometry.dispose();
      }
    }

    // 如果没有足够的点来渲染，直接返回
    if (points.length < 2) {
      return;
    }
    // 如果不可见且对象不存在，不需要创建
    if (!visible && !existingObject) {
      return;
    }
    // 如果对象已存在并且可见，且有足够的点，则不需要重新创建
    if (existingObject && visible && points.length >= 2) {
      // 只有当存在对象且可见时，才不需要重新创建
      return;
    }

    // 创建几何体
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    let material;
    let line;

    if (type === "planned") {
      // 计划轨迹使用虚线
      material = new THREE.LineDashedMaterial({
        color: 0x38b6ff,
        dashSize: 0.4,
        gapSize: 0.3,
        opacity: 0.7,
        transparent: true,
      });
      line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      // 设置较低的渲染顺序，确保在实际轨迹之下
      line.renderOrder = 1;
    } else {
      // 飞行轨迹使用实线
      material = new THREE.LineBasicMaterial({
        color: 0x50c878,
        linewidth: 3,
        transparent: true,
        opacity: 0.9,
      });
      line = new THREE.Line(geometry, material);
      line.renderOrder = 2;
    }

    // 设置线条可见性
    line.visible = visible;

    // 添加到场景
    this.addObject({
      id,
      object: line,
      selectable: false,
      static: false,
    });

    // 确保轨迹在每一帧都被渲染
    this.forceRender = true;

    // 标记为永久对象 - 确保不会被意外删除
    this.setPersistent(id, true);

    // 强制保存一个永久引用，确保不会被垃圾回收
    // @ts-ignore: 在类上添加动态属性
    this[`_${id}_permanent_ref`] = line;

    // 直接检查是否添加成功
    const added = this.getObject(id);
    console.log(`[SceneManager] 轨迹${id}添加${added ? "成功" : "失败"}`);
  }
}
