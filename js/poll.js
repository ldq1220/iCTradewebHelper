const Poll = {

    // 轮询配置
    config: {
        interval: 10, // 间隔时间（秒）
        timerActive: false,
        alarmName: 'pollAlarm',
        minPauseTime: 45, // 最小暂停时间(秒)
        maxPauseTime: 60, // 最大暂停时间(秒)
        abnormalStopped: false, // 异常停止轮询  // 触发易盾 未登录
        goHomeTime: 5 * 60, // 多长时间没有任务 返回首页
        goHomeTimeSumTime: 0, // 停止时间之和
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
                url: "*://*.m.ic.net.cn/*"  // 匹配【交易网】所有标签页
            });

            console.log('交易网标签页:', tabs);
            const spiderTaskResult = await SpiderApi.getSpliderTask();
            console.log('获取任务:', spiderTaskResult);

            if (spiderTaskResult && spiderTaskResult.code) {
                this.config.goHomeTimeSumTime = 0;
                // 停止当前轮询
                this.stopPolling();

                // 发送消息处理物料通知
                await chrome.tabs.sendMessage(tabs[tabs.length - 1].id, {
                    action: 'startPoll',
                    spiderTaskResult: spiderTaskResult
                });

                // 本地模拟数据
                // const codes = [
                //     "ADUM1200ARZ-RL7",
                //     "MX25R6435FBDIL0",
                //     "SS3200",
                //     "TLP2362(TPL,E(T",
                //     "74HC08PW,118",
                //     "AMC1200SDUBR",
                //     "EG1198",
                //     "IR2110STRPBF",
                //     "LMV331SE-7",
                //     "MC74HC1G08DTT1G",
                //     "MP2315GJ-Z",
                //     "NSI1311-DSWVR",
                //     "STM32F103RCT6",
                //     "L3GD20TR",
                //     "L3GD20HTR",
                //     "SP-2U2+",
                //     "B66453G0000X608",
                //     "ACPL-024L-500E",
                //     "HCPL-0601-500E",
                //     "FT245BL-REEL",
                //     "TRF250-120",
                //     "ADG453BRZ",
                //     "TL3340AF160QG",
                //     "ADUM1201ARZ",
                //     "GD32F450VGT6",
                //     "MMA2P00-AS-SP-C",
                //     "STM802SM6F",
                //     "STM32G491RCT6TR",
                //     "STPIC6C595TTR",
                //     "BSS123LT1G",
                //     "DPA424GN-TL",
                //     "AO3416",
                //     "PI7C9X130DNDE",
                //     "FDG6303N",
                //     "STM32G030F6P6",
                //     "307005240",
                //     "TMS320F28335PGFA",
                //     "ADM2587EBRWZ",
                //     "AT32F403ZGT6",
                //     "ADIS16210CMLZ",
                //     "D38999/26WA98SN",
                //     "LPC845M301JHI33Y",
                //     "BCM82391AKFSBG",
                //     "BCM58712DB0IFEB20G",
                //     "08051C105K4Z2A",
                //     "08SR-3S",
                //     "03SR-3S"
                // ]
                // await chrome.tabs.sendMessage(tabs[tabs.length - 1].id, {
                //     action: 'startPoll',
                //     spiderTaskResult: { code: codes[Math.floor(Math.random() * codes.length)], company_id: 2, inquiry_record_id: 666, inquiry_material_id: 666, temp_data_id: 80 }
                // });

                // 随机暂停60-120秒后恢复轮询
                const pauseTime = Math.floor(Math.random() *
                    (this.config.maxPauseTime - this.config.minPauseTime + 1) +
                    this.config.minPauseTime) * 1000;

                this.pauseAndResumeLater(pauseTime / 1000); // 恢复轮询
            } else {
                this.config.goHomeTimeSumTime += this.config.interval;
                if (this.config.goHomeTimeSumTime >= this.config.goHomeTime) {
                    this.config.goHomeTimeSumTime = 0;
                    await this.goHome();
                }
                console.log('没有需要采集的询料物料', this.config.goHomeTimeSumTime);
            }
        } catch (error) {
            console.log('轮询执行错误:', error);
        }
    },

    // 暂停轮询后恢复轮询
    async pauseAndResumeLater(pauseTime) {
        // 确保监听器已初始化，无论this._alarmListener是否存在都重新初始化
        this.initAlarmListener();

        console.log(`将在 ${pauseTime} 秒后恢复轮询`);
        // 创建一次性的alarm来恢复轮询
        chrome.alarms?.create('resumePollAlarm', {
            delayInMinutes: pauseTime / 60 // 转换为分钟
        });
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
            } else if (alarm.name === 'resumePollAlarm') {
                // 处理恢复轮询
                chrome.alarms?.clear('resumePollAlarm');
                this.startPolling();
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
        chrome.alarms?.clear('resumePollAlarm');
        this.config.timerActive = false;
        console.log('停止轮询', new Date().toLocaleString());
    },

    // 返回首页
    async goHome() {
        const tabs = await chrome.tabs.query({
            url: "*://*.m.ic.net.cn/*" // 匹配【交易网】所有标签页
        });
        if (tabs.length > 0) {
            const currentTab = tabs[tabs.length - 1];
            // 判断当前是否已经在首页
            if (currentTab.url !== 'https://m.ic.net.cn/') {
                await chrome.tabs.update(currentTab.id, { url: 'https://m.ic.net.cn/' });
            }
        }
    }
};