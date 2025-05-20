// 检查当前页面是否为目标网站
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn'];

function sendNtfyByBall(msg) {
    fetch('https://ntfy.we5.fun/prod_gemel', {
        method: 'POST',
        headers: {
            'Content-Type': 'text/plain'
        },
        body: msg
    })
}


// 创建悬浮球
function createFloatBall() {
    // 检查是否在允许的网站内
    if (!IC_URL.includes(window.location.hostname)) {
        return;
    }

    // 检查是否已存在悬浮球
    if (document.querySelector('.ic-helper-float-ball')) {
        return;
    }

    // 创建悬浮球容器
    const floatBall = document.createElement('div');
    floatBall.className = 'ic-helper-float-ball';

    // 添加图标
    const icon = document.createElement('img');
    icon.src = chrome.runtime.getURL('icons/icon48.png');
    floatBall.appendChild(icon);

    // 创建菜单
    const menu = document.createElement('div');
    menu.className = 'ic-helper-menu';

    // 创建历史记录面板
    const historyPanel = document.createElement('div');
    historyPanel.className = 'ic-helper-history-panel';

    // 创建获取任务按钮
    const getTaskBtn = document.createElement('div');
    getTaskBtn.className = 'ic-helper-menu-item';
    const getTaskIcon = document.createElement('img');
    getTaskIcon.src = chrome.runtime.getURL('icons/get-task.png');
    getTaskBtn.appendChild(getTaskIcon);
    getTaskBtn.title = '获取任务';

    // 添加获取任务点击事件
    getTaskBtn.addEventListener('click', async function () {
        try {
            // 添加loading状态
            getTaskBtn.classList.add('loading');
            getTaskIcon.style.opacity = '0.5';

            const { currentTask } = await chrome.storage.local.get(['currentTask']);
            if (currentTask) {
                const toast = document.createElement('div');
                toast.className = 'ic-helper-toast';
                toast.textContent = `获取任务失败！有未上报的任务: ${currentTask.code}`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
                return;
            }

            // 调用获取任务API
            let task = await SpiderApi.getSpliderTask();
            // const codes = [
            //     'LTM4644IY',
            //     'STM32F407VET6',
            //     'PY32F030K28U6TR',
            //     'AP40P100K',
            //     'WS490H',
            //     'TM1640',
            //     'EA3036CQBR',
            //     'LTM4613EY#PBF',
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
            //     "ADIS16210CMLZ"
            // ]
            // task = {
            //     code: codes[Math.floor(Math.random() * codes.length)],
            //     company_id: 2,
            //     inquiry_material_id: 666,
            //     inquiry_record_id: 666,
            //     temp_data_id: 80,
            //     task: [
            //         "jyw"
            //     ]
            // }

            // 检查task.code是否为空
            if (!task.code) {
                // 显示提示
                const toast = document.createElement('div');
                toast.className = 'ic-helper-toast';
                toast.textContent = '暂无采集任务';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
                return;
            }

            // 存储task数据
            await chrome.storage.local.set({ currentTask: task });

            // 添加到历史记录
            const { taskHistory = [] } = await chrome.storage.local.get(['taskHistory']);

            // 添加新任务到历史记录前端
            const newHistory = [
                {
                    code: task.code,
                    hasReport: false
                },
                ...taskHistory
            ].slice(0, 3); // 只保留最新的3条记录

            await chrome.storage.local.set({ taskHistory: newHistory });

            // 更新历史记录面板
            updateHistoryPanel();

            try {
                // 复制code到剪贴板
                await navigator.clipboard.writeText(task.code);

                // 显示复制成功提示
                const toast = document.createElement('div');
                toast.className = 'ic-helper-toast';
                toast.textContent = `复制成功：${task.code}`;
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            } catch (error) {
                console.error('复制失败:', error);
                // 显示复制失败提示
                const toast = document.createElement('div');
                toast.className = 'ic-helper-toast';
                toast.textContent = '复制失败，请手动复制';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
            }

        } catch (error) {
            console.error('获取任务失败:', error);
        } finally {
            // 移除loading状态
            getTaskBtn.classList.remove('loading');
            getTaskIcon.style.opacity = '1';
        }
    });

    // 创建上报任务按钮
    const reportTaskBtn = document.createElement('div');
    reportTaskBtn.className = 'ic-helper-menu-item';
    const reportTaskIcon = document.createElement('img');
    reportTaskIcon.src = chrome.runtime.getURL('icons/report-task.png');
    reportTaskBtn.appendChild(reportTaskIcon);
    reportTaskBtn.title = '上报任务';

    // 添加上报任务点击事件
    reportTaskBtn.addEventListener('click', async function () {
        try {
            const { currentTask, environment } = await chrome.storage.local.get(['currentTask', 'environment', 'account']);
            // 校验页面
            const herf = window.location.href;
            if (!herf.includes('https://www.ic.net.cn/search')) {
                sendNtfyByBall(`【浏览器IC采集助手插件】：环境名: ${environment} , 当前页面不是IC交易网搜索页面，无法上报任务！！！，请及时处理。`);
                window.open('https://www.baidu.com', '_blank');
                return
            }

            // 添加loading状态
            reportTaskBtn.classList.add('loading');
            reportTaskIcon.style.opacity = '0.5';

            if (!currentTask) {
                const toast = document.createElement('div');
                toast.className = 'ic-helper-toast';
                toast.textContent = '当前没有可上报的任务，请先获取任务';
                document.body.appendChild(toast);
                setTimeout(() => toast.remove(), 2000);
                return;
            }

            const deWeightTotalSuppliers = await window.getSuppliersProcessByJyw();
            const body = {
                companyId: currentTask.company_id,
                inquiryMaterialId: currentTask.inquiry_material_id,
                inquiryRecordId: currentTask.inquiry_record_id,
                suppliers: deWeightTotalSuppliers.data,
            }
            console.log('上报任务结果:', body);

            await chrome.storage.local.remove('currentTask');
            await ICCRMAPI.updateTempData(currentTask.temp_data_id, { desc: `环境: ${environment}`, json_data_plugin: JSON.stringify(body) })

            // 更新历史记录中的状态
            const { taskHistory = [] } = await chrome.storage.local.get(['taskHistory']);
            const updatedHistory = taskHistory.map(item => {
                if (item.code === currentTask.code) {
                    return { ...item, hasReport: true };
                }
                return item;
            });

            await chrome.storage.local.set({ taskHistory: updatedHistory });

            // 更新历史记录面板
            updateHistoryPanel();

            const toast = document.createElement('div');
            toast.className = 'ic-helper-toast';
            toast.textContent = '上报成功';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);

        } catch (error) {
            console.error('上报任务失败:', error);
            const toast = document.createElement('div');
            toast.className = 'ic-helper-toast';
            toast.textContent = `上报失败: ${JSON.stringify(error)}`;
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        } finally {
            // 移除loading状态
            reportTaskBtn.classList.remove('loading');
            reportTaskIcon.style.opacity = '1';
        }
    });

    // 更新历史记录面板
    async function updateHistoryPanel() {
        // 获取历史记录
        const { taskHistory = [] } = await chrome.storage.local.get(['taskHistory']);

        // 清空面板
        historyPanel.innerHTML = '';

        if (taskHistory.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'ic-helper-history-empty';
            emptyMsg.textContent = '暂无任务历史';
            historyPanel.appendChild(emptyMsg);
            return;
        }

        // 创建历史记录列表
        taskHistory.forEach((task, index) => {
            const taskItem = document.createElement('div');
            taskItem.className = 'ic-helper-history-item';

            const taskCode = document.createElement('div');
            taskCode.className = 'ic-helper-history-code';
            taskCode.textContent = task.code;

            const taskStatus = document.createElement('div');
            taskStatus.className = task.hasReport ?
                'ic-helper-history-status reported' :
                'ic-helper-history-status unreported';
            taskStatus.textContent = task.hasReport ? '已上报' : '未上报';

            taskItem.appendChild(taskCode);
            taskItem.appendChild(taskStatus);
            historyPanel.appendChild(taskItem);
        });
    }

    menu.appendChild(getTaskBtn);
    menu.appendChild(reportTaskBtn);

    // 添加到页面
    document.body.appendChild(floatBall);
    document.body.appendChild(menu);
    document.body.appendChild(historyPanel);

    // 直接显示菜单和历史面板
    menu.classList.add('show');
    historyPanel.classList.add('show');

    // 初始化历史记录面板
    updateHistoryPanel();

    // 添加拖拽功能 - 强制更新DOM
    let isDragging = false;
    let offsetX = 0;
    let offsetY = 0;

    // 鼠标按下事件
    floatBall.addEventListener('mousedown', function (event) {
        // 阻止默认行为和冒泡
        event.preventDefault();
        event.stopPropagation();

        // 获取元素当前位置
        const rect = floatBall.getBoundingClientRect();

        // 计算鼠标点击位置相对于元素的偏移
        offsetX = event.clientX - rect.left;
        offsetY = event.clientY - rect.top;

        // 标记开始拖拽
        isDragging = true;

        // 改变光标样式
        document.body.style.cursor = 'move';
        floatBall.style.cursor = 'move';

        // 禁用过渡效果
        floatBall.style.setProperty('transition', 'none', 'important');
        menu.style.setProperty('transition', 'none', 'important');
        historyPanel.style.setProperty('transition', 'none', 'important');
    });

    // 鼠标移动事件
    document.addEventListener('mousemove', function (event) {
        if (!isDragging) return;

        // 阻止默认行为和冒泡
        event.preventDefault();
        event.stopPropagation();

        // 计算新位置
        let left = event.clientX - offsetX;
        let top = event.clientY - offsetY;

        // 边界检查
        const maxX = window.innerWidth - floatBall.offsetWidth;
        const maxY = window.innerHeight - floatBall.offsetHeight;

        left = Math.max(0, Math.min(maxX, left));
        top = Math.max(0, Math.min(maxY, top));

        // 计算right值
        const right = window.innerWidth - left - floatBall.offsetWidth;

        // 直接修改元素样式，强制使用!important
        floatBall.style.setProperty('left', left + 'px', 'important');
        floatBall.style.setProperty('top', top + 'px', 'important');
        floatBall.style.setProperty('right', 'auto', 'important');

        menu.style.setProperty('left', left + 'px', 'important');
        menu.style.setProperty('top', (top + floatBall.offsetHeight + 10) + 'px', 'important');
        menu.style.setProperty('right', 'auto', 'important');

        // 更新历史面板位置 - 放在悬浮球左侧
        historyPanel.style.setProperty('left', (left - historyPanel.offsetWidth - 10) + 'px', 'important');
        historyPanel.style.setProperty('top', top + 'px', 'important');
        historyPanel.style.setProperty('right', 'auto', 'important');

        // 强制重绘
        void floatBall.offsetWidth;
        void menu.offsetWidth;
        void historyPanel.offsetWidth;
    });

    // 鼠标松开事件
    document.addEventListener('mouseup', function (event) {
        if (!isDragging) return;

        // 阻止默认行为和冒泡
        event.preventDefault();
        event.stopPropagation();

        // 结束拖拽
        isDragging = false;

        // 恢复光标样式
        document.body.style.cursor = 'default';
        floatBall.style.cursor = 'pointer';

        // 恢复过渡效果
        floatBall.style.setProperty('transition', 'all 0.3s ease', 'important');
        menu.style.setProperty('transition', 'all 0.3s ease', 'important');
        historyPanel.style.setProperty('transition', 'all 0.3s ease', 'important');

        // 保存位置到 chrome.storage.local
        const ballRect = floatBall.getBoundingClientRect();
        const position = {
            left: ballRect.left,
            top: ballRect.top
        };
        chrome.storage.local.set({ ballPosition: position });
    });

    // 从 chrome.storage.local 中获取并应用保存的位置
    async function initBallPosition() {
        try {
            // 获取保存的位置
            const { ballPosition } = await chrome.storage.local.get(['ballPosition']);

            // 如果有保存的位置，则应用
            if (ballPosition) {
                // 应用悬浮球位置
                floatBall.style.setProperty('position', 'fixed', 'important');
                floatBall.style.setProperty('top', ballPosition.top + 'px', 'important');
                floatBall.style.setProperty('left', ballPosition.left + 'px', 'important');
                floatBall.style.setProperty('right', 'auto', 'important');

                // 更新菜单位置
                menu.style.setProperty('position', 'fixed', 'important');
                menu.style.setProperty('top', (ballPosition.top + floatBall.offsetHeight + 10) + 'px', 'important');
                menu.style.setProperty('left', ballPosition.left + 'px', 'important');
                menu.style.setProperty('right', 'auto', 'important');

                // 更新历史面板位置
                historyPanel.style.setProperty('position', 'fixed', 'important');
                historyPanel.style.setProperty('top', ballPosition.top + 'px', 'important');
                historyPanel.style.setProperty('left', (ballPosition.left - historyPanel.offsetWidth - 10) + 'px', 'important');
                historyPanel.style.setProperty('right', 'auto', 'important');

                return true;
            }
            return false;
        } catch (error) {
            console.error('获取保存位置失败:', error);
            return false;
        }
    }

    // 添加强制初始位置
    window.addEventListener('load', async function () {
        // 先尝试获取保存的位置
        const hasPosition = await initBallPosition();

        // 如果没有保存的位置，使用默认位置
        if (!hasPosition) {
            // 确保初始位置设置正确
            floatBall.style.setProperty('position', 'fixed', 'important');
            floatBall.style.setProperty('top', '120px', 'important');
            floatBall.style.setProperty('right', '60px', 'important');
            floatBall.style.setProperty('left', 'auto', 'important');

            menu.style.setProperty('position', 'fixed', 'important');
            menu.style.setProperty('top', '178px', 'important');
            menu.style.setProperty('right', '60px', 'important');
            menu.style.setProperty('left', 'auto', 'important');

            // 初始化历史记录面板位置 - 放在悬浮球左侧
            const rect = floatBall.getBoundingClientRect();
            historyPanel.style.setProperty('position', 'fixed', 'important');
            historyPanel.style.setProperty('top', rect.top + 'px', 'important');
            historyPanel.style.setProperty('left', (rect.left - historyPanel.offsetWidth - 10) + 'px', 'important');
            historyPanel.style.setProperty('right', 'auto', 'important');
        }
    });

    // 初始化悬浮球位置
    initBallPosition();
}

// 确保DOM加载完成后创建悬浮球
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatBall);
} else {
    createFloatBall();
} 