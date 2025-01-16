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
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn', 'www.hqew.com', 's.hqew.com', 'www.szlcsc.com', 'so.szlcsc.com'];

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
    console.log('content.js 执行 window.location.hostname \n', window.location.hostname);

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
                    // 通知background.js 先清空数据
                    if (window.location.hostname.includes('ic.net.cn')) {
                        chrome.runtime.sendMessage({ action: "clearGatherPlan" });
                    }

                    await handleInquiryTask(); // 等待异步任务完成
                    // const suppliersResult = await getSuppliersProcessByLcsc(); // 获取【立创商城】供应商信息
                    // console.log('【立创商城】供应商信息', suppliersResult);
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
            const { companyIds } = await chrome.storage.local.get(['companyIds']);

            const { limit } = await chrome.storage.local.get(['limit']);
            const inquiryMaterialResult = await ICCRMAPI.getInquiryMaterialByStatus("0", limit) // 获取待采集状态的询料任务
            const inquiryMaterialResultCompanyIds = inquiryMaterialResult.map(item => item.inquiry_record.company_id)
            const hasInclude = companyIds.some(item => inquiryMaterialResultCompanyIds.includes(item))
            if (!hasInclude) return logger.info('获取到待采集物料中，没有插件负责的公司！！')

            // 找出第一个满足条件的询料物料
            for (let i = 0; i < inquiryMaterialResult.length; i++) {
                const element = inquiryMaterialResult[i];
                const hasInclude = companyIds.includes(element.inquiry_record.company_id)
                if (!hasInclude) continue
                console.log('查到有插件负责的公司', element)
                const { inquiry_record_id, id, material_code } = element
                await chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
                await sleep(2000) // 等待2秒
                await chrome.runtime.sendMessage({ action: "gotoJywSearchPage", inquiryRecordId: inquiry_record_id, inquiryMaterialId: id, searchValue: material_code, companyId: element.inquiry_record.company_id }); // 跳转至IC交易网对应物料编码的搜索页面
                break
            }
        } catch (error) {
            logger.error('处理询料任务时发生错误:', error);
        }
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', async () => {
        await sleep(3000); // 等待3秒

        await chrome.storage.local.get(['executeGetSuppliersProcess'], async (result) => {
            if (result.executeGetSuppliersProcess) {
                let suppliersResult = null

                if (window.location.hostname.includes('ic.net.cn')) {
                    suppliersResult = await getSuppliersProcessByJyw(); // 获取【交易网】供应商信息
                } else if (window.location.hostname.includes('hqew.com')) {
                    suppliersResult = await getSuppliersProcessByHqw(); // 获取【华强网】供应商信息
                } else if (window.location.hostname.includes('szlcsc.com')) {
                    suppliersResult = await getSuppliersProcessByLcsc(); // 获取【立创商城】供应商信息
                }

                logger.info('获取供应商信息执行任务结果:', suppliersResult);
                await chrome.storage.local.remove('executeGetSuppliersProcess');  // 执行后清除状态

                const suppliersGatherOverData = {
                    suppliersResult,
                    source: window.location.hostname,
                }
                console.log('供应商采集结束发送消息通道 suppliersGatherOverData', suppliersGatherOverData);
                chrome.runtime.sendMessage({ action: "suppliersGatherOver", suppliersGatherOverData });
            }
        });
    });
}