import React, { useEffect, useState, useRef } from "react";
import { SceneManager } from "@/core/SceneManager";
import { useSettingStore } from "@/store/setting";

interface EnergyData {
  totalPower: number;
  rotorPower: number;
  specificEnergy: number;
}

interface PositionRecord {
  y: number;
  timestamp: number;
}

// 添加能耗历史记录接口
interface EnergyHistory {
  timestamp: number;
  totalPower: number;
}

const EnergyPanel: React.FC = () => {
  // 所有状态hooks必须在组件顶部无条件调用
  const [energyData, setEnergyData] = useState<EnergyData>({
    totalPower: 0,
    rotorPower: 0,
    specificEnergy: 0,
  });

  // 飞行状态
  const [flightState, setFlightState] = useState<
    "hover" | "climbing" | "descending" | "level"
  >("hover");

  // 使用useRef存储位置历史，避免触发useEffect循环
  const positionsRef = useRef<PositionRecord[]>([]);

  // 能耗历史数据，用于绘制趋势图
  const [energyHistory, setEnergyHistory] = useState<EnergyHistory[]>([]);
  // 控制历史数据长度，避免数组过长
  const MAX_HISTORY_LENGTH = 60; // 保存最近60个数据点（约1分钟）

  // 上次计算时间ref，用于限制计算频率
  const lastCalculationTimeRef = useRef<number>(0);

  // 上次位置ref，用于检测位置变化
  const lastPositionRef = useRef<{ x: number; y: number; z: number } | null>(
    null
  );

  const { gravityEffect, windEffect } = useSettingStore();

  // 计算风力和重力影响百分比
  const getWindImpact = () => {
    // 风力影响：每单位风力增加20%能耗
    return windEffect > 0 ? windEffect * 20 : 0;
  };

  // 获取风力影响等级和颜色
  const getWindImpactLevel = () => {
    const impact = getWindImpact();
    if (impact <= 10) return { level: "低", color: "text-green-400" };
    if (impact <= 30) return { level: "中", color: "text-yellow-400" };
    return { level: "高", color: "text-red-400" };
  };

  // 根据飞行状态获取状态显示文本和颜色
  const getStateTextAndColor = () => {
    switch (flightState) {
      case "climbing":
        return { text: "爬升中", color: "text-red-400" };
      case "descending":
        return { text: "下降中", color: "text-green-400" };
      case "level":
        return { text: "平飞中", color: "text-blue-400" };
      default:
        return { text: "悬停中", color: "text-gray-400" };
    }
  };

  useEffect(() => {
    // 如果重力效应未启用，不需要计算
    if (!gravityEffect) return;

    // 添加测试日志输出
    console.log("[EnergyPanel] 能耗计算初始化");

    // 计算能耗数据的函数，但限制频率
    const calculateEnergyData = () => {
      const now = Date.now();
      // 限制计算频率为每300毫秒一次，提高响应速度
      if (now - lastCalculationTimeRef.current < 300) {
        return;
      }
      lastCalculationTimeRef.current = now;

      try {
        const sceneManager = SceneManager.safeGetInstance();
        const droneModel = sceneManager.getObject("drone-model");

        if (!droneModel) return;

        // 获取当前位置
        const currentPosition = {
          x: droneModel.position.x,
          y: droneModel.position.y,
          z: droneModel.position.z,
        };

        // 检查是否是首次计算
        const isFirstCalculation = lastPositionRef.current === null;

        // 检查位置是否发生变化，降低阈值使其更敏感
        const lastPos = lastPositionRef.current;
        const hasPositionChanged =
          !lastPos ||
          Math.abs(lastPos.x - currentPosition.x) > 0.005 ||
          Math.abs(lastPos.y - currentPosition.y) > 0.005 ||
          Math.abs(lastPos.z - currentPosition.z) > 0.005;

        // 调试输出
        if (hasPositionChanged) {
          console.log(
            "[EnergyPanel] 位置变化:",
            lastPos
              ? `Y: ${lastPos.y.toFixed(3)} -> ${currentPosition.y.toFixed(3)}`
              : "初始位置",
            `变化量: ${
              lastPos
                ? Math.abs(currentPosition.y - lastPos.y).toFixed(3)
                : "N/A"
            }`
          );
        }

        // 如果是首次计算或者位置未变化，设置初始值或保持当前值
        if (isFirstCalculation) {
          // 首次计算，不设置能耗值，仅记录位置
          lastPositionRef.current = currentPosition;
          // 初始化为0值
          setEnergyData({
            totalPower: 0,
            rotorPower: 0,
            specificEnergy: 0,
          });
          return;
        } else if (!hasPositionChanged && energyData.totalPower === 0) {
          // 位置未变且当前功率为0，保持为0
          return;
        }

        // 更新最后位置记录
        lastPositionRef.current = currentPosition;

        // 更新位置历史（只保留最近2秒数据）- 使用ref而不是state，缩短历史记录窗口以提高灵敏度
        const positions = positionsRef.current;
        const newPositions = [
          ...positions.filter(p => now - p.timestamp < 2000),
          { y: currentPosition.y, timestamp: now },
        ];
        positionsRef.current = newPositions;

        // 确定飞行状态
        let currentState: "hover" | "climbing" | "descending" | "level" =
          "hover";
        let verticalSpeed = 0;

        if (newPositions.length > 2) {
          // 降低所需样本数量
          // 有足够的历史数据
          // 计算过去1秒的平均垂直速度
          const recentPositions = newPositions.slice(-3); // 减少样本数量，更敏感地检测变化
          const oldestY =
            recentPositions.length > 0 ? recentPositions[0]?.y || 0 : 0;
          const newestY =
            recentPositions.length > 0
              ? recentPositions[recentPositions.length - 1]?.y || 0
              : 0;
          const oldestTime =
            recentPositions.length > 0 ? recentPositions[0]?.timestamp || 0 : 0;
          const newestTime =
            recentPositions.length > 0
              ? recentPositions[recentPositions.length - 1]?.timestamp || 0
              : 0;
          const timeDiff = (newestTime - oldestTime) / 1000; // 秒
          verticalSpeed = timeDiff > 0 ? (newestY - oldestY) / timeDiff : 0;

          // 降低垂直速度阈值，使状态检测更敏感
          const VERTICAL_SPEED_THRESHOLD = 0.01; // 极小的阈值

          // 判断飞行状态 - 增加阈值以更敏感地检测垂直运动
          if (Math.abs(verticalSpeed) < VERTICAL_SPEED_THRESHOLD) {
            // 相对静止，判断为悬停
            currentState = "hover";
          } else if (verticalSpeed > VERTICAL_SPEED_THRESHOLD) {
            // 上升
            currentState = "climbing";
          } else if (verticalSpeed < -VERTICAL_SPEED_THRESHOLD) {
            // 下降
            currentState = "descending";
          } else {
            // 水平飞行
            currentState = "level";
          }

          // 调试输出
          console.log(
            `[EnergyPanel] 垂直速度: ${verticalSpeed.toFixed(
              4
            )} m/s, 飞行状态: ${currentState}, 高度: ${currentPosition.y.toFixed(
              2
            )}`
          );
        }

        // 只有状态变化时才更新，减少渲染
        if (currentState !== flightState) {
          setFlightState(currentState);
        }

        // 基础参数 - 调整无人机质量为较轻的值
        const droneMass = 0.6; // 无人机质量(kg)
        const rotorCount = 4; // 旋翼数量
        const gravityAcc = 9.81; // 重力加速度(m/s²)
        const airDensity = 1.225; // 空气密度(kg/m³)
        const rotorDiameter = 0.254; // 旋翼直径(m)
        const rotorArea = Math.PI * Math.pow(rotorDiameter / 2, 2); // 旋翼面积(m²)

        // 风力影响因子
        const windFactor = windEffect > 0 ? 1 + windEffect * 0.2 : 1;

        // 理想悬停功率计算 (基于动量理论)
        const thrust = droneMass * gravityAcc; // 需要的总推力(N)
        // 增加效率系数，使计算结果更符合实际小型无人机
        const idealHoverPower =
          (Math.pow(thrust, 1.5) /
            Math.sqrt(2 * airDensity * rotorCount * rotorArea)) *
          0.6; // 添加0.6效率因子

        // 考虑高度影响 - 空气密度随高度降低
        // 简化计算，直接用高度影响功率
        const heightFactor = 1 + (currentPosition.y / 40) * 0.2; // 每上升40单位高度，功率增加20%

        // 基础功率
        let basePower = idealHoverPower * windFactor * heightFactor;

        // 根据飞行状态调整功率 - 增加状态间的差异，同时使用垂直速度影响功率
        let flightFactor = 1.0;
        switch (currentState) {
          case "climbing":
            // 垂直速度影响功率 - 速度越快，功率增加越多
            const speedFactor = 1 + Math.min(0.8, Math.abs(verticalSpeed) * 5); // 增大速度影响
            flightFactor = 1.3 * speedFactor; // 爬升基础系数提高
            break;
          case "descending":
            // 下降速度越快，能耗越低（使用动能）
            const descentFactor = Math.max(
              0.5,
              1 - Math.abs(verticalSpeed) * 2
            ); // 增大速度影响
            flightFactor = 0.7 * descentFactor;
            break;
          case "level":
            flightFactor = 1.1;
            break;
          default: // 悬停
            flightFactor = 1.0;
        }

        // 计算总功率
        const totalPower = basePower * flightFactor;

        // 单个旋翼功率
        const rotorPower = totalPower / rotorCount;

        // 单位距离能耗 (Wh/km) - 假设平均速度15km/h
        const avgSpeed = 15; // km/h
        const specificEnergy = totalPower / avgSpeed;

        // 新的能耗数据
        const newEnergyData = {
          totalPower: Math.round(totalPower * 10) / 10,
          rotorPower: Math.round(rotorPower * 10) / 10,
          specificEnergy: Math.round(specificEnergy * 100) / 100,
        };

        // 强制更新能耗数据即使值没有变化，确保图表能反映位置变化
        if (
          hasPositionChanged ||
          newEnergyData.totalPower !== energyData.totalPower ||
          newEnergyData.rotorPower !== energyData.rotorPower ||
          newEnergyData.specificEnergy !== energyData.specificEnergy
        ) {
          console.log(
            "[EnergyPanel] 更新能耗数据:",
            newEnergyData.totalPower.toFixed(1),
            "W"
          );
          setEnergyData(newEnergyData);

          // 更新能耗历史数据
          setEnergyHistory(prev => {
            const newHistory = [
              ...prev,
              { timestamp: now, totalPower: newEnergyData.totalPower },
            ];
            // 限制历史数据长度
            return newHistory.length > MAX_HISTORY_LENGTH
              ? newHistory.slice(-MAX_HISTORY_LENGTH)
              : newHistory;
          });
        }
      } catch (error) {
        console.error("[EnergyPanel] 计算能耗数据失败:", error);
      }
    };

    // 立即计算一次
    calculateEnergyData();

    // 创建更新间隔 - 频率提高到300毫秒一次，提高响应速度
    const intervalId = setInterval(calculateEnergyData, 300);

    // 清理函数
    return () => clearInterval(intervalId);
  }, [gravityEffect, windEffect, flightState, energyData]); // 只依赖这些状态

  // 绘制能耗趋势图的函数
  const renderEnergyChart = () => {
    if (energyHistory.length < 2) return null;

    // 确定图表尺寸和边距
    const width = 160;
    const height = 60;
    const padding = 2;

    // 动态计算合适的Y轴范围
    // 找出数据的最小值和最大值
    const dataMin = Math.min(...energyHistory.map(d => d.totalPower));
    const dataMax = Math.max(...energyHistory.map(d => d.totalPower));
    // 计算数据的范围
    const dataRange = dataMax - dataMin;

    // 如果范围太小，设置一个最小范围确保图表可见
    const effectiveRange = Math.max(dataRange, 5);

    // 设置缓冲区，使图表不会紧贴边界
    const buffer = effectiveRange * 0.1;

    // 计算最终的Y轴范围
    const minPower = Math.max(0, dataMin - buffer);
    const maxPower = dataMax + buffer;

    // 仅使用最近的数据点绘制
    const displayData = energyHistory.slice(-15); // 减少数据点，更突出短期变化

    if (displayData.length < 2) return null;

    // 获取最新数据点的电力值
    const latestDataPoint = displayData[displayData.length - 1];
    const latestPower = latestDataPoint?.totalPower.toFixed(1) ?? "0";

    // 构建SVG路径
    const points = displayData
      .map((point, index) => {
        const x =
          padding + (index / (displayData.length - 1)) * (width - 2 * padding);
        const y =
          height -
          padding -
          ((point.totalPower - minPower) / (maxPower - minPower || 1)) *
            (height - 2 * padding);
        return `${x},${y}`;
      })
      .join(" ");

    // 根据功率变化选择趋势线颜色
    const getTrendColor = () => {
      if (displayData.length < 2) return "#4DD18D"; // 默认绿色

      const firstValue = displayData[0]?.totalPower || 0;
      const lastValue = displayData[displayData.length - 1]?.totalPower || 0;
      const change = lastValue - firstValue;

      if (change > 5) return "#EF4444"; // 大幅上升为红色
      if (change > 1) return "#F59E0B"; // 小幅上升为橙色
      if (change < -5) return "#10B981"; // 大幅下降为绿色
      if (change < -1) return "#60A5FA"; // 小幅下降为蓝色
      return "#4DD18D"; // 基本稳定为青绿色
    };

    const trendColor = getTrendColor();

    // 创建Y轴刻度
    const createYAxisTicks = () => {
      // 只创建3个刻度：最小值、中间值和最大值
      const ticks = [
        { value: minPower, y: height - padding },
        { value: (minPower + maxPower) / 2, y: height / 2 },
        { value: maxPower, y: padding },
      ];

      return ticks.map((tick, i) => (
        <g key={i}>
          <line
            x1={padding}
            y1={tick.y}
            x2={width - padding}
            y2={tick.y}
            stroke="#333"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <text
            x={width - 20}
            y={tick.y}
            fill="#666"
            fontSize="6"
            textAnchor="end"
            alignmentBaseline="middle"
          >
            {Math.round(tick.value)}W
          </text>
        </g>
      ));
    };

    return (
      <div className="mt-3 pt-2 border-t border-gray-700/50">
        <div className="text-xs text-gray-300 mb-1">功率趋势 (W):</div>
        <svg width={width} height={height} className="bg-gray-900/30 rounded">
          {/* 添加网格线和刻度 */}
          {createYAxisTicks()}

          {/* 绘制曲线 */}
          <polyline
            points={points}
            fill="none"
            stroke={trendColor}
            strokeWidth="1.5"
          />
          {/* 添加填充区域 */}
          <path
            d={`M${padding},${height - padding} ${points} ${width - padding},${
              height - padding
            } Z`}
            fill={`${trendColor}33`} // 33 = 20% 透明度
          />
          {/* 显示当前值 */}
          <text x="5" y="12" fill={trendColor} fontSize="9" fontWeight="bold">
            {latestPower} W
          </text>

          {/* 显示变化率 */}
          {displayData.length >= 2 && (
            <text
              x={width - 45}
              y="12"
              fill={trendColor}
              fontSize="8"
              fontWeight="bold"
            >
              {(() => {
                const firstValue = displayData[0]?.totalPower || 0;
                const lastValue =
                  displayData[displayData.length - 1]?.totalPower || 0;
                const change = lastValue - firstValue;
                const sign = change > 0 ? "+" : change < 0 ? "-" : "";
                return `${sign}${Math.abs(change).toFixed(1)}W`;
              })()}
            </text>
          )}
        </svg>
      </div>
    );
  };

  // 只在重力启用时显示面板
  if (!gravityEffect) return null;

  return (
    <div className="absolute top-2 right-2 w-[180px] bg-black/70 text-gray-200 rounded-md p-3 border border-[#2D4A2D] text-xs backdrop-blur-sm">
      <h3 className="m-0 mb-2 pb-1.5 text-center text-sm text-[#4DD18D] border-b border-gray-700/50">
        能耗分析
      </h3>
      <ul className="list-none p-0 m-0">
        <li className="flex justify-between mb-1.5">
          <span className="text-gray-300">总功率消耗:</span>
          <span className="font-bold text-[#E5FFE5]">
            {energyData.totalPower} W
          </span>
        </li>
        <li className="flex justify-between mb-1.5">
          <span className="text-gray-300">单旋翼功率:</span>
          <span className="font-bold text-[#E5FFE5]">
            {energyData.rotorPower} W
          </span>
        </li>
        <li className="flex justify-between mb-1.5">
          <span className="text-gray-300">单位能耗:</span>
          <span className="font-bold text-[#E5FFE5]">
            {energyData.specificEnergy} Wh/km
          </span>
        </li>
        <li className="flex justify-between mt-1 pt-1 border-t border-gray-700/50">
          <span className="text-gray-300">飞行状态:</span>
          <span className={`font-bold ${getStateTextAndColor().color}`}>
            {getStateTextAndColor().text}
          </span>
        </li>
        {windEffect > 0 && (
          <li className="flex justify-between mt-1">
            <span className="text-gray-300">风力影响:</span>
            <span className={`font-bold ${getWindImpactLevel().color}`}>
              +{getWindImpact().toFixed(0)}% ({getWindImpactLevel().level})
            </span>
          </li>
        )}
      </ul>

      {/* 添加能耗趋势图表 */}
      {renderEnergyChart()}
    </div>
  );
};

export default EnergyPanel;
