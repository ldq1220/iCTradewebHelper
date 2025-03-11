const SpiderApi = {
    async request(endpoint, options = {}) {
        const spiderBaseUrl = 'https://ic-spider2.we5.fun/api'; // 将 base URL 封装在这里

        const xApiKey = 'U2FsdGVkX1+NZULLdP'

        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': xApiKey
            },
            mode: 'cors',
            // 默认超时时间 30 秒
            timeout: 30000
        };

        // 合并配置
        const finalOptions = {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        };

        // 如果有 body 且是对象，转换为 JSON 字符串
        if (finalOptions.body && typeof finalOptions.body === 'object') {
            finalOptions.body = JSON.stringify(finalOptions.body);
        }

        try {
            // 创建一个可以超时的 Promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('请求超时')), finalOptions.timeout);
            });

            // 发起请求
            const fetchPromise = fetch(`${spiderBaseUrl}${endpoint}`, finalOptions); // 使用封装的 base URL
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error(`IC助手，HTTP error! status: ${response.status}`);
            }

            const respone = await response.json();
            return respone;
        } catch (error) {
            console.error('请求出错:', error);
            throw error;
        }
    },


    // 获取任务
    async getSpliderTask() {
        return this.request(`/task-get`, {
            method: 'GET'
        });
    }
}
