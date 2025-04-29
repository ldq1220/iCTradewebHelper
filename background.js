// 2.0.4 从百度跳转
// 2.0.3 物料标签补充
// 2.0.2 fix: 现货排名标签错误
// 2.0.1 优化
// 2.0.0 移动端采集
// 直接引入 poll.js
importScripts('js/poll.js');
importScripts('js/icCrmApiBackground.js');
importScripts('js/spiderApi.js');

function sendNtfy(msg) {
    fetch('https://ntfy.we5.fun/prod_gemel', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: msg
    })
}

// 拦截接口响应
chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [1, 2, 3],
    addRules: [
        {
            id: 1,
            priority: 1,
            action: { type: "allow" },
            condition: {
                urlFilter: "*://max.ic.net.cn/*",
                resourceTypes: ["xmlhttprequest"]
            }
        },
        {
            id: 2,
            priority: 2,
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: "\\0" // 表示使用原始URL
                }
            },
            condition: {
                regexFilter: ".*://max\\.ic\\.net\\.cn/async/search\\.asy\\.php.*IC_Method=getstockdata.*",
                resourceTypes: ["xmlhttprequest"]
            }
        },
        {
            id: 3,
            priority: 2,
            action: {
                type: "redirect",
                redirect: {
                    regexSubstitution: "\\0" // 表示使用原始URL
                }
            },
            condition: {
                regexFilter: ".*://max\\.ic\\.net\\.cn/async/news\\.asy\\.php.*IC_Method=getOneNewsInfo.*",
                resourceTypes: ["xmlhttprequest"]
            }
        }
    ]
});

const gatherPlan = {
    jyw: false,
    jywSuppliers: [],
    companyId: null,
    inquiryRecordId: null,
    inquiryMaterialId: null,
    inquiryMaterialCode: null,
    tempDataId: null,
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
        tempDataId: null,
    })
}
async function handleJywTabsLastId() {
    const jywTabs = await chrome.tabs.query({
        url: "*://*.ic.net.cn/*"  // 匹配目标网站的所有标签页
    });
    return jywTabs[jywTabs.length - 1].id;
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

// 监听来自content.js的消息  异常停止 
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === "abnormalStop") {
        await handleAbnormalStop(message.reason, message.spiderTaskResult);
        sendResponse({ success: true });
    }
});

// 处理异常停止的函数
async function handleAbnormalStop(reason, spiderTaskResult) {
    Poll.abnormalStopPolling(reason);

    const reasonExclude = ['交易网账号被封禁']
    // 回复spider server 数据
    if (spiderTaskResult && spiderTaskResult?.code && !reasonExclude.includes(reason)) {
        const { code, company_id, inquiry_material_id, inquiry_record_id, temp_data_id, task } = spiderTaskResult;
        await fetch('https://ic-spider2.we5.fun/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'U2FsdGVkX1+NZULLdP'
            },
            body: JSON.stringify({
                materials: [
                    {
                        code,
                        company_id,
                        inquiry_material_id,
                        inquiry_record_id,
                        temp_data_id,
                        task
                    }
                ]
            })
        })
    }

}

// 初始化百度网站
async function initBaiduTab() {
    // 查找当前是否有百度标签页
    const baiduTabs = await chrome.tabs.query({
        url: "*://*.baidu.com/*"
    });

    // 如果没有百度标签页，创建一个
    if (baiduTabs.length === 0) {
        await chrome.tabs.create({
            url: "https://www.baidu.com/",
            active: true
        });
    } else {
        // 如果有，激活第一个百度标签页
        await chrome.tabs.update(baiduTabs[0].id, {
            active: true
        });
    }
}

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleStatus') {
        if (message.isEnabled) {
            console.log('开启插件 ',);
            Poll.config.abnormalStopped = false;
            initBaiduTab().then(() => {
                Poll.startPolling();
            });
        } else {
            Poll.stopPolling();
        }
        sendResponse({ success: true }); // 发送响应
    }

    return true; // 保持消息通道开启
});

