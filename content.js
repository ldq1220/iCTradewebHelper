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

window.setInterval = function () { };
Function.prototype.__constructor_back = Function.prototype.constructor;
Function.prototype.constructor = function () {
    if (arguments && typeof arguments[0] === 'string') {
        if ("debugger" === arguments[0]) {
            return
        }
    }
    return Function.prototype.__constructor_back.apply(this, arguments);
}

// 工具函数
const logger = {
    info: (msg, ...args) => console.log(`[IC助手] ${msg}`, new Date().toLocaleString(), ...args),
    error: (msg, error) => console.error(`[IC助手] ${msg}:`, error ?? '')
};

// 等待函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// NTFY通知
function sendNtfy(msg) {
    fetch('https://ntfy.we5.fun/prod_gemel', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: msg
    })
}
// Lucy机器人通知
function lucySendMessage(msg) {
    fetch('https://api.gemelai.com/api/open/chat/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-app-api-key': xAppApiKey,
        },
        body: {
            batchId: 'IC采集助手消息通知',
            platform: '',
            fromUserId: '',
            type: true ? 'private_message' : 'group_message',
            groupId: '',
            toUserIds: [''],
            messages: [
                {
                    contentType: 'text',
                    content: '',
                },
            ],
        }
    })
}

//  易盾报警
const handleYidunAlarm = async (spiderTaskResult) => {
    let hasYidun = false
    const result = await chrome.storage.local.get(['environment', 'account']);
    const hasYidunUrl = window.location.href.includes('searchPnCode.php')

    if (hasYidunUrl) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "触发易盾",
            spiderTaskResult: spiderTaskResult
        });
        sendNtfy(`【浏览器IC采集助手插件】：IC交易网触发易盾，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account}`);
        hasYidun = true
    }

    return hasYidun
}

// 处理未登录报警
const handleLoginAlarm = async (spiderTaskResult) => {
    let hasLogin = false
    const result = await chrome.storage.local.get(['environment', 'account']);
    const hasLoginUrl = window.location.href.includes('login.php')

    if (hasLoginUrl) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "交易网未登录状态",
            spiderTaskResult: spiderTaskResult
        });
        sendNtfy(`【浏览器IC采集助手插件】：IC交易网处于未登录状态，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account}`);
        hasLogin = true
        return;
    }

    return hasLogin
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
                    // 存储当前时间  存储当前任务
                    await chrome.storage.local.set({ lastPollTime: new Date().toLocaleString(), spiderTaskResult: message.spiderTaskResult });

                    // 检查是否触发易盾
                    const hasYidun = await handleYidunAlarm(message.spiderTaskResult)
                    if (hasYidun) return sendResponse({ success: false, error: '触发易盾' });

                    // 检查是否处于未登录状态
                    const hasLogin = await handleLoginAlarm(message.spiderTaskResult)
                    if (hasLogin) return sendResponse({ success: false, error: '未登录状态' });

                    // 通知background.js 先清空数据
                    if (window.location.hostname.includes('ic.net.cn')) {
                        chrome.runtime.sendMessage({ action: "clearGatherPlan" });
                    }

                    await handleInquiryTask(message.spiderTaskResult); // 等待异步任务完成
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
    async function handleInquiryTask(spiderTaskResult) {
        try {
            // 先清除上一次的状态
            await chrome.storage.local.remove('executeGetSuppliersProcess');
            const { code, company_id, inquiry_material_id, inquiry_record_id, temp_data_id } = spiderTaskResult;

            // 设置执行状态并跳转
            await chrome.storage.local.set({ executeGetSuppliersProcess: true });
            await sleep(2000);
            await chrome.runtime.sendMessage({
                action: "gotoJywSearchPage",
                inquiryRecordId: inquiry_record_id,
                inquiryMaterialId: inquiry_material_id,
                searchValue: code,
                companyId: company_id,
                tempDataId: temp_data_id
            });

        } catch (error) {
            logger.error('处理询料任务时发生错误:', error);
        }
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', async () => {
        await sleep(3000); // 等待3秒
        await chrome.storage.local.get(['executeGetSuppliersProcess'], async (result) => {
            if (result.executeGetSuppliersProcess) {
                // 获取当前任务
                const result = await chrome.storage.local.get('spiderTaskResult');

                // 检查是否触发易盾
                const hasYidun = await handleYidunAlarm(result.spiderTaskResult)
                if (hasYidun) return

                // 检查是否处于未登录状态
                const hasLogin = await handleLoginAlarm(result.spiderTaskResult)
                if (hasLogin) return

                let suppliersResult = await getSuppliersProcessByJyw(); // 获取【交易网】供应商信息

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