function updateCurrentTime() {
    const now = new Date()
    const hours = now.getHours().toString().padStart(2, '0')
    const minutes = now.getMinutes().toString().padStart(2, '0')
    const seconds = now.getSeconds().toString().padStart(2, '0')
    document.getElementById(
        'currentTime'
    ).textContent = `${hours}:${minutes}:${seconds}`
}

// 验证和显示错误信息
function validateInputs() {
    const validationRules = [
        {
            field: 'environment',
            errorId: 'environmentError',
            validate: (value) => !!value.trim(),
            errorMessage: '环境名不能为空'
        }
    ]

    let isValid = true

    // 遍历验证每个字段
    validationRules.forEach((rule) => {
        const value = document.getElementById(rule.field).value.trim()
        const errorElement = document.getElementById(rule.errorId)

        if (!rule.validate(value)) {
            errorElement.textContent = rule.errorMessage
            isValid = false
        } else {
            errorElement.textContent = ''
        }
    })

    return isValid
}

// 保存配置到storage
async function saveConfig() {
    const environment = document.getElementById('environment').value.trim()

    try {
        // 保存配置
        await chrome.storage.local.set({
            environment: environment
        })
        console.log('保存配置成功:', {
            environment
        })
    } catch (e) {
        console.error('保存配置失败:', e)
    }
}

// 处理输入框值变化
async function handleInputChange() {
    if (validateInputs()) {
        await saveConfig()
    }
}

function updateStatus(isEnabled, statusIcon, statusText, reason = '手动') {
    // 需要控制的输入框
    const inputFields = ['environment'].map((id) => document.getElementById(id))

    // 检查元素是否存在
    if (!statusIcon || !statusText) {
        console.error('状态元素未找到');
        return;
    }

    // 更新状态样式
    statusIcon.classList.toggle('active', isEnabled)
    statusIcon.classList.toggle('inactive', !isEnabled)
    statusText.classList.toggle('active', isEnabled)
    statusText.classList.toggle('inactive', !isEnabled)

    // 更新状态文本
    statusText.textContent = isEnabled ? '自动' : '手动'

    // 更新输入框状态
    inputFields.forEach((input) => {
        if (input) {
            input.disabled = isEnabled
        }
    })
}

document.addEventListener('DOMContentLoaded', function () {
    // 更新上次运行时间
    updateCurrentTime()
    setInterval(updateCurrentTime, 1000)

    // 获取DOM元素
    const statusToggle = document.getElementById('statusToggle')
    const environmentInput = document.getElementById('environment')

    // 获取状态相关的元素
    const statusIcon = document.querySelector('.status-icon')
    const statusText = document.querySelector('.status-text')

    // 确保元素存在
    if (!statusIcon || !statusText) {
        console.error('状态元素未找到')
        return
    }

    // 监听输入框值变化
    environmentInput.addEventListener('change', handleInputChange)

    // 从storage加载保存的值
    chrome.storage.local.get(['environment'], function (result) {
        console.log('从storage加载保存的值--------------', result)
        if (result.environment) environmentInput.value = result.environment
    })

    /********************** 插件状态开关 *********************/
    // 从 storage 获取当前状态并初始化
    chrome.storage.local.get(['isEnabled'], async function (result) {
        console.log('isEnabled', result.isEnabled)
        const isEnabled =
            result.isEnabled !== false && result.isEnabled !== undefined // 默认为true

        // 如果是启用状态
        if (isEnabled && !validateInputs()) {
            statusToggle.checked = false
            updateStatus(false, statusIcon, statusText)
            return
        }

        // 设置开关状态和UI
        statusToggle.checked = isEnabled
        updateStatus(isEnabled, statusIcon, statusText)
    })

    // 监听开关变化
    statusToggle.addEventListener('change', async function () {
        const isEnabled = this.checked

        // 开启时验证输入
        if (isEnabled && !validateInputs()) {
            this.checked = false
            return
        }

        console.log('开关状态改变:', isEnabled) // 调试日志

        // 保存状态
        await chrome.storage.local.set({ isEnabled: isEnabled })

        // 更新UI
        updateStatus(isEnabled, statusIcon, statusText)

        // 向所有标签页广播消息
        try {
            const tabs = await chrome.tabs.query({})
            for (const tab of tabs) {
                if (tab.url && tab.url.includes('ic.net.cn')) {
                    try {
                        await chrome.tabs.sendMessage(tab.id, {
                            type: 'TOGGLE_STATUS',
                            isEnabled,
                            timestamp: Date.now() // 添加时间戳确保消息唯一
                        })
                    } catch (err) {
                        console.error('向标签页发送消息失败:', tab.id, err)
                    }
                }
            }
        } catch (err) {
            console.error('获取标签页失败:', err)
        }
    })
})
