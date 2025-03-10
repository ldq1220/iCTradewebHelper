// 直接引入 poll.js
importScripts('js/poll.js');
importScripts('js/icCrmApiBackground.js');

const gatherPlan = {
    jyw: false,
    jywSuppliers: [],
    hqw: false,
    hqwSuppliers: [],
    lcsc: false,
    lcscMaterialInfos: [],
    companyId: null,
    inquiryRecordId: null,
    inquiryMaterialId: null,
    inquiryMaterialCode: null,
}
const sourceData = [
    {
        url: 'ic.net.cn',
        name: 'jyw'
    },
    {
        url: 'hqew.com',
        name: 'hqw'
    },
    {
        url: 'szlcsc.com',
        name: 'lcsc'
    }
]
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function handleEncodeURIComponent(str) {
    return encodeURIComponent(str);
}
function handleClearGatherPlan() {
    Object.assign(gatherPlan, {
        jyw: false,
        jywSuppliers: [],
        companyId: null,
        inquiryRecordId: null,
        inquiryMaterialId: null,
        inquiryMaterialCode: null,
    })
}

// 供应商去重
function deWeightSuppliers(suppliers) {
    const seenCompanies = new Set();
    let storage = suppliers
        .filter(item => item.companyName.length > 0 && item.qqAccount.length > 0)
        .filter(item => {
            // 获取第一个公司名作为唯一标识
            const companyName = item.companyName;
            // 如果这个公司名已经出现过，返回false过滤掉
            if (seenCompanies.has(companyName)) {
                return false;
            }
            // 否则添加到Set中并保留这条数据
            seenCompanies.add(companyName);

            // 删除item中的company和visibleLinks属性
            delete item.company;
            delete item.visibleLinks;
            return true;
        }).map((item, index) => {
            return {
                id: index + 1,
                ...item
            }
        });

    return storage;
}


// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleStatus') {
        message.isEnabled ? Poll.startPolling() : Poll.stopPolling();
        sendResponse({ success: true }); // 发送响应
    }

    // 插件 登录过期的消息
    if (message.action === 'loginExpired') {
        stopTask(); // 停止当前运行的任务
        isEnabled = false; // 设置启用状态为 false
        chrome.storage.local.set({ isEnabled: false }); // 更新存储中的状态
        sendResponse({ success: true });
    }

    return true; // 保持消息通道开启
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false && result.isEnabled !== undefined;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 浏览器启动时初始化
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false && result.isEnabled !== undefined;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 监听 跳转至IC交易网搜索页面
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "gotoJywSearchPage") {
        const { inquiryRecordId, inquiryMaterialId, searchValue, companyId } = request;
        gatherPlan.companyId = companyId;
        gatherPlan.inquiryRecordId = inquiryRecordId;
        gatherPlan.inquiryMaterialId = inquiryMaterialId;
        gatherPlan.inquiryMaterialCode = searchValue;

        const materialCode = handleEncodeURIComponent(searchValue.trim());
        const url = `https://www.ic.net.cn/search/${materialCode}.html`;
        const jywTabs = await chrome.tabs.query({
            url: "*://*.ic.net.cn/*"  // 匹配目标网站的所有标签页
        });

        for (const tab of jywTabs) {
            if (tab.active) {
                await chrome.tabs.update(tab.id, { url: url });
                break;
            }
        }
    }

    sendResponse({ success: true });
});

// 清空数据
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "clearGatherPlan") {
        handleClearGatherPlan();
        console.log('IC交易网一次轮询开始时：清空数据-----------', gatherPlan);
        sendResponse({ success: true });
    }
});

// 供应商采集结束
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "suppliersGatherOver") {
        const {
            suppliersResult,
            source,
        } = request.suppliersGatherOverData;
        const { success, data, error } = suppliersResult;
        const sourceName = sourceData.find(item => source.includes(item.url))?.name;

        if (sourceName === 'jyw') {
            gatherPlan.jyw = true;
            gatherPlan.jywSuppliers = data;
            console.log('【交易网】采集完成:', {
                success,
                suppliersCount: data?.length,
                error
            });
        }

        if (gatherPlan.jyw) {
            const deWeightTotalSuppliers = deWeightSuppliers(gatherPlan.jywSuppliers);

            const body = {
                companyId: gatherPlan.companyId,
                inquiryMaterialId: gatherPlan.inquiryMaterialId,
                inquiryRecordId: gatherPlan.inquiryRecordId,
                suppliers: deWeightTotalSuppliers
            }

            console.log('【交易网】的数据全部采集完成！！！！！！！！', '\n 总数据: ', body);

            // 更新询料物料状态 6: 已采集
            // await ICCRMAPI.updateInquiryMaterial(gatherPlan.inquiryMaterialId, {
            //     inquiry_material_status: '6'
            // })
            // 上报 创建临时数据
            // await ICCRMAPI.createTempData({ company_id: gatherPlan.companyId, kind: 'suppliers', json_data: JSON.stringify(body) })

            handleClearGatherPlan()
            console.log('清空数据-----------', gatherPlan);

            // 跳转至【交易网】首页
            // const jywTabs = await chrome.tabs.query({
            //     url: "*://*.ic.net.cn/*"  // 匹配目标网站的所有标签页
            // });
            // if (jywTabs.length) {
            //     await chrome.tabs.update(jywTabs[0].id, { url: 'https://www.ic.net.cn' });
            // }
        }

        sendResponse({ success: true });
    }
});