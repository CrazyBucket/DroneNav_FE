// 障碍物基础接口
interface ObstacleBase {
    /** 障碍物唯一标识符 */
    id: string;
    /** 障碍物类型 */
    type: string;
    /** 三维坐标位置 (x, y, z) */
    position: [number, number, number];
    /** 三维旋转角度 (x, y, z)，单位：度，默认无旋转 */
    rotation?: [number, number, number];
    /** 扩展元数据存储 */
    metadata?: Record<string, any>;
}

// 立方体特征
interface CubeFeature {
    /** 尺寸参数 [宽度, 深度, 高度] */
    size: [number, number, number];
}

// 圆柱体特征
interface CylinderFeature {
    /** 底面半径 */
    radius: number;
    /** 圆柱高度 */
    height: number;
}

// 树木特征
interface TreeFeature {
    /** 树干半径 */
    trunkRadius: number;
    /** 树冠尺寸 */
    canopySize: number;
}

// 建筑物特征
interface BuildingFeature {
    /** 楼层数 */
    floors: number;
    /** 占地面积 [长度, 宽度] */
    footprint: [number, number];
}

// 电线杆特征
interface PoleFeature {
    /** 电线杆高度 */
    height: number;
    /** 是否有电线连接 */
    hasWires: boolean;
}

// 动态障碍物特征
interface DynamicFeature {
    /** 移动速度 (m/s) */
    speed: number;
    /** 移动方向向量 (x, y, z) */
    direction: [number, number, number];
}

// 具体障碍物类型定义
interface CubeObstacle extends ObstacleBase {
    type: "CUBE";
    feature: CubeFeature;
}

interface CylinderObstacle extends ObstacleBase {
    type: "CYLINDER";
    feature: CylinderFeature;
}

interface TreeObstacle extends ObstacleBase {
    type: "TREE";
    feature: TreeFeature;
}

interface BuildingObstacle extends ObstacleBase {
    type: "BUILDING";
    feature: BuildingFeature;
}

interface PoleObstacle extends ObstacleBase {
    type: "POLE";
    feature: PoleFeature;
}

interface DynamicObstacle extends ObstacleBase {
    type: "DYNAMIC";
    feature: DynamicFeature;
}

// 障碍物联合类型
type Obstacle = CubeObstacle | CylinderObstacle | TreeObstacle | BuildingObstacle | PoleObstacle | DynamicObstacle;

// 添加导出声明
export interface ObstacleMetadata {
    [key: string]: any;
}