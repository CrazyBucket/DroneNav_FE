import ApiBase from "@/services/api_base";

class Apis extends ApiBase {
    private urls: Record<string, string>;
    constructor() {
        super();
        this.urls = {
            getScene: '/getScene'
        };
    }


    async getScene() {
        const res = await this.service.get(this.urls.getScene!);
        return res.data;
    }
}

export const apis = new Apis();