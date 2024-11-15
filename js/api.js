// 创建一个全局对象来存放所有 API 函数
window.ICCUSTOMAPI = {
    // 请求封装
    async request(url, options = {}) {
        const defaultOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
            const fetchPromise = fetch(url, finalOptions);
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('请求失败:', error);
            throw error;
        }
    },

    // API 方法
    async getKingdeeCookie() {
        return this.request('https://tk04dul26h.gzg.sealos.run/hjs/getKingdeeCookie', {
            body: {
                logicFlowAppId: 1164
            }
        });
    },
};