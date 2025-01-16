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
        hqw: false,
        hqwSuppliers: [],
        lcsc: false,
        lcscMaterialInfos: [],
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
        if (jywTabs.length) {
            await chrome.tabs.update(jywTabs[0].id, { url: url });;
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
        } else if (sourceName === 'hqw') {
            gatherPlan.hqw = true;
            gatherPlan.hqwSuppliers = data;
            console.log('【华强网】采集完成:', {
                success,
                suppliersCount: data?.length,
                error
            });
        } else if (sourceName === 'lcsc') {
            gatherPlan.lcsc = true;
            gatherPlan.lcscMaterialInfos = data;
            console.log('【立创商城】采集完成:', {
                success,
                suppliersCount: data?.length,
                error
            });
        }

        console.log('gatherPlan', gatherPlan);

        // 跳转【华强网】标签页
        if (gatherPlan.jyw && !gatherPlan.hqw && !gatherPlan.lcsc) {
            console.log('跳转至【华强网】对应物料编码的搜索页面');
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            await sleep(2000)
            const materialCode = handleEncodeURIComponent(gatherPlan.inquiryMaterialCode.trim());

            const urlHqw = `https://s.hqew.com/${materialCode}.html`;
            const newTab = await chrome.tabs.create({ url: urlHqw });
            // 等待新页面加载完成
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTab.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });
            await sleep(2000)
            await chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
            await sleep(2000)
            // 先清除状态,再关闭【华强网】标签页
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            console.log('【华强网】标签页关闭完成。');
            const hqwTabs = await chrome.tabs.query({
                url: "*://*.hqew.com/*"  // 匹配目标网站的所有标签页
            });
            if (hqwTabs.length) await chrome.tabs.remove(hqwTabs[0].id);

            // 跳转【立创商城】标签页
            console.log('跳转至【华强网】对应物料编码的搜索页面');
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            await sleep(2000)
            const urlLcsc = `https://so.szlcsc.com/global.html?k=${materialCode}`
            const newTabLcsc = await chrome.tabs.create({ url: urlLcsc });
            // 等待新页面加载完成
            await new Promise(resolve => {
                chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
                    if (tabId === newTabLcsc.id && info.status === 'complete') {
                        chrome.tabs.onUpdated.removeListener(listener);
                        resolve();
                    }
                });
            });
            await sleep(2000)
            await chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
            await sleep(2000)
            // 先清除状态,再关闭【立创商城】标签页
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            console.log('【立创商城】标签页关闭完成。');
            const lcscTabs = await chrome.tabs.query({
                url: "*://*.szlcsc.com/*"  // 匹配目标网站的所有标签页
            });
            if (lcscTabs.length) await chrome.tabs.remove(lcscTabs[0].id);
        }

        if (gatherPlan.hqw && gatherPlan.jyw && gatherPlan.lcsc) {
            const totalSuppliers = [...gatherPlan.jywSuppliers, ...gatherPlan.hqwSuppliers];
            const deWeightTotalSuppliers = deWeightSuppliers(totalSuppliers);

            const body = {
                companyId: gatherPlan.companyId,
                inquiryMaterialId: gatherPlan.inquiryMaterialId,
                inquiryRecordId: gatherPlan.inquiryRecordId,
                suppliers: deWeightTotalSuppliers
            }

            console.log('交易网、华强网、立创商城的数据全部采集完成！！！！！！！！', '\n 总数据: ', totalSuppliers, '\n 去重后数据: ', deWeightTotalSuppliers, '\n【立创商城】', gatherPlan.lcscMaterialInfos, body);
            // await ICCRMAPI.createTempData({ company_id: companyId, kind: 'suppliers', json_data: JSON.stringify(body) })

            handleClearGatherPlan()
            console.log('清空数据-----------', gatherPlan);
        }

        sendResponse({ success: true });
    }
});