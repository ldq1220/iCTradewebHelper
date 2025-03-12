const Poll = {

    // 轮询配置
    config: {
        interval: 5, // 间隔时间（秒）
        timerActive: false,
        alarmName: 'pollAlarm',
        resumeTimer: null, // 恢复轮询的定时器
        minPauseTime: 60, // 最小暂停时间(秒)
        maxPauseTime: 120, // 最大暂停时间(秒)
        abnormalStopped: false, // 异常停止轮询  // 触发易盾 未登录
    },

    async loadConfig() {
        const result = await chrome.storage.local.get(['loopSecond', 'minPauseTime', 'maxPauseTime']);
        this.config.interval = result.loopSecond;
        this.config.minPauseTime = result.minPauseTime;
        this.config.maxPauseTime = result.maxPauseTime;
    },

    // 轮询处理函数
    async pollHandler() {
        try {
            await chrome.storage.local.set({ lastPollTime: new Date().toLocaleString() });
            chrome.runtime.sendMessage({
                action: "updateLastRunTime",
            });

            // 检查当前是否在目标网站
            const tabs = await chrome.tabs.query({
                url: "*://*.ic.net.cn/*"  // 匹配【交易网】所有标签页
            });

            console.log('交易网标签页:', tabs);

            const spiderTaskResult = await SpiderApi.getSpliderTask();
            console.log('获取任务:', spiderTaskResult);

            if (spiderTaskResult && spiderTaskResult.code) {
                // 停止当前轮询
                this.stopPolling();

                // 发送消息处理物料通知
                await chrome.tabs.sendMessage(tabs[tabs.length - 1].id, {
                    action: 'startPoll',
                    spiderTaskResult: spiderTaskResult
                });

                // 随机暂停60-120秒后恢复轮询
                const pauseTime = Math.floor(Math.random() *
                    (this.config.maxPauseTime - this.config.minPauseTime + 1) +
                    this.config.minPauseTime) * 1000;

                console.log(`将在 ${pauseTime / 1000} 秒后恢复轮询`);
                this.config.resumeTimer = setTimeout(async () => {
                    this.startPolling();
                }, pauseTime);
            } else {
                console.log('没有需要采集的询料物料');
            }
        } catch (error) {
            console.log('轮询执行错误:', error);
        }
    },

    // 初始化轮询监听器（在扩展启动时调用一次）
    initAlarmListener() {
        // 移除可能存在的旧监听器，避免重复注册
        chrome.alarms?.onAlarm?.removeListener(this._alarmListener);

        // 定义监听器函数
        this._alarmListener = async (alarm) => {
            if (alarm.name === this.config.alarmName) {
                await this.loadConfig();
                console.log('触发轮询:', new Date().toLocaleString());
                this.pollHandler();
            }
        };

        // 添加监听器
        chrome.alarms?.onAlarm?.addListener(this._alarmListener);
    },

    // 启动轮询
    async startPolling() {
        // 加载配置
        await this.loadConfig();
        console.log('启动轮询', new Date().toLocaleString(), '轮询配置:', this.config);

        // 确保监听器已初始化
        if (!this._alarmListener && !this.config.abnormalStopped) {
            this.initAlarmListener();
        }

        // 立即执行一次
        if (!this.config.timerActive && !this.config.abnormalStopped) {
            this.pollHandler();
            this.config.timerActive = true;
            // 创建定时任务
            chrome.alarms?.create(this.config.alarmName, {
                periodInMinutes: this.config.interval / 60
            });
        }
    },

    // 异常停止轮询
    abnormalStopPolling(reason) {
        this.config.abnormalStopped = true;
        this.stopPolling();

        // 关闭开关
        chrome.storage.local.set({ isEnabled: false });
        chrome.runtime.sendMessage({
            action: "updatePopupSwitch",
            enabled: false,
            reason: reason
        });

        console.log('异常停止所有轮询: ----', reason);
    },

    // 停止轮询
    stopPolling() {
        chrome.alarms?.clear(this.config.alarmName);
        this.config.timerActive = false;
        clearTimeout(this.config.resumeTimer);
        this.config.resumeTimer = null;
        console.log('停止轮询', new Date().toLocaleString());
    }
};