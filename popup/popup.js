async function updateLastRunTime() {
    const result = await chrome.storage.local.get(['lastPollTime']);
    const lastRunTimeElement = document.getElementById('lastRunTime');
    lastRunTimeElement.textContent = result.lastPollTime || '-';
}

function updateCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const seconds = now.getSeconds().toString().padStart(2, '0');
    document.getElementById('currentTime').textContent = `${hours}:${minutes}:${seconds}`;
}

// 验证和显示错误信息
function validateInputs() {
    const companyIds = document.getElementById('companyIds').value.trim();
    const token = document.getElementById('token').value.trim();
    const limit = document.getElementById('limit').value.trim();
    const idsError = document.getElementById('idsError');
    const tokenError = document.getElementById('tokenError');
    const limitError = document.getElementById('limitError');
    let isValid = true;

    // 验证token
    if (!token) {
        tokenError.textContent = 'Token不能为空';
        isValid = false;
    } else {
        tokenError.textContent = '';
    }

    // 验证公司IDs
    if (!companyIds) {
        idsError.textContent = '公司Ids不能为空';
        isValid = false;
    } else {
        try {
            const ids = JSON.parse(companyIds);
            if (!Array.isArray(ids)) {
                idsError.textContent = '请输入正确的数组格式';
                isValid = false;
            } else if (ids.length === 0) {
                idsError.textContent = '数组不能为空';
                isValid = false;
            } else {
                idsError.textContent = '';
            }
        } catch (e) {
            idsError.textContent = '请输入正确的数组格式';
            isValid = false;
        }
    }

    // 验证limit
    if (!limit) {
        limitError.textContent = '数量不能为空';
        isValid = false;
    } else {
        limitError.textContent = '';
    }

    return isValid;
}

// 保存配置到storage
async function saveConfig() {
    const companyIds = document.getElementById('companyIds').value.trim();
    const token = document.getElementById('token').value.trim();
    const limit = document.getElementById('limit').value.trim();
    try {
        // 尝试解析公司IDs
        const ids = JSON.parse(companyIds);
        if (!Array.isArray(ids)) {
            return false;
        }
        // 保存配置
        await chrome.storage.local.set({
            companyIds: ids,
            iccrmToken: token,
            limit: limit
        });
        return true;
    } catch (e) {
        console.error('保存配置失败:', e);
        return false;
    }
}

// 处理输入框值变化
async function handleInputChange() {
    if (validateInputs()) {
        await saveConfig();
    }
}

document.addEventListener('DOMContentLoaded', function () {
    // 更新上次运行时间
    updateLastRunTime();
    updateCurrentTime();
    setInterval(updateCurrentTime, 1000);

    // 获取当前标签页信息
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const url = new URL(tabs[0].url);
        document.getElementById('domain').textContent = url.hostname;
        document.getElementById('query').textContent = url.search || '无';
    });

    // 获取DOM元素
    const statusToggle = document.getElementById('statusToggle');
    const statusIcon = document.querySelector('.status-icon');
    const statusText = document.querySelector('.status-text');
    const companyIdsInput = document.getElementById('companyIds');
    const tokenInput = document.getElementById('token');
    const limitInput = document.getElementById('limit');

    // 从storage加载保存的值
    chrome.storage.local.get(['companyIds', 'iccrmToken', 'limit'], function (result) {
        console.log('companyIds', result.companyIds, 'iccrmToken', result.iccrmToken, 'limit', result.limit)
        const iccrmToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsInJvbGVOYW1lIjoicm9vdCIsImlhdCI6MTczMTY1MjQyMywiZXhwIjozMzI4OTI1MjQyM30.9gqsT7pVshkjWL1cHYVXYhxHcoR5cfHQS0p1zOjmQMU'


        if (result.companyIds) companyIdsInput.value = JSON.stringify(result.companyIds);
        tokenInput.value = iccrmToken
        if (result.limit) {
            limitInput.value = result.limit
        } else {
            limitInput.value = 20
            chrome.storage.local.set({ limit: 20 })
        };
        chrome.storage.local.set({ iccrmToken: iccrmToken })
    });

    // 监听输入框值变化
    companyIdsInput.addEventListener('change', handleInputChange);
    tokenInput.addEventListener('change', handleInputChange);
    limitInput.addEventListener('change', handleInputChange);

    /********************** 插件状态开关 *********************/
    // 从 storage 获取当前状态并初始化
    chrome.storage.local.get(['isEnabled'], async function (result) {
        console.log('isEnabled', result.isEnabled)
        const isEnabled = result.isEnabled !== false && result.isEnabled !== undefined; // 默认为true

        // 如果是启用状态
        if (isEnabled && !validateInputs()) {
            statusToggle.checked = false;
            updateStatus(false);
            return;
        }

        // 设置开关状态和UI
        statusToggle.checked = isEnabled;
        updateStatus(isEnabled);

        // 发送状态到background
        chrome.runtime.sendMessage({
            action: 'toggleStatus',
            isEnabled: isEnabled,
        });
    });

    // 监听开关变化
    statusToggle.addEventListener('change', async function () {
        const isEnabled = this.checked;

        // 开启时验证输入
        if (isEnabled && !validateInputs()) {
            this.checked = false;
            return;
        }

        console.log('开关状态改变:', isEnabled); // 调试日志

        // 保存状态
        chrome.storage.local.set({ isEnabled: isEnabled });

        // 更新UI
        updateStatus(isEnabled);

        // 发送消息到background
        chrome.runtime.sendMessage({
            action: 'toggleStatus',
            isEnabled: isEnabled,
        }, response => {
            console.log('background响应:', response); // 调试日志
        });
    });

    function updateStatus(isEnabled) {
        if (isEnabled) {
            statusIcon.classList.add('active');
            statusIcon.classList.remove('inactive');
            statusText.classList.add('active');
            statusText.classList.remove('inactive');
            statusText.textContent = '正在运行';
            // 禁用输入框
            companyIdsInput.disabled = true;
            tokenInput.disabled = true;
            limitInput.disabled = true;
        } else {
            statusIcon.classList.remove('active');
            statusIcon.classList.add('inactive');
            statusText.classList.remove('active');
            statusText.classList.add('inactive');
            statusText.textContent = '已停止';
            // 启用输入框
            companyIdsInput.disabled = false;
            tokenInput.disabled = false;
            limitInput.disabled = false;
        }
    }
});


