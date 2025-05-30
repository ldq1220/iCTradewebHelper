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

        window.open('https://www.baidu.com', '_blank');
    }

    return isBlocked
}

// 自动上报任务
async function autoReportTask() {
    try {
        logger.info('开始自动上报任务...');
        const { currentTask, environment } = await chrome.storage.local.get(['currentTask', 'environment']);

        if (!currentTask) {
            logger.info('当前没有可上报的任务');
            return false;
        }

        // 校验页面
        const href = window.location.href;
        if (!href.includes('https://www.ic.net.cn/search')) {
            sendNtfy(`【浏览器IC采集助手插件】：环境名: ${environment} , 当前页面不是IC交易网搜索页面，无法上报任务！！！，请及时处理。`);
            logger.error('当前页面不是IC交易网搜索页面，无法上报任务');
            return false;
        }

        // 校验搜索物料是否为当前任务的物料
        const topsearchBox = document.querySelector('.topsearchBox');
        if (!topsearchBox) {
            logger.error('找不到搜索框元素');
            return false;
        }

        const searchInput = topsearchBox.querySelector('.topsch_input');
        if (!searchInput) {
            logger.error('找不到搜索输入框元素');
            return false;
        }

        const searchMaterialCode = searchInput.value.toUpperCase().trim();
        if (!currentTask.code.toUpperCase().trim().includes(searchMaterialCode)) {
            sendNtfy(`【浏览器IC采集助手插件】：环境名: ${environment} , 当前搜索物料: ${searchMaterialCode} 不是当前任务的物料: ${currentTask.code}，无法上报任务！！！，请及时处理。`);
            logger.error('当前搜索物料与任务不匹配');
            return false;
        }

        // 获取供应商数据
        const deWeightTotalSuppliers = await window.getSuppliersProcessByJyw();
        const body = {
            companyId: currentTask.company_id,
            inquiryMaterialId: currentTask.inquiry_material_id,
            inquiryRecordId: currentTask.inquiry_record_id,
            suppliers: deWeightTotalSuppliers.data,
        };

        logger.info('上报任务结果:', body);

        // 清除当前任务
        await chrome.storage.local.remove('currentTask');

        // 上报数据
        await ICCRMAPI.updateTempData(currentTask.temp_data_id, {
            desc: `环境: ${environment}`,
            json_data_plugin: JSON.stringify(body)
        });

        // 更新历史记录中的状态
        const { taskHistory = [] } = await chrome.storage.local.get(['taskHistory']);
        const updatedHistory = taskHistory.map(item => {
            if (currentTask.code.includes(item.code)) {
                return { ...item, hasReport: true };
            }
            return item;
        });

        // 先保存更新后的历史记录
        await chrome.storage.local.set({ taskHistory: updatedHistory });

        // 通知更新历史记录面板
        try {
            chrome.runtime.sendMessage({
                action: "updateHistoryPanel",
                taskHistory: updatedHistory
            });
        } catch (err) {
            console.error('发送更新消息失败:', err);
        }

        // 显示上报成功提示
        const toast = document.createElement('div');
        toast.className = 'ic-helper-toast';
        toast.textContent = '自动上报成功';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);

        logger.info('自动上报任务成功');
        return true;
    } catch (error) {
        logger.error('自动上报任务失败', error);
        return false;
    }
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
        const result = await chrome.storage.local.get(['currentTask', 'isEnabled']);
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

        // 自动上报 - 检查是否开启自动模式
        const isEnabled = result.isEnabled !== false && result.isEnabled !== undefined;
        if (isEnabled) {
            logger.info('自动模式已开启，准备自动上报...');
            await autoReportTask();
        } else {
            logger.info('手动模式，不执行自动上报');
        }
    })
}