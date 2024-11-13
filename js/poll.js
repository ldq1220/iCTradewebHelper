const Poll = {
    // 轮询配置
    config: {
        interval: 10,
        timer: null,
    },

    // 轮询处理函数
    async pollHandler() {
        try {
            // 检查当前是否在目标网站
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const currentTab = tabs[0];
            if (currentTab && currentTab.url.includes('www.ic.net.cn')) {
                // 向content script发送轮询消息
                await chrome.tabs.sendMessage(currentTab.id, {
                    action: 'startPoll'
                });
            }
        } catch (error) {
            console.error('轮询执行错误:', error);
        }
    },

    // 启动轮询
    startPolling() {
        if (!this.config.timer) {
            // 立即执行一次
            this.pollHandler();
            // 设置定时器
            this.config.timer = setInterval(() => {
                this.pollHandler();
            }, this.config.interval * 1000);
        }
    },

    // 停止轮询
    stopPolling() {
        if (this.config.timer) {
            clearInterval(this.config.timer);
            this.config.timer = null;
        }
    }
};