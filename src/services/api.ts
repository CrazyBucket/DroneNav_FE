import ApiBase from "@/services/api_base";

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

  async startSimulation(params: SimulationRequest) {
    const res = await this.service.post(this.urls.startSimulation!, params);
    return res.data;
  }
}

export const apis = new Apis();
