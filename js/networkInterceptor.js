// 拦截XHR请求
(function () {
    // 保存原始的XMLHttpRequest
    const originalXHR = window.XMLHttpRequest;

    // 创建拦截器
    function XHRInterceptor() {
        const xhr = new originalXHR();

        // 保存原始的open方法
        const originalOpen = xhr.open;
        const originalSend = xhr.send;

        // 重写open方法
        xhr.open = function () {
            this._method = arguments[0];
            this._url = arguments[1];

            // 调用原始的open方法
            return originalOpen.apply(this, arguments);
        };

        // 重写send方法
        xhr.send = function () {
            // 监听加载完成事件
            this.addEventListener('load', function () {
                // 检查是否是目标请求
                if (this._url && this._url.includes('max.ic.net.cn/async/search.asy.php') &&
                    this._url.includes('IC_Method=getstockdata')) {
                    try {
                        // 获取响应数据
                        const responseData = this.responseText;

                        // 发送消息到扩展
                        window.postMessage({
                            type: 'IC_HELPER_INTERCEPTED_RESPONSE',
                            url: this._url,
                            method: this._method,
                            responseData: responseData
                        }, '*');

                        console.log('已拦截API响应:', responseData);
                    } catch (error) {
                        console.error('拦截响应出错:', error);
                    }
                }
            });

            // 调用原始的send方法
            return originalSend.apply(this, arguments);
        };

        return xhr;
    }

    // 替换全局的XMLHttpRequest
    window.XMLHttpRequest = XHRInterceptor;

    console.log('IC Helper: XHR拦截器已初始化');
})();

// 拦截Fetch请求（如果网站使用fetch而不是XHR）
(function () {
    // 保存原始的fetch方法
    const originalFetch = window.fetch;

    // 重写fetch方法
    window.fetch = async function (input, init) {
        // 判断是否是目标请求
        let url = input;
        if (input instanceof Request) {
            url = input.url;
        }

        // 调用原始的fetch
        const response = await originalFetch(input, init);

        // 检查是否是目标请求
        if (url && url.includes('max.ic.net.cn/async/search.asy.php') &&
            url.includes('IC_Method=getstockdata')) {

            // 克隆响应以便可以多次读取body
            const responseClone = response.clone();

            try {
                // 获取响应数据
                const responseData = await responseClone.text();

                // 发送消息到扩展
                window.postMessage({
                    type: 'IC_HELPER_INTERCEPTED_RESPONSE',
                    url: url,
                    method: init && init.method || 'GET',
                    responseData: responseData
                }, '*');

                console.log('已拦截Fetch API响应:', responseData);
            } catch (error) {
                console.error('拦截Fetch响应出错:', error);
            }
        }

        return response;
    };

    console.log('IC Helper: Fetch拦截器已初始化');
})(); 