// const Poll = {
//     // 轮询配置
//     config: {
//         interval: 30,
//         timer: null
//     },

//     // 轮询处理函数
//     async pollHandler() {
//         try {
//             // 检查当前是否在目标网站
//             const tabs = await chrome.tabs.query({
//                 url: "*://*.ic.net.cn/*"  // 匹配【交易网】所有标签页
//                 // url: "*://*.hqew.com/*"  // 匹配【华强网】所有标签页
//                 // url: "*://*.szlcsc.com/*"  // 匹配【立创商城】所有标签页
//             });
//             console.log('tabs-----', tabs);
//             if (tabs.length) {
//                 await chrome.tabs.sendMessage(tabs[0].id, {
//                     action: 'startPoll'
//                 });
//             }
//         } catch (error) {
//             console.error('轮询执行错误:', error);
//         }
//     },

//     // 启动轮询
//     startPolling() {
//         if (!this.config.timer) {
//             // 立即执行一次
//             this.pollHandler();
//             // 设置定时器
//             this.config.timer = setInterval(() => {
//                 this.pollHandler();
//             }, this.config.interval * 1000);
//         }
//     },

//     // 停止轮询
//     stopPolling() {
//         if (this.config.timer) {
//             clearInterval(this.config.timer);
//             this.config.timer = null;
//         }
//     }
// };
// 

const Poll = {
    // 轮询配置
    config: {
        interval: 30, // 间隔时间（秒）
        timerActive: false,
        alarmName: 'pollAlarm'
    },

    // 轮询处理函数
    async pollHandler() {
        try {
            // 检查当前是否在目标网站
            const tabs = await chrome.tabs.query({
                url: "*://*.ic.net.cn/*"  // 匹配【交易网】所有标签页
            });

            console.log('轮询检查标签页:', tabs);
            for (const tab of tabs) {
                if (tab.active) {
                    await chrome.tabs.sendMessage(tab.id, {
                        action: 'startPoll'
                    });
                    break;
                }

            }
        } catch (error) {
            console.error('轮询执行错误:', error);
        }
    },

    // 初始化轮询监听器（在扩展启动时调用一次）
    initAlarmListener() {
        // 移除可能存在的旧监听器，避免重复注册
        chrome.alarms?.onAlarm?.removeListener(this._alarmListener);

        // 定义监听器函数
        this._alarmListener = (alarm) => {
            if (alarm.name === this.config.alarmName) {
                console.log('触发轮询:', new Date().toLocaleString());
                this.pollHandler();
            }
        };

        // 添加监听器
        chrome.alarms?.onAlarm?.addListener(this._alarmListener);
    },

    // 启动轮询
    startPolling() {
        // 确保监听器已初始化
        if (!this._alarmListener) {
            this.initAlarmListener();
        }

        // 立即执行一次
        if (!this.config.timerActive) {
            this.pollHandler();
            this.config.timerActive = true;
            // 创建定时任务
            chrome.alarms.create(this.config.alarmName, {
                periodInMinutes: this.config.interval / 60
            });

        }

        console.log(`轮询已启动，间隔: ${this.config.interval}秒`);
    },

    // 停止轮询
    stopPolling() {
        chrome.alarms.clear(this.config.alarmName);
        this.config.timerActive = false;
        console.log('轮询已停止');
    }
};