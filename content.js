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

    // 获取供应商信息
    async function getSupplierInfo() {
        try {
            const data = await getSupplierProcess();
            console.log('IC助手执行任务', data);
        } catch (error) {
            console.error('IC助手处理错误:', error);
        }
    }

    // 添加消息监听器
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === 'startPoll') {
            console.log('startPoll', new Date().toLocaleString());
            const hasLogin = window.location.href.includes('login.php') // 是否在登录页
            if (hasLogin) return console.log('未登录');

            getSupplierInfo(); // 获取供应商信息
        }
        return true;
    });

    // 页面加载完成后执行处理函数
    // if (document.readyState === 'complete') {
    //     getSupplierInfo();
    // } else {
    //     window.addEventListener('load', getSupplierInfo);
    // }
}