// 创建一个全局对象来存放所有 API 函数
const ICCRMAPI = {
    // 请求封装
    async request(endpoint, options = {}) {
        const icCrmBaseUrl = 'https://ic.we5.fun/api'; // 将 base URL 封装在这里

        const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTczMTY1MjQyMywiZXhwIjozMzI4OTI1MjQyM30.9gqsT7pVshkjWL1cHYVXYhxHcoR5cfHQS0p1zOjmQMU'

        const defaultOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
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
                    chrome.runtime.sendMessage({ action: 'loginExpired' });  // 通知background脚本登录已过期
                    alert('IC助手Token错误，No permission')
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
    async getSystemConfig(companyId) {
        return this.request(`/parameter_config:get?filter[f_company_id]=${companyId}`, {
            method: 'GET'
        });
    },

    // 获取一个询料任务
    async getInquiryRecord(id) {
        return this.request(`/inquiry_records:get?filterByTk=${id}`, {
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
    async getInquiryMaterialByStatus(status, pageSize) {
        return this.request(`/inquiry_materials:list?filter={"inquiry_material_status": "${status}"}&page=1&pageSize=${pageSize}&appends=inquiry_record`, {
            method: 'GET'
        });
    },

    // 获取询料物料
    async getInquiryMaterialById(id) {
        return this.request(`/inquiry_materials:get?filterByTk=${id}`, {
            method: 'GET'
        });
    },

    // 更新 询料物料
    async updateInquiryMaterial(id, data) {
        return this.request(`/inquiry_materials:update?filterByTk=${id}`, {
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
    },

    // 创建临时数据
    async createTempData({ company_id, kind, json_data }) {
        return this.request('/temp_data:create', {
            method: 'POST',
            body: {
                company_id,
                kind,
                json_data,
            },
        })
    },

    // 更新临时数据
    async updateTempData(id, data) {
        return this.request(`/temp_data:update?filterByTk=${id}`, {
            method: 'POST',
            body: data
        });
    }
};