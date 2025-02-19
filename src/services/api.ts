import ApiBase from "@/services/api_base";

class Apis extends ApiBase {
    private urls: Record<string, string>;
    constructor() {
        super();
        this.urls = {
            getTest: '/test'
        };
    }


    async getTest() {
        const res = await this.service.get(this.urls.getTest!);
        return res.data;
    }
}

export const apis = new Apis();