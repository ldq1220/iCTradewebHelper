// 获取公司信息的处理函数
function getCompanyInfo(detailLayer) {
    const info = {
        businessTags: [], // 企业档案标签
        memberYears: '', // 会员年限
        contacts: {
            phones: [], // 电话
            mobiles: [], // 手机
            faxes: [] // 传真
        },
        location: '', // 办公地点
        addresses: [], // 地址
        photos: [], // 公司相册
        brands: [] // 经营品牌
    };
    if (!detailLayer) return info;

    // 获取公司相册图片
    const photoContainer = detailLayer.querySelector('[name="div_ComPhotoMicNum"]');
    if (photoContainer) {
        const images = photoContainer.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src) info.photos.push(src);
        });
    }
}


await Promise.all(supplyLinks.map(async (link) => {
    if (link.offsetParent !== null) {
        // 触发鼠标移入事件
        link.dispatchEvent(new MouseEvent('mouseover', {
            view: window,
            bubbles: true,
            cancelable: true
        }));

        // 缩短等待时间
        await new Promise(resolve => setTimeout(resolve, 50));

        // 获取公司信息
        const detailLayer = supplyElement.querySelector('.detailLayer');
        elementData.companyInfo = getCompanyInfo(detailLayer);

        elementData.visibleLinks.push(link);
        const content = link.textContent.trim();
        if (content) elementData.companyName.push(content);

        const className = link.className;
        const title = link.getAttribute("title");
        if (className && title) elementData.companyTag.push(className);

        // 立即触发鼠标移出事件，避免弹出层停留
        link.dispatchEvent(new MouseEvent('mouseout', {
            view: window,
            bubbles: true,
            cancelable: true
        }));
    }
}));