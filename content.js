/**
 * 采集流程
 * 1. 查询 物料询料 表 inquiry_material_status = 0
 * 2. 通过1的数据，拿到 询料记录id: inquiry_record_id , 查这条记录 检查状态：inquiry_status == 0 ? 1 : inquiry_status
 * 3. 跳转至IC交易网 对应物料编码的搜索页面
 * 4. 页面加载完成后，检测状态 获取供应商信息  suppliers.length === 0 ? return 采集失败 inquiry_material_status = 1 : 采集成功继续  inquiry_material_status = 2  
 * 5. 更新供应商。 先通过供应商公司名查询
 *    存在 ==>  更新与本公司的绑定关系。 更新此条 物料询料 绑定公司
 *    不存在 ==> 创建供应商。 更新此条 物料询料 绑定公司
 */

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
            (async () => {
                try {
                    logger.info('开始轮询');
                    // 存储当前时间
                    await chrome.storage.local.set({ lastPollTime: new Date().toLocaleString() });
                    const hasLogin = window.location.href.includes('login.php')
                    if (hasLogin) {
                        logger.info('IC交易网处于未登录状态');
                        sendResponse({ success: false, error: '未登录状态' });
                        return;
                    }

                    await handleInquiryTask(); // 等待异步任务完成
                    sendResponse({ success: true });
                } catch (error) {
                    logger.error('轮询过程发生错误:', error);
                    sendResponse({
                        success: false,
                        error: error.message || '执行过程发生错误'
                    });
                }
            })();

            return true; // 保持消息通道开启
        }
    });


    // 处理询料任务
    async function handleInquiryTask() {
        try {
            // 先清除上一次的状态
            await chrome.storage.local.remove('executeGetSuppliersProcess');

            const inquiryMaterialResult = await ICCRMAPI.getInquiryMaterialByStatus() // 获取待采集状态的询料任务
            if (!inquiryMaterialResult || !inquiryMaterialResult?.material_code) return logger.info('当前询料物料没有标准物料。')
            const { inquiry_record_id, id, material_code } = inquiryMaterialResult

            chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据

            await sleep(2000) // 等待2秒
            await UTILS.gotoSearchPage(inquiry_record_id, id, material_code) // 跳转至IC交易网对应物料编码的搜索页面
        } catch (error) {
            logger.error('处理询料任务时发生错误:', error);
        }
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', async () => {
        await sleep(3000); // 等待3秒

        await chrome.storage.local.get(['executeGetSuppliersProcess'], async (result) => {
            if (result.executeGetSuppliersProcess) {
                const { inquiry_status } = await ICCRMAPI.getInquiryRecord(query.inquiryRecordId) // 获取 询料记录
                const { inquiry_supplier_number, purchase_bot_id, purchase_bot_im_platform } = await ICCRMAPI.getSystemConfig() // 获取系统配置
                const suppliersResult = await getSuppliersProcess(inquiry_supplier_number); // 获取供应商信息
                logger.info('获取供应商信息执行任务结果:', suppliersResult);
                chrome.storage.local.remove('executeGetSuppliersProcess');  // 执行后清除状态

                // 更新询料任务
                const { success, data, error } = suppliersResult;
                if (!success || !data.length) {
                    ICCRMAPI.updateInquiryMaterial(query.inquiryMaterialId, { inquiry_material_status: "1", gather_error: error },); // 更新询料物料状态为 采集失败
                    if (inquiry_status == "0") await ICCRMAPI.updateInquiryRecord(query.inquiryRecordId, { inquiry_status: "-1", gather_error: error }) // 更新询料任务状态为 采集失败
                } else {
                    await handleSupplierData(data, purchase_bot_id, purchase_bot_im_platform) // 处理供应商数据
                    await ICCRMAPI.updateInquiryMaterial(query.inquiryMaterialId, { inquiry_material_status: "2" },); // 更新询料物料状态为 待询价
                    await ICCRMAPI.updateInquiryRecord(query.inquiryRecordId, { inquiry_status: "1" }) // 更新询料任务状态为 待询价
                }
            }
        });

        // 处理 供应商数据
        async function handleSupplierData(data, purchase_bot_id, purchase_bot_im_platform) {
            const { user } = await new Promise(resolve => {
                chrome.storage.local.get(['user'], resolve);
            });

            await Promise.all(data.map(async (item) => {
                const { companyName, companyTag, qqAccount, companyInfo } = item;
                const { memberYears, contacts, location, addresses, brands } = companyInfo;
                const { phones, mobiles, faxes } = contacts;
                const userCompanyId = user.company_id + "";
                const supplierResult = await ICCRMAPI.getSupplierInfo(companyName); // 获取IC CRM中 供应商信息

                const supplierInfo = {
                    company_name: companyName,
                    company_tag: companyTag,
                    qq_account: qqAccount,
                    member_years: memberYears,
                    phones: phones,
                    mobiles: mobiles.join(' '),
                    faxes: faxes.join(' '),
                    location,
                    addresses: addresses.join(' '),
                }

                if (supplierResult) {
                    // 更新供应商信息
                    const { company_ids, inquiry_material, brands: supplierBrands } = supplierResult;
                    if (!company_ids.includes(userCompanyId)) company_ids.push(userCompanyId) // 关联公司ids

                    const inquiryMaterialIds = inquiry_material.map(item => item.id)
                    if (!inquiryMaterialIds.includes(query.inquiryMaterialId)) inquiryMaterialIds.push(query.inquiryMaterialId) // 关联询料物料ids

                    await ICCRMAPI.updateSupplierInfo(companyName, {
                        company_ids,
                        inquiry_material: inquiryMaterialIds.map(item => { return { id: item } }),
                        brands: brands.length > 0 ? brands.map(item => {
                            const existingBrand = supplierBrands?.find(b => b.brand_name === item.name); // 查找相同名称的已有品牌
                            return {
                                id: existingBrand?.id, // 保留已有品牌的id
                                proportion: item.percentage,
                                brand_name: item.name,
                            }
                        }) : [],
                        ...supplierInfo
                    })
                } else {
                    // 创建供应商信息
                    await ICCRMAPI.createSupplierInfo({
                        company_ids: [userCompanyId],
                        inquiry_material: [{ id: query.inquiryMaterialId }],
                        brands: brands.length > 0 ? brands.map(item => ({
                            proportion: item.percentage,
                            brand_name: item.name,
                        })) : [],
                        ...supplierInfo
                    })
                }

                // 处理供应商联系人
                const supplierContactInfo = {
                    company_id: user.company_id, // 所属公司
                    supplier_name: companyName, // 所属供应商
                    imUserId: qqAccount.length > 0 ? qqAccount[0] : '', // 联系人qq
                    imBotUserId: purchase_bot_id, // 机器人ID
                    imPlatform: purchase_bot_im_platform, // 平台
                    imIsGroup: '好友'
                }
                await handleSuppliercontact(supplierContactInfo)
            }));
        }

        // 处理供应商联系人
        async function handleSuppliercontact(supplierContactInfo) {
            const { company_id, supplier_name } = supplierContactInfo;
            const supplierContactResult = await ICCRMAPI.getSupplierContact(company_id, supplier_name)
            if (!supplierContactResult) await ICCRMAPI.createSupplierContact(supplierContactInfo)
        }
    });
}