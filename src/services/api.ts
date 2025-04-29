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

  async startSimulation(coordinates: { x: number; y: number; z: number }) {
    const res = await this.service.post(
      this.urls.startSimulation!,
      coordinates
    );
    return res.data;
  }
}

export const apis = new Apis();
