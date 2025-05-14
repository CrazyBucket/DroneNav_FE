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
    const res = await this.service.post<any, { data: SimulationResponse }>(
      this.urls.startSimulation,
      params
    );
    return res.data;
  }
}

export const apis = new Apis();
