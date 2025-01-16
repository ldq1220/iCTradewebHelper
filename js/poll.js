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
            const tabs = await chrome.tabs.query({
                url: "*://*.ic.net.cn/*"  // 匹配【交易网】所有标签页
                // url: "*://*.hqew.com/*"  // 匹配【华强网】所有标签页
                // url: "*://*.szlcsc.com/*"  // 匹配【立创商城】所有标签页
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