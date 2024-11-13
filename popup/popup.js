document.addEventListener('DOMContentLoaded', function () {
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
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

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
            searchInput.disabled = true;
        } else {
            statusIcon.classList.remove('active');
            statusIcon.classList.add('inactive');
            statusText.classList.remove('active');
            statusText.classList.add('inactive');
            statusText.textContent = '已停止';
            searchInput.disabled = false;
        }
    }

    /******************** 搜索按钮 **************************/
    // 监听输入框变化
    searchInput.addEventListener('input', function () {
        // 根据输入框是否有内容来设置按钮状态
        searchButton.disabled = !this.value.trim();
    });


    // 添加按钮点击事件
    searchButton.addEventListener('click', function () {
        const searchValue = searchInput.value.trim();
        if (searchValue) {
            // 在当前标签页更新URL
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                const url = `https://www.ic.net.cn/search/${searchValue}.html?page=1&jobId=666`;
                chrome.tabs.update(tabs[0].id, { url: url });
                // 关闭弹出窗口
                window.close();
            });
        }
    });

    // 添加输入框回车事件
    searchInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !searchButton.disabled) {
            searchButton.click();
        }
    });
});