// 清空数据
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "clearGatherPlan") {
        handleClearGatherPlan();
        sendResponse({ success: true });
    }
});

// 监听来自content_script的消息
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    if (message.action === 'intercepted_response') {
        const localResult = await chrome.storage.local.get(['isEnabled', 'spiderTaskResult'])
        const result = await chrome.storage.local.get(['environment', 'account']);
        // 如果开关未打开
        if (!localResult.isEnabled) {
            return;
        }

        // 如果spiderTaskResult不存在
        if (!localResult.spiderTaskResult) {
            return;
        }

        const { responseData } = message.suppliersInfo;
        const stockList = tryParseJSON(responseData).stockList;
        const { temp_data_id, company_id, inquiry_material_id, inquiry_record_id } = localResult.spiderTaskResult
        const deWeightTotalSuppliers = deWeightSuppliers(tidyData(stockList, message.suppliersOrderInfo));
        const body = {
            companyId: company_id,
            inquiryMaterialId: inquiry_material_id,
            inquiryRecordId: inquiry_record_id,
            suppliers: deWeightTotalSuppliers,
        }
        console.log('body---', body)
        await ICCRMAPI.updateTempData(temp_data_id, { desc: `环境: ${result.environment}`, json_data_plugin: JSON.stringify(body) })
        await chrome.storage.local.remove('spiderTaskResult');

        // 例如：修改响应数据，存储到本地，进行分析等
        sendResponse({ success: true });
    }

    // 处理新闻数据  IC_Method=getOneNewsInfo
    if (message.action === 'intercepted_news') {
        try {
            const { responseData } = message.newsInfo;

            // 解析新闻数据
            const newsData = tryParseJSON(responseData);
            console.log('解析后的新闻数据:', newsData);

            // 检查是否包含禁止访问的信息
            const errorText = newsData.error || newsData.rawData || responseData || '';
            const result = await chrome.storage.local.get(['environment', 'account', 'spiderTaskResult', 'isEnabled']);

            if (typeof errorText === 'string' && errorText.includes('禁止访问, 请联系客服') && result.isEnabled) {
                console.log('检测到账号被封禁信息:', errorText);
                // 发送通知
                sendNtfy(`【浏览器IC采集助手插件】：IC交易网账号被封禁，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account} , spiderTaskResult：${JSON.stringify(result.spiderTaskResult)}`);

                // 调用异常停止函数
                await handleAbnormalStop("交易网账号被封禁", result.spiderTaskResult);
            }

            // 响应处理成功
            sendResponse({ success: true });
        } catch (error) {
            console.error('处理新闻数据出错:', error);
            sendResponse({ success: false, error: error.message });
        }
    }

    return true; // 保持消息通道开启
});

// 尝试解析JSON
function tryParseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return { error: '无法解析为JSON', rawData: str };
    }
}

// 整理数据 
function tidyData(suppliersList, suppliersOrderInfo) {
    if (suppliersList.length === 0) return []
    const result = suppliersList.map((item, index) => {
        const { CompanyName, StockDate, ChipList, QQ1, QQ2 } = item
        const firstChipList = ChipList?.[0] || {}
        return {
            id: index + 1,
            companyName: CompanyName,
            companyTag: [],
            companyInfo: {},
            materialId: [firstChipList.PartNo] || [],
            materialTags: [],
            brand: firstChipList.Mfg || '',
            batchId: firstChipList.Dc || '',
            totalNumber: firstChipList.Qty || '',
            packaging: firstChipList.Pack || '',
            storehouse: firstChipList.Location || '',
            desc: firstChipList.Description || '',
            qqAccount: [QQ1, QQ2].filter(Boolean),
            source: 'jyw',
            materialDate: StockDate.split(' ')[0]
        }
    })

    for (const r of result) {
        for (const i of suppliersOrderInfo) {
            if (r.companyName === i.companyName) {
                r.companyTag = i.companyTag
                r.materialTags = i.materialTags
                break;
            }
        }
    }

    return result
}