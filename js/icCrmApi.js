// 创建一个全局对象来存放所有 API 函数
window.ICCRMAPI = {
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
                if (response.status == 403) {
                    await chrome.storage.local.remove(['token', 'user']);  // 清除登录信息
                    chrome.runtime.sendMessage({ action: 'loginExpired' });  // 通知background脚本登录已过期
                    throw new Error(`IC助手，登录态过期。请重新登录。HTTP status: ${response.status}`);
                }
                throw new Error(`IC助手，HTTP error! status: ${response.status}`);
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

    // 获取一个询料任务
    async getInquiryRecord(id) {
        return this.request(`/inquiry_records:get?filter[id]=${id}`, {
            method: 'GET'
        });
    },

    // 更新询料任务
    async updateInquiryRecord(id, data) {
        return this.request(`/inquiry_records:update?filterByTk=${id}`, {
            method: 'POST',
            body: data
        });
    },

    // 获取一条 待采集状态的 询料物料
    async getInquiryMaterialByStatus() {
        return this.request(`/inquiry_materials:get?filter={"inquiry_material_status": "0"}`, {
            method: 'GET'
        });
    },

    // 获取询料物料
    async getInquiryMaterialById(id) {
        return this.request(`/inquiry_materials:get?filter[id]=${id}`, {
            method: 'GET'
        });
    },

    // 更新 询料物料
    async updateInquiryMaterial(id, data) {
        return this.request(`/inquiry_materials:update?filter[id]=${id}`, {
            method: 'POST',
            body: data
        });
    },

    // 获取一个供应商信息
    async getSupplierInfo(company_name) {
        return this.request(`/suppliers:get?filter[company_name]=${company_name}&appends=companys,brands,inquiry_material`, {
            method: 'GET'
        })
    },

    // 创建供应商信息
    async createSupplierInfo(data) {
        return this.request(`/suppliers:create`, {
            method: 'POST',
            body: data
        });
    },

    // 更新供应商信息
    async updateSupplierInfo(supplierId, data) {
        return this.request(`/suppliers:update?filterByTk=${supplierId}`, {
            method: 'POST',
            body: data
        });
    },

    // 获取供应商联系人
    async getSupplierContact(companyId, supplierName) {
        return this.request(`/supplier_contact:get?filter={"company_id":${companyId},"supplier_name":"${supplierName}"}`, {
            method: 'GET'
        });
    },

    // 创建供应商联系人
    async createSupplierContact(data) {
        return this.request(`/supplier_contact:create`, {
            method: 'POST',
            body: data
        });
    }
};

