// 检查当前页面是否为目标网站
if (window.location.hostname === 'www.ic.net.cn') {
    // 获取URL中的查询参数
    const urlParams = new URLSearchParams(window.location.search);
    const query = {};

    // 将所有查询参数转换为对象
    for (const [key, value] of urlParams.entries()) {
        query[key] = value;
    }

    // 创建异步函数来执行处理
    async function init() {
        try {
            const data = await processResultSupply();
            console.log('IC助手处理结果:', data);
        } catch (error) {
            console.error('IC助手处理错误:', error);
        }
    }

    // 页面加载完成后执行处理函数
    if (document.readyState === 'complete') {
        init();
    } else {
        window.addEventListener('load', init);
    }
}