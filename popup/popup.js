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
    const validationRules = [
        {
            field: 'environment',
            errorId: 'environmentError',
            validate: value => !!value.trim(),
            errorMessage: '环境名不能为空'
        },
        {
            field: 'account',
            errorId: 'accountError',
            validate: value => !!value.trim(),
            errorMessage: '账号不能为空'
        },
        {
            field: 'password',
            errorId: 'passwordError',
            validate: value => !!value.trim(),
            errorMessage: '密码不能为空'
        }
    ];

    let isValid = true;

    // 遍历验证每个字段
    validationRules.forEach(rule => {
        const value = document.getElementById(rule.field).value.trim();
        const errorElement = document.getElementById(rule.errorId);

        if (!rule.validate(value)) {
            errorElement.textContent = rule.errorMessage;
            isValid = false;
        } else {
            errorElement.textContent = '';
        }
    });

    return isValid;
}

// 保存配置到storage
async function saveConfig() {
    const environment = document.getElementById('environment').value.trim();
    const account = document.getElementById('account').value.trim();
    const password = document.getElementById('password').value.trim();
    const loopSecond = Number(document.getElementById('loopSecond').value);
    const minPauseTime = Number(document.getElementById('minPauseTime').value);
    const maxPauseTime = Number(document.getElementById('maxPauseTime').value);

    try {
        // 保存配置
        await chrome.storage.local.set({
            environment: environment,
            account: account,
            password: password,
            loopSecond: loopSecond,
            minPauseTime: minPauseTime,
            maxPauseTime: maxPauseTime
        });
        console.log('保存配置成功:', {
            environment,
            account,
            password,
            loopSecond,
            minPauseTime,
            maxPauseTime
        });
    } catch (e) {
        console.error('保存配置失败:', e);
    }
}

// 处理输入框值变化
async function handleInputChange() {
    if (validateInputs()) {
        await saveConfig();
    }
}

function updateStatus(isEnabled, reason = '已停止') {
    // 状态相关的元素
    const statusElements = {
        icon: document.querySelector('.status-icon'),
        text: document.querySelector('.status-text')
    };

    // 需要控制的输入框
    const inputFields = ['environment', 'account', 'password', 'loopSecond', 'minPauseTime', 'maxPauseTime'].map(
        id => document.getElementById(id)
    );

    // 更新状态样式
    ['icon', 'text'].forEach(element => {
        const el = statusElements[element];
        el.classList.toggle('active', isEnabled);
        el.classList.toggle('inactive', !isEnabled);
    });

    // 更新状态文本
    statusElements.text.textContent = isEnabled ? '正在运行' : reason;

    // 更新输入框状态
    inputFields.forEach(input => {
        input.disabled = isEnabled;
    });
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updatePopupSwitch") {
        const switchElement = document.getElementById('statusToggle');
        if (switchElement) {
            switchElement.checked = message.enabled;
            updateStatus(message.enabled, message.reason);
        }
    }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "updateLastRunTime") {
        updateLastRunTime();
    }
});


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
    const environmentInput = document.getElementById('environment');
    const accountInput = document.getElementById('account');
    const passwordInput = document.getElementById('password');
    const loopSecondInput = document.getElementById('loopSecond');
    const minPauseTimeInput = document.getElementById('minPauseTime');
    const maxPauseTimeInput = document.getElementById('maxPauseTime');

    // 监听输入框值变化
    environmentInput.addEventListener('change', handleInputChange);
    accountInput.addEventListener('change', handleInputChange);
    passwordInput.addEventListener('change', handleInputChange);
    loopSecondInput.addEventListener('change', handleInputChange);
    minPauseTimeInput.addEventListener('change', handleInputChange);
    maxPauseTimeInput.addEventListener('change', handleInputChange);

    // 从storage加载保存的值
    chrome.storage.local.get(['environment', 'account', 'password', 'loopSecond', 'minPauseTime', 'maxPauseTime'], function (result) {
        console.log('从storage加载保存的值--------------', result)
        if (result.environment) environmentInput.value = result.environment
        if (result.account) accountInput.value = result.account
        if (result.password) passwordInput.value = result.password

        loopSecondInput.value = result.loopSecond ? Number(result.loopSecond) : 10;
        minPauseTimeInput.value = result.minPauseTime ? Number(result.minPauseTime) : 45;
        maxPauseTimeInput.value = result.maxPauseTime ? Number(result.maxPauseTime) : 60;

        if (!result.loopSecond) chrome.storage.local.set({ loopSecond: 10 });
        if (!result.minPauseTime) chrome.storage.local.set({ minPauseTime: 45 });
        if (!result.maxPauseTime) chrome.storage.local.set({ maxPauseTime: 60 });
    });

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
});


