async function updateLastRunTime() {
    const result = await chrome.storage.local.get(['lastPollTime']);
    const lastRunTimeElement = document.getElementById('lastRunTime');
    lastRunTimeElement.textContent = result.lastPollTime || '-';
}

document.addEventListener('DOMContentLoaded', function () {
    // 更新上次运行时间
    updateLastRunTime();

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

    /************************ 登录状态 ************************/
    // 检查登录状态
    chrome.storage.local.get(['token'], function (result) {
        result.token ? viewHasLoginUi(true) : viewHasLoginUi(false);
    });

    // 登录按钮事件
    document.getElementById('loginButton').addEventListener('click', function () {
        const userAccount = document.getElementById('userAccount').value;
        const password = document.getElementById('password').value;

        // 调用登录接口
        fetch('https://ic.we5.fun/api/auth:signIn', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ account: userAccount, password })
        })
            .then(response => response.json())
            .then(async ({ data: { token, user } }) => {
                console.log('登录成功', token, user);
                if (token) {
                    // 存储token和用户信息
                    await chrome.storage.local.set({ token, user });
                    viewHasLoginUi(true);
                }
            })
            .catch(error => {
                console.error('登录错误:', error);
                alert('登录失败，请检查用户名和密码');
            });
    });

    // 退出登录按钮事件
    document.getElementById('logoutButton').addEventListener('click', async function () {
        // 清除token和用户信息
        await chrome.storage.local.remove(['token', 'user']);
        // 更新UI
        viewHasLoginUi(false);

        statusToggle.checked = false; // 设置开关为关闭
        chrome.storage.local.set({ isEnabled: false }); // 更新存储状态
        updateStatus(false); // 更新UI状态
    });

    // 显示登录状态UI
    function viewHasLoginUi(hasLogin) {
        if (hasLogin) {
            chrome.storage.local.get(['user'], function (result) {
                const user = result.user;
                document.getElementById('loginForm').style.display = 'none';
                document.querySelector('.status-card').style.display = 'block'; // 显示状态卡
                document.querySelector('.info-container').style.display = 'block'; // 显示信息部分    
                document.getElementById('usernameDisplay').textContent = user.nickname; // 显示用户名
                document.getElementById('logoutButton').style.display = 'block'; // 显示退出登录按钮
            });
        } else {
            document.getElementById('loginForm').style.display = 'block';
            document.querySelector('.status-card').style.display = 'none'; // 隐藏状态卡
            document.querySelector('.info-container').style.display = 'none'; // 隐藏信息部分
            document.getElementById('usernameDisplay').textContent = ''; // 隐藏用户名
            document.getElementById('logoutButton').style.display = 'none'; // 隐藏退出登录按钮
        }
    }

    /********************** 插件状态开关 *********************/
    // 从 storage 获取当前状态并初始化
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false; // 默认为true
        statusToggle.checked = isEnabled;
        updateStatus(isEnabled);

        // 初始化时也发送状态到background
        chrome.runtime.sendMessage({
            action: 'toggleStatus',
            isEnabled: isEnabled
        });
    });

    // 监听开关变化
    statusToggle.addEventListener('change', function () {
        const isEnabled = this.checked;
        console.log('开关状态改变:', isEnabled); // 调试日志

        // 保存状态
        chrome.storage.local.set({ isEnabled: isEnabled });

        // 更新UI
        updateStatus(isEnabled);

        // 发送消息到background
        chrome.runtime.sendMessage({
            action: 'toggleStatus',
            isEnabled: isEnabled
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
        } else {
            statusIcon.classList.remove('active');
            statusIcon.classList.add('inactive');
            statusText.classList.remove('active');
            statusText.classList.add('inactive');
            statusText.textContent = '已停止';
        }
    }

    /********************** 监听token user存储变化  退出登录 */
    chrome.storage.onChanged.addListener(function (changes, namespace) {
        // 只关注本地存储的变化
        if (namespace === 'local') {
            // 如果token或user发生了变化
            if (changes.token || changes.user) {
                // 检查token是否被删除了
                if (!changes.token?.newValue || !changes.user?.newValue) {
                    viewHasLoginUi(false); // 更新UI为未登录状态
                    statusToggle.checked = false; // 关闭状态开关
                    updateStatus(false); // 更新状态显示
                }
            }
        }
    });
});

