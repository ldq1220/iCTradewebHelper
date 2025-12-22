// 检查当前页面是否为目标网站
const IC_URL_CONTENT = ["www.ic.net.cn", "member.ic.net.cn", "www.hqew.com", "s.hqew.com"];

window.setInterval = function () { };
Function.prototype.__constructor_back = Function.prototype.constructor;
Function.prototype.constructor = function () {
    if (arguments && typeof arguments[0] === "string") {
        if ("debugger" === arguments[0]) {
            return;
        }
    }
    return Function.prototype.__constructor_back.apply(this, arguments);
};

// 工具函数
const logger = {
    info: (msg, ...args) =>
        console.log(`[IC助手] ${msg}`, new Date().toLocaleString(), ...args),
    error: (msg, error) => console.error(`[IC助手] ${msg}:`, error ?? ""),
};

// 等待函数
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// NTFY通知
function sendNtfy(msg) {
    fetch("https://ntfy.we5.fun/prod_gemel", {
        method: "POST",
        headers: {
            "Content-Type": "text/plain",
        },
        body: msg,
    });
}
// Lucy机器人通知
function lucySendMessage(msg) {
    fetch("https://api.gemelai.com/api/open/chat/send", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-app-api-key": xAppApiKey,
        },
        body: {
            batchId: "IC采集助手消息通知",
            platform: "",
            fromUserId: "",
            type: true ? "private_message" : "group_message",
            groupId: "",
            toUserIds: [""],
            messages: [
                {
                    contentType: "text",
                    content: "",
                },
            ],
        },
    });
}

//  易盾报警
const handleYidunAlarm = async (spiderTaskResult) => {
    let hasYidun = false;
    const result = await chrome.storage.local.get(["environment", "account"]);
    const hasYidunUrl = window.location.href.includes("searchPnCode.php");

    if (hasYidunUrl) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "触发易盾",
            spiderTaskResult: spiderTaskResult,
        });
        const { code, grab_data_id, task } = spiderTaskResult;
        await fetch('https://ic-spider.we5.fun/api/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': 'U2FsdGVkX1+NZULLdP'
            },
            body: JSON.stringify({
                materials: [
                    {
                        code,
                        grab_data_id,
                        task
                    }
                ]
            })
        })
        sendNtfy(
            `【浏览器IC采集助手插件】：IC交易网触发易盾，插件停止运行！！！ , 环境名：${result.environment
            } , 账号：${result.account} , spiderTaskResult：${JSON.stringify(
                spiderTaskResult,
            )}`,
        );
        hasYidun = true;
    }

    return hasYidun;
};

// 处理未登录报警
const handleLoginAlarm = async (spiderTaskResult) => {
    let notLogin = false;
    const result = await chrome.storage.local.get(["environment", "account"]);
    const loginUrl = window.location.href.includes("login.php");

    if (loginUrl) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "交易网未登录状态",
            spiderTaskResult: spiderTaskResult,
        });
        sendNtfy(
            `【浏览器IC采集助手插件】：IC交易网处于未登录状态，插件停止运行！！！ , 环境名：${result.environment
            } , 账号：${result.account} , spiderTaskResult：${JSON.stringify(
                spiderTaskResult,
            )}`,
        );
        notLogin = true;
        return;
    }

    return notLogin;
};

// 处理账号被封禁
const handleAccountBlocked = async (spiderTaskResult) => {
    const isBlocked = await window.checkAccountIsBlocked();
    const result = await chrome.storage.local.get(["environment", "account"]);
    if (isBlocked) {
        chrome.runtime.sendMessage({
            action: "abnormalStop",
            reason: "交易网账号被封禁",
            spiderTaskResult: spiderTaskResult,
        });
        sendNtfy(
            `【浏览器IC采集助手插件】：IC交易网账号被封禁，插件停止运行！！！ , 环境名：${result.environment
            } , 账号：${result.account} , spiderTaskResult：${JSON.stringify(
                spiderTaskResult,
            )}`,
        );

        window.open("https://www.baidu.com", "_blank");
    }

    return isBlocked;
};

