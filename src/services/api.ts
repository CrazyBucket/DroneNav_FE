import ApiBase from "@/services/api_base";

interface SceneInfo {
  id: string;
  name: string;
  description: string;
  object_count: number;
}

interface SimulationRequest {
  current: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  speed?: number;
  droneSize?: { width: number; height: number; depth: number };
  scene_id?: string;
}

interface SimulationResponse {
  status: string;
  task_id: string;
  ws_endpoint: string;
}

interface GetScenesResponse {
  status: string;
  scenes: SceneInfo[];
}

interface GetSceneResponse {
  status: string;
  scene: any;
  message?: string;
}

class Apis extends ApiBase {
  private urls = {
    getScenes: "/get_scenes",
    getScene: "/getScene",
    startSimulation: "/start_simulation",
  };

  async getScenes(): Promise<GetScenesResponse> {
    try {
      console.log("正在获取场景列表...");
      const res = await this.service.get<any, { data: GetScenesResponse }>(
        this.urls.getScenes,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
      console.log("场景列表获取成功:", res.data);
      return res.data;
    } catch (error) {
      console.error("获取场景列表失败:", error);
      throw error;
    }
  }

  async getScene(sceneId?: string): Promise<GetSceneResponse> {
    const params: { scene_id?: string } = {};
    if (sceneId) {
      params.scene_id = sceneId;
    }
    const res = await this.service.get<any, { data: GetSceneResponse }>(
      this.urls.getScene,
      { params }
    );
    return res.data;
  }

  async startSimulation(
    params: SimulationRequest
  ): Promise<SimulationResponse> {
    console.log(
      `[API] 发送路径规划请求，场景ID: ${params.scene_id || "未设置"}`
    );

    // 最多尝试3次
    for (let retry = 0; retry < 3; retry++) {
      try {
        if (retry > 0) {
          console.log(`[API] 第 ${retry + 1} 次尝试发送请求...`);
        }

        const res = await this.service.post<any, { data: SimulationResponse }>(
          this.urls.startSimulation,
          params
        );

        console.log(`[API] 路径规划请求成功: `, res.data);
        return res.data;
      } catch (error) {
        console.error(`[API] 请求失败 (尝试 ${retry + 1}/3):`, error);

        // 如果已经尝试3次，则抛出错误
        if (retry === 2) {
          throw error;
        }

        // 否则等待一段时间后重试
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    // 这行理论上不会执行，但TypeScript需要
    throw new Error("请求失败，已达到最大重试次数");
  }
}

export const apis = new Apis();
