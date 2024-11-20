// 检查当前页面是否为目标网站
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn'];
// 工具函数
const logger = {
    info: (msg, ...args) => console.log(`[IC助手] ${msg}`, new Date().toLocaleString(), ...args),
    error: (msg, error) => console.error(`[IC助手] ${msg}:`, error ?? '')
};

// 等待函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

if (IC_URL.includes(window.location.hostname)) {
    // 获取URL中的查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = {};

    // 将所有查询参数转换为对象
    for (const [key, value] of urlParams.entries()) {
        query[key] = value;
    }

    // 添加消息监听器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startPoll') {
            logger.info('开始轮询');
            const hasLogin = window.location.href.includes('login.php') // 是否在登录页
            if (hasLogin) return logger.info('未登录状态');;

            handleInquiryTask(); // 处理询料任务
        }
        return true; // 返回true表示异步处理
    });


    // 处理询料任务
    async function handleInquiryTask() {
        try {
            const taskResult = await ICCRMAPI.getInquiryTask() // 获取待采集状态的询料任务
            if (!taskResult || !taskResult?.material_code) return logger.info('当前询料任务没有标准物料。')

            const { material_code, id } = taskResult
            chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
            await UTILS.gotoSearchPage(material_code, id) // 跳转至IC交易网对应物料编码的搜索页面
        } catch (error) {
            logger.error('处理询料任务时发生错误:', error);
        }
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', async () => {
        await sleep(3000); // 等待3秒

        let user = null
        await chrome.storage.local.get(['user'], function (result) {
            user = result.user
        });

        await chrome.storage.local.get(['executeGetSuppliersProcess'], async (result) => {
            if (result.executeGetSuppliersProcess) {
                const { inquiry_supplier_number } = await ICCRMAPI.getSystemConfig() // 获取系统配置

                const suppliersResult = await getSuppliersProcess(inquiry_supplier_number); // 获取供应商信息
                logger.info('执行任务结果:', suppliersResult);
                chrome.storage.local.remove('executeGetSuppliersProcess');  // 执行后清除状态

                // 更新询料任务
                const { success, data, error } = suppliersResult;
                if (!success || !data.length) {
                    ICCRMAPI.updateInquiryTask(query.inquiryId, { inquiry_status: 1, gather_error: error },); // 更新询料任务状态为 采集失败
                } else {
                    const suppliersData = await handleSupplierData(data) // 处理供应商数据

                    const suppliersDataWithoutBrands = suppliersData.map(({ brands, ...rest }) => rest); // 删除brands字段  
                    await ICCRMAPI.updateInquiryTask(query.inquiryId, { inquiry_status: 2, suppliers: suppliersDataWithoutBrands },); // 更新询料任务状态为 采集成功

                    await sleep(1000); // 等待1秒
                    // 如果 供应商不在CRM里面，则需要进行补充补品牌
                    await Promise.all(suppliersData.map(async (supplier) => {
                        const { company_name, hasExist, brands } = supplier;
                        const brandsData = brands.map(item => {
                            return {
                                f_supplier: company_name,
                                proportion: item.percentage,
                                brand_name: item.name,
                            }
                        })
                        if (!hasExist) await ICCRMAPI.updateSupplierInfo(company_name, { brands: brandsData });
                    }))
                }
            }
        });

        // 处理 供应商数据
        async function handleSupplierData(data) {
            // 使用Promise.all等待所有Promise完成
            const suppliersData = await Promise.all(data.map(async (item) => {
                const { companyName, companyTag, qqAccount, companyInfo } = item;
                const { memberYears, contacts, location, addresses, brands } = companyInfo;
                const { phones, mobiles, faxes } = contacts;
                const userCompanyId = user.company_id + "";
                const supplierResult = await ICCRMAPI.getSupplierInfo(companyName); // 获取IC CRM中 供应商信息
                // 如果crm中存在供应商，则更新绑定关系 并且没有绑定过当前
                if (supplierResult && !supplierResult.company_ids.includes(userCompanyId))
                    await ICCRMAPI.updateSupplierInfo(companyName, { company_ids: [...supplierResult.company_ids, ...[userCompanyId]] })

                return {
                    company_ids: [userCompanyId],
                    company_name: companyName.join(' '),
                    company_tag: companyTag,
                    qq_account: qqAccount,
                    member_years: memberYears,
                    phones: phones,
                    mobiles: mobiles.join(' '),
                    faxes: faxes.join(' '),
                    location,
                    addresses: addresses.join(' '),
                    hasExist: supplierResult ? true : false, // 是否存在
                    brands
                }
            }));

            return suppliersData;
        }
    });
}