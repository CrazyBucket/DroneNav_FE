interface Position3D {
  /** X轴坐标 */
  x: number;
  /** Y轴坐标 */
  y: number;
  /** Z轴坐标 */
  z: number;
}

interface Rotation3D {
  /** 绕X轴旋转角度（度） */
  pitch: number;
  /** 绕Y轴旋转角度（度） */
  yaw: number;
  /** 绕Z轴旋转角度（度） */
  roll: number;
}

interface ObstacleBase {
  /** 障碍物唯一标识符 */
  id: string;
  /** 障碍物类型 */
  type: string;
  /** 三维坐标位置 */
  position: Position3D;
  /** 三维旋转角度（可选） */
  rotation?: Rotation3D;
  /** 扩展元数据存储（可选） */
  metadata?: Record<string, any>;
}

interface CubeFeature {
  /** 尺寸参数 [宽, 高, 深]（单位：米） */
  size: [number, number, number];
  /** 贴图标识（可选） */
  texture?: string;
  /** 十六进制颜色值（格式如#FF0000，可选） */
  color?: string;
}

interface DroneFeature {
  /** 模型名称 */
  model: string;
  /** 缩放比例  */
  scale?: number;
}

interface CubeObstacle extends ObstacleBase {
  /** 障碍物类型：立方体 */
  type: "CUBE";
  /** 立方体特征 */
  feature: CubeFeature;
}

interface DroneObstacle extends ObstacleBase {
  type: "DRONE";
  feature: DroneFeature;
}

interface CylinderFeature {
  /** 底面半径（单位：米） */
  radius: number;
  /** 高度（单位：米） */
  height: number;
  /** 是否包含顶底面 */
  capped: boolean;
}

interface CylinderObstacle extends ObstacleBase {
  /** 障碍物类型：圆柱体 */
  type: "CYLINDER";
  /** 圆柱体特征 */
  feature: CylinderFeature;
}

interface TreeStyle {
  /** 模型文件名（不含扩展名） */
  model: string;
  /** 缩放比例 */
  scale: number;
}

interface TreeObstacle extends ObstacleBase {
  /** 障碍物类型：树木 */
  type: "TREE";
  /** 树木特征 */
  feature: TreeStyle;
}

interface BuildingModelStyle {
  /** 预定义模型标识 */
  model_id: string;
}

interface BuildingTextureStyle {
  /** 主墙面贴图标识 */
  main_texture: string;
}

interface BuildingFeature {
  /** 底面尺寸 [长, 宽]（单位：米） */
  footprint: [number, number];
  /** 建筑高度（单位：米） */
  height: number;
  /** 风格配置 */
  style: BuildingModelStyle | BuildingTextureStyle;
}

interface BuildingObstacle extends ObstacleBase {
  /** 障碍物类型：建筑物 */
  type: "BUILDING";
  /** 建筑物特征 */
  feature: BuildingFeature;
}

interface RoadMarking {
  /** 标线类型（空字符串、边线或转向箭头） */
  type: "center_line" | "side_line" | "turn_arrow";
  /** 标线样式（实线、虚线或双线） */
  pattern: "solid" | "dashed" | "double";
  /** 标线颜色（十六进制格式如#FFFFFF） */
  color: string;
}

interface RoadMaterial {
  /** 路面材质标识 */
  surface: string;
  /** 道路标线列表 */
  markings: RoadMarking[];
}

interface StraightRoadFeature {
  /** 道路长度（单位：米） */
  length: number;
  /** 方向角（单位：度） */
  direction: number;
}

interface CurvedRoadFeature {
  /** 转弯半径（单位：米） */
  radius: number;
  /** 转弯角度（单位：度） */
  angle: number;
  /** 转弯方向（左或右） */
  direction: "left" | "right";
}

interface RoadSegment extends ObstacleBase {
  /** 障碍物类型：道路 */
  type: "ROAD";
  /** 道路宽度（单位：米） */
  width: number;
  /** 道路材质 */
  material: RoadMaterial;
  /** 道路特征 */
  feature: StraightRoadFeature | CurvedRoadFeature;
}

export type Obstacle =
  | CubeObstacle
  | CylinderObstacle
  | TreeObstacle
  | BuildingObstacle
  | RoadSegment
  | DroneObstacle;

interface SceneConfig {
  /** 场景名称 */
  name: string;
  /** 坐标系类型（ENU或NED） */
  coordinate_system: "ENU" | "NED";
  /** 障碍物列表 */
  obstacles: Obstacle[];
}
