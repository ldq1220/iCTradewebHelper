// 检查当前页面是否为目标网站
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn', 'www.hqew.com', 's.hqew.com', 'www.szlcsc.com', 'so.szlcsc.com', 'm.ic.net.cn'];

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
    const result = await chrome.storage.local.get(['environment', 'account']);
    const hasYidun = await window.checkYiDdun()
    if (hasYidun) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "触发易盾",
            spiderTaskResult: spiderTaskResult
        });
        sendNtfy(`【移动端IC采集助手插件】：IC交易网触发易盾，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account} , spiderTaskResult：${JSON.stringify(spiderTaskResult)}`);
    }

    return hasYidun
}

// 处理未登录报警
const handleLoginAlarm = async (spiderTaskResult) => {
    let notLogin = false
    const result = await chrome.storage.local.get(['environment', 'account']);
    const loginUrl = window.location.href.includes('login')

    if (loginUrl) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "交易网未登录状态",
            spiderTaskResult: spiderTaskResult
        });
        sendNtfy(`【浏览器IC采集助手插件】：IC交易网处于未登录状态，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account} , spiderTaskResult：${JSON.stringify(spiderTaskResult)}`);
        notLogin = true
        return;
    }

    return notLogin
}

// 注入拦截器脚本
function injectInterceptorScript() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('js/networkInterceptor.js');
    script.onload = function () {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
}

// 如果是目标网站，注入拦截器
if (window.location.hostname === 'm.ic.net.cn') {
    injectInterceptorScript();
}

// 监听来自网页的消息 拦截到的响应数据
window.addEventListener('message', async function (event) {
    // 确保消息来自同一个窗口
    if (event.source !== window) return;

    // 检查消息类型 - 拦截库存数据
    if (event.data && event.data.type === 'IC_HELPER_INTERCEPTED_RESPONSE') {
        sleep(1000)

        const suppliersOrderInfo = await window.getSuppliersOrderInfo() // 获取页面供应商 资质等级 物料标签
        console.log('suppliersOrderInfo', suppliersOrderInfo)
        // 发送消息到插件的background.js
        chrome.runtime.sendMessage({
            action: 'intercepted_response',
            suppliersInfo: event.data,
            suppliersOrderInfo
        });

        console.log('IC Helper: 已将拦截到的响应数据发送到插件');

        // 任务完成后，通知background
        await sleep(1000); // 等待数据处理完成
        chrome.runtime.sendMessage({
            action: 'taskCompleted'
        });
    }

    // 检查消息类型 - 拦截新闻数据
    if (event.data && event.data.type === 'IC_HELPER_INTERCEPTED_NEWS') {
        sleep(1000)

        // 发送消息到插件的background.js
        chrome.runtime.sendMessage({
            action: 'intercepted_news',
            newsInfo: event.data
        });

        console.log('IC Helper: 已将拦截到的新闻数据发送到插件');
    }
});

if (IC_URL.includes(window.location.hostname)) {
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
                    const notLogin = await handleLoginAlarm(message.spiderTaskResult)
                    if (notLogin) return sendResponse({ success: false, error: '未登录状态' });

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
            const { code } = spiderTaskResult;

            // 设置执行状态并跳转
            await chrome.storage.local.set({ executeGetSuppliersProcess: true });
            await sleep(2000);

            // 搜索物料  拦截接口响应
            await window.searchMaterial(code)
        } catch (error) {
            logger.error('处理询料任务时发生错误:', error);
        }
    }
}