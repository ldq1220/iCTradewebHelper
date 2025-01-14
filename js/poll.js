const Poll = {
    // 轮询配置
    config: {
        interval: 30,
        timer: null,
    },

    // 轮询处理函数
    async pollHandler() {
        try {
            // 检查当前是否在目标网站
            // const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            // const currentTab = tabs[0];
            // console.log('tabs-----', tabs);
            // // && currentTab.url.includes('www.ic.net.cn')
            // if (currentTab) {
            //     await chrome.tabs.sendMessage(currentTab.id, {
            //         action: 'startPoll'
            //     });
            // }
            const tabs = await chrome.tabs.query({
                url: "*://*.ic.net.cn/*"  // 匹配目标网站的所有标签页
            });
            console.log('tabs-----', tabs);
            if (tabs.length) {
                await chrome.tabs.sendMessage(tabs[0].id, {
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