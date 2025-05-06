import ApiBase from "@/services/api_base";

interface SimulationRequest {
  current: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

interface SimulationResponse {
  status: string;
  task_id: string;
  ws_endpoint: string;
}

class Apis extends ApiBase {
  private urls: Record<string, string>;
  constructor() {
    super();
    this.urls = {
      getScene: "/getScene",
      startSimulation: "/start_simulation",
    };
  }

  async getScene() {
    const res = await this.service.get(this.urls.getScene!);
    return res.data;
  }

  async startSimulation(
    params: SimulationRequest
  ): Promise<SimulationResponse> {
    const res = await this.service.post(this.urls.startSimulation!, params);
    return res.data;
  }
}

export const apis = new Apis();