// 自动获取下一个任务
async function autoGetNextTask(platform) {
    try {
        const task = await SpiderApi.getSpliderTask(platform);

        // 检查task.code是否为空
        if (!task || !task.code) {
            logger.info("暂无采集任务");
            // 显示提示
            const toast = document.createElement("div");
            toast.className = "ic-helper-toast";
            toast.textContent = "暂无采集任务";
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
            return false;
        }

        // 存储task数据
        await chrome.storage.local.set({ currentTask: task });

        // 添加到历史记录
        const { taskHistory = [] } = await chrome.storage.local.get(['taskHistory']);

        // 添加新任务到历史记录前端
        const newHistory = [
            {
                code: task.code,
                hasReport: false
            },
            ...taskHistory
        ].slice(0, 3); // 只保留最新的3条记录

        await chrome.storage.local.set({ taskHistory: newHistory });

        // 通知更新历史记录面板
        try {
            chrome.runtime.sendMessage({
                action: "updateHistoryPanel",
                taskHistory: newHistory,
            });
        } catch (err) {
            console.error("发送更新消息失败:", err);
        }

        try {
            // 复制code到剪贴板
            await navigator.clipboard.writeText(task.code);

            // 显示复制成功提示
            const toast = document.createElement("div");
            toast.className = "ic-helper-toast";
            toast.textContent = `自动获取任务成功，已复制：${task.code}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);

            logger.info(`自动获取任务成功：${task.code}`);
            platform === 'jyw' ? await window.autoFocusInputByJyw() : await window.autoFocusInputByHqw()
            platform === 'jyw' ? await window.clearInputByJyw() : await window.clearInputByHqw()

            return true;
        } catch (error) {
            console.error('复制失败:', error);
            // 显示复制失败提示
            const toast = document.createElement("div");
            toast.className = "ic-helper-toast";
            toast.textContent = `自动获取任务成功：${task.code}，但复制失败，请手动复制`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
            return true;
        }

    } catch (error) {
        logger.error("自动获取下一个任务失败", error);
        return false;
    }
}

// 自动上报任务
async function autoReportTask(platform) {
    try {
        const { currentTask, environment } = await chrome.storage.local.get([
            "currentTask",
            "environment",
        ]);
        const href = window.location.href;

        if (!currentTask) {
            return false;
        }
        if (platform === 'jyw') {
            // 校验页面
            if (!href.includes("https://www.ic.net.cn/search")) {
                sendNtfy(
                    `【浏览器IC采集助手插件】：环境名: ${environment} , 当前页面不是IC交易网搜索页面，无法上报任务！！！，请及时处理。`,
                );
                return false;
            }

            // 校验搜索物料是否为当前任务的物料
            const topsearchBox = document.querySelector(".topsearchBox");
            if (!topsearchBox) {
                return false;
            }

            const searchInput = topsearchBox.querySelector(".topsch_input");
            if (!searchInput) {
                return false;
            }

            const searchMaterialCode = searchInput.value.toUpperCase().trim();
            if (!currentTask.code.toUpperCase().trim().includes(searchMaterialCode)) {
                const toast = document.createElement("div");
                toast.className = "ic-helper-toast";
                toast.textContent = `当前搜索物料: ${searchMaterialCode} 不是当前任务的物料: ${currentTask.code}，无法上报任务！！！，请重新搜索。`;
                document.body.appendChild(toast);

                await window.autoFocusInputByJyw()
                await navigator.clipboard.writeText(currentTask.code);
                setTimeout(() => toast.remove(), 3000);

                return false;
            }
        }

        if (platform === 'hqw') {
            const JInputSearch = document.getElementById('J_inputSearch')
            const JInputSearchValue = JInputSearch.value.toUpperCase().trim()
            if (!currentTask.code.toUpperCase().trim().includes(JInputSearchValue)) {
                const toast = document.createElement("div");
                toast.className = "ic-helper-toast";
                toast.textContent = `当前搜索物料: ${JInputSearchValue} 不是当前任务的物料: ${currentTask.code}，无法上报任务！！！，请重新搜索。`;
                document.body.appendChild(toast);

                await window.autoFocusInputByHqw()
                await navigator.clipboard.writeText(currentTask.code);
                setTimeout(() => toast.remove(), 3000);

                return false;
            }
        }

        console.log('🚀 开始自动上报任务')
        if (platform === 'hqw') {
            await sleep(1000)
        }
        await updateGrabData(currentTask, environment, platform)

    } catch (error) {
        logger.error("自动上报任务失败", error);
        return false;
    }
}

// updateGrabData
const updateGrabData = async (currentTask, environment, platform) => {
    // 获取供应商数据
    const updateGrabBody = {}

    const deWeightTotalSuppliers = platform === 'jyw' ? await window.getSuppliersProcessByJyw() : await window.getSuppliersProcessByHqw()
    if (platform === 'jyw') {
        Object.assign(updateGrabBody, {
            jyw_data: {
                total: deWeightTotalSuppliers.total,
                source: platform,
                suppliers: deWeightTotalSuppliers.data
            },
            jyw_data_from: environment
        })
    } else if (platform === 'hqw') {
        Object.assign(updateGrabBody, {
            hqw_data: {
                total: deWeightTotalSuppliers.total,
                source: platform,
                suppliers: deWeightTotalSuppliers.data
            },
            hqw_data_from: environment
        })
    }

    // 上报数据
    console.log(`🚀 ${platform} 上报信息:`, currentTask, updateGrabBody);
    await ICCRMAPI.updateGrabData(currentTask.grab_data_id, updateGrabBody)
    await chrome.storage.local.remove("currentTask");

    // 更新历史记录中的状态
    const { taskHistory = [] } = await chrome.storage.local.get([
        "taskHistory",
    ]);
    const updatedHistory = taskHistory.map((item) => {
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
            taskHistory: updatedHistory,
        });
    } catch (err) {
        console.error("发送更新消息失败:", err);
    }

    // 显示上报成功提示
    const toast = document.createElement("div");
    toast.className = "ic-helper-toast";
    toast.textContent = "自动上报成功";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);

    // 自动获取下一个任务
    sleep(500)
    await autoGetNextTask(platform)
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
    window.addEventListener("load", async () => {
        const result = await chrome.storage.local.get(["currentTask", "isEnabled"]);
        if (!result.currentTask) return
        const platform = window.UTILS.getCurrentPlatform();

        if (platform === 'jyw') {
            // 检查是否触发易盾
            const hasYidun = await handleYidunAlarm(result.currentTask);
            if (hasYidun) return;

            // 检查是否处于未登录状态
            const notLogin = await handleLoginAlarm(result.currentTask);
            if (notLogin) return;

            // 检查账号是否被封禁
            const isBlocked = await handleAccountBlocked(result.currentTask);
            if (isBlocked) return;
        }

        // 自动上报 - 检查是否开启自动模式
        const isEnabled =
            result.isEnabled !== false && result.isEnabled !== undefined;
        if (isEnabled) await autoReportTask(platform);
    });
}
