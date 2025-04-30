// 检查当前页面是否为目标网站
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn'];

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
            // 添加loading状态
            reportTaskBtn.classList.add('loading');
            reportTaskIcon.style.opacity = '0.5';

            const { currentTask, environment } = await chrome.storage.local.get(['currentTask', 'environment', 'account']);
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

            const toast = document.createElement('div');
            toast.className = 'ic-helper-toast';
            toast.textContent = '上报成功';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);

        } catch (error) {
            console.error('上报任务失败:', error);
            const toast = document.createElement('div');
            toast.className = 'ic-helper-toast';
            toast.textContent = '上报失败';
            document.body.appendChild(toast);
            setTimeout(() => toast.remove(), 2000);
        } finally {
            // 移除loading状态
            reportTaskBtn.classList.remove('loading');
            reportTaskIcon.style.opacity = '1';
        }
    });

    menu.appendChild(getTaskBtn);
    menu.appendChild(reportTaskBtn);

    // 添加到页面
    document.body.appendChild(floatBall);
    document.body.appendChild(menu);

    // 直接显示菜单
    menu.classList.add('show');

    // 添加拖拽功能
    let isDragging = false;
    let startX, startY;
    let lastRight = 40; // 默认右侧位置
    let lastTop = 58; // 默认顶部位置

    floatBall.addEventListener('mousedown', function (e) {
        if (e.button === 0) { // 只响应左键
            isDragging = true;
            const rect = floatBall.getBoundingClientRect();
            startX = e.clientX - (window.innerWidth - rect.right);
            startY = e.clientY - rect.top;
            floatBall.style.cursor = 'move';
        }
    });

    document.addEventListener('mousemove', function (e) {
        if (isDragging) {
            e.preventDefault();
            const right = window.innerWidth - e.clientX + startX;
            const top = e.clientY - startY;

            // 边界检查
            const boundedRight = Math.max(0, Math.min(window.innerWidth - floatBall.offsetWidth, right));
            const boundedTop = Math.max(0, Math.min(window.innerHeight - floatBall.offsetHeight, top));

            floatBall.style.right = boundedRight + 'px';
            floatBall.style.top = boundedTop + 'px';

            // 更新菜单位置
            menu.style.right = boundedRight + 'px';
            menu.style.top = (boundedTop + floatBall.offsetHeight + 10) + 'px';

            lastRight = boundedRight;
            lastTop = boundedTop;
        }
    });

    document.addEventListener('mouseup', function () {
        if (isDragging) {
            isDragging = false;
            floatBall.style.cursor = 'pointer';
        }
    });
}

// 确保DOM加载完成后创建悬浮球
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createFloatBall);
} else {
    createFloatBall();
} 