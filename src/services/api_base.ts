import axios from 'axios'
import { BASE_URL, TIMEOUT } from './config'

axios.defaults.baseURL = BASE_URL
export class ApiBase {
    // axios 配置
    protected ajaxRequest: unknown = null
    protected CancelToken = axios.CancelToken

    protected http = axios.create({
        timeout: TIMEOUT,
    })

    protected service = axios.create({
        baseURL: BASE_URL,
        timeout: TIMEOUT,
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    })
}

export default ApiBase