// 检查当前页面是否为目标网站
const IC_URL = ['www.ic.net.cn', 'member.ic.net.cn'];
if (IC_URL.includes(window.location.hostname)) {
    // 获取URL中的查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = {};

    // 将所有查询参数转换为对象
    for (const [key, value] of urlParams.entries()) {
        query[key] = value;
    }

    // 添加消息监听器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startPoll') {
            console.log('startPoll', new Date().toLocaleString());
            const hasLogin = window.location.href.includes('login.php') // 是否在登录页
            if (hasLogin) return console.log('未登录');

            hanldeInquiryTask(); // 处理询料任务
        }
        return true; // 返回true表示异步处理
    });


    // 处理询料任务
    async function hanldeInquiryTask() {
        try {
            const { material_code, id } = await ICCUSTOMAPI.getInquiryTask() // 获取待采集状态的询料任务
            if (!material_code || !id) return console.error('当前询料任务没有标准物料。');

            chrome.storage.local.set({ executeGetSuppliersProcess: true }); // 存储状态 等待跳转完成页面加载获取供应商数据
            await UNTILS.gotoSearchPage(material_code, id) // 跳转至IC交易网对应物料编码的搜索页面
        } catch (error) {
            console.error('IC助手处理错误:', error);
        }
    }

    // 页面加载完成后  检测状态  获取供应商信息
    window.addEventListener('load', () => {
        chrome.storage.local.get(['executeGetSuppliersProcess'], async (result) => {
            if (result.executeGetSuppliersProcess) {
                const { inquiry_supplier_number } = await ICCUSTOMAPI.getSystemConfig() // 获取系统配置

                const data = await getSuppliersProcess(inquiry_supplier_number);
                console.log('IC助手执行任务： ', new Date().toLocaleString(), '\n', data);
                chrome.storage.local.remove('executeGetSuppliersProcess');  // 执行后清除状态
            }
        });
    });
}