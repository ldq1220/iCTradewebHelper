// 检查当前页面是否为目标网站
const IC_URL_CONTENT = ['www.ic.net.cn', 'member.ic.net.cn'];

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
        sendNtfy(`【浏览器IC采集助手插件】：IC交易网触发易盾，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account} , spiderTaskResult：${JSON.stringify(spiderTaskResult)}`);
        hasYidun = true
    }

    return hasYidun
}

// 处理未登录报警
const handleLoginAlarm = async (spiderTaskResult) => {
    let notLogin = false
    const result = await chrome.storage.local.get(['environment', 'account']);
    const loginUrl = window.location.href.includes('login.php')

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

// 处理账号被封禁
const handleAccountBlocked = async (spiderTaskResult) => {
    const isBlocked = await window.checkAccountIsBlocked()
    const result = await chrome.storage.local.get(['environment', 'account']);
    if (isBlocked) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "交易网账号被封禁",
            spiderTaskResult: spiderTaskResult
        });
        sendNtfy(`【浏览器IC采集助手插件】：IC交易网账号被封禁，插件停止运行！！！ , 环境名：${result.environment} , 账号：${result.account} , spiderTaskResult：${JSON.stringify(spiderTaskResult)}`);
    }

    return isBlocked
}

if (IC_URL_CONTENT.includes(window.location.hostname)) {
    // 获取URL中的查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = {};

    // 将所有查询参数转换为对象
    for (const [key, value] of urlParams.entries()) {
        query[key] = value;
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', async () => {
        console.log('页面加载完毕，检查账号状态...')
        const result = await chrome.storage.local.get(['currentTask']);
        if (!result.currentTask) return

        // 检查是否触发易盾
        const hasYidun = await handleYidunAlarm(result.currentTask)
        if (hasYidun) return

        // 检查是否处于未登录状态
        const notLogin = await handleLoginAlarm(result.currentTask)
        if (notLogin) return

        // 检查账号是否被封禁
        const isBlocked = await handleAccountBlocked(result.currentTask)
        if (isBlocked) return
    })
}