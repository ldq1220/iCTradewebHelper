// 创建一个全局对象来存放所有 API 函数
window.ICCUSTOMAPI = {
    // 请求封装
    async request(endpoint, options = {}) {
        const icCrmBaseUrl = 'https://ic.we5.fun/api'; // 将 base URL 封装在这里

        // 从 chrome.storage 中获取 token
        const result = await chrome.storage.local.get(['token']);
        const token = result.token;

        const defaultOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // 使用从 storage 中获取的 token
            },
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
            const fetchPromise = fetch(`${icCrmBaseUrl}${endpoint}`, finalOptions); // 使用封装的 base URL
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const respone = await response.json();
            return respone.data;
        } catch (error) {
            console.error('请求失败:', error);
            throw error;
        }
    },

    /*********************** API 方法 ***********************/
    // 获取系统配置
    async getSystemConfig() {
        return this.request(`/parameter_config:get`, {
            method: 'GET'
        });
    },

    // 获取一个待采集的询料任务
    async getInquiryTask() {
        return this.request(`/inquiry_records:get?filter[inquiry_status]=0`, {
            method: 'GET'
        });
    }
};