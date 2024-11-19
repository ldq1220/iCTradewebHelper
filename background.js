// 直接引入 poll.js
importScripts('js/poll.js');

// 监听来自popup的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'toggleStatus') {
        message.isEnabled ? Poll.startPolling() : Poll.stopPolling();
        sendResponse({ success: true }); // 发送响应
    }
    return true; // 保持消息通道开启
});

// 插件安装时初始化
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 浏览器启动时初始化
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get(['isEnabled'], function (result) {
        const isEnabled = result.isEnabled !== false;
        if (isEnabled) {
            Poll.startPolling();
        }
    });
});

// 监听 跳转至IC交易网搜索页面
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "gotoSearchPage") {
        const { searchValue, gatherId } = request;
        chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
            const url = `https://www.ic.net.cn/search/${searchValue}.html?page=1&jobId=${gatherId}`;
            chrome.tabs.update(tabs[0].id, { url: url });
        });
    }
});