document.addEventListener('DOMContentLoaded', function () {
    // 获取当前标签页信息
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
        const url = new URL(tabs[0].url);
        document.getElementById('domain').textContent = url.hostname;
        document.getElementById('query').textContent = url.search || '无';
    });

    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');

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

