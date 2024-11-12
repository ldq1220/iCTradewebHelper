const TaskProcessor = (function () {
    class TaskProcessor {
        constructor() {
            this.staticTasks = [];
            this.isRunning = false;
            this.currentUrl = window.location.href;
        }

        // 生成随机等待时间 (10-30秒)
        getRandomDelay(min = 5, max = 10) {
            return Math.floor(Math.random() * (max - min + 1) + min) * 1000;
        }

        // 获取当前任务
        async getCurrentTask() {
            return new Promise((resolve) => {
                chrome.storage.local.get(['currentTaskId', 'processedTasks'], (result) => {
                    const processedTasks = result.processedTasks || [];
                    const currentTaskId = result.currentTaskId || 0;

                    // 找到下一个未处理的任务
                    const nextTask = this.staticTasks.find(task =>
                        !processedTasks.includes(task.id) && task.id > currentTaskId
                    );

                    resolve(nextTask);
                });
            });
        }

        // 保存进度
        async saveProgress(taskId) {
            return new Promise((resolve) => {
                chrome.storage.local.get(['processedTasks'], (result) => {
                    const processedTasks = result.processedTasks || [];
                    processedTasks.push(taskId);
                    chrome.storage.local.set({
                        currentTaskId: taskId,
                        processedTasks: processedTasks
                    }, resolve);
                });
            });
        }

        // 检查是否在目标页面
        isTargetPage() {
            return window.location.href.includes('admin.gemelai.com/enterpriseUser');
        }

        // 主处理流程
        async process() {
            // 如果不在目标页面，获取当前任务并跳转
            if (!this.isTargetPage()) {
                const currentTask = await this.getCurrentTask();
                if (currentTask) {
                    console.log(`准备处理任务 ${currentTask.id} (${currentTask.material})`);
                    window.location.href = 'https://admin.gemelai.com/enterpriseUser';
                }
                return;
            }

            // 在目标页面时执行任务
            const currentTask = await this.getCurrentTask();
            if (!currentTask) {
                console.log('所有任务已完成');
                return;
            }

            try {
                console.log(`开始处理任务 ${currentTask.id} (${currentTask.material})`);

                // 执行处理函数
                const result = await processResultSupply();
                console.log(`任务 ${currentTask.id} 执行结果:`, result);

                // 保存进度
                await this.saveProgress(currentTask.id);

                // 随机等待
                const delay = this.getRandomDelay();
                console.log(`等待 ${delay / 1000} 秒后继续下一个任务...`);
                await new Promise(resolve => setTimeout(resolve, delay));

                // 刷新页面以处理下一个任务
                window.location.reload();

            } catch (error) {
                console.error(`任务执行错误:`, error);
            }
        }

        // 清除所有进度
        async clearProgress() {
            return new Promise((resolve) => {
                chrome.storage.local.remove(['currentTaskId', 'processedTasks'], resolve);
                console.log('已清除所有任务进度');
            });
        }
    }

    // 将 TaskProcessor 暴露到全局作用域
    window.TaskProcessor = TaskProcessor;
    return TaskProcessor;
})();
