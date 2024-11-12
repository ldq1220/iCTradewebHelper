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
        brands: [] // 经营品牌
    };
    if (!detailLayer) return info;

    // 获取企业档案标签
    const businessTags = detailLayer.querySelectorAll('.layer_icon');
    businessTags.forEach(tag => {
        const style = window.getComputedStyle(tag);
        if (style.display !== 'none') {
            // 获取类名
            const className = tag.className;
            const title = tag.getAttribute("title");
            if (className && title) info.businessTags.push(className.split(' ')[1]);
        }
    });

    // 获取会员年限
    const memberYears = detailLayer.querySelector('.orangenumber');
    if (memberYears) info.memberYears = memberYears.textContent.trim();

    // 获取联系方式
    // 电话和联系人
    const contactElements = detailLayer.querySelectorAll('.layer_contacts');
    contactElements.forEach(contact => {
        const style = window.getComputedStyle(contact);
        if (style.display !== 'none') {
            const phone = contact.querySelector('.layer_telNumber');
            const contactName = contact.querySelector('.layer_contactName');
            if (phone || contactName) info.contacts.phones.push(phone.textContent.trim() + ' ' + contactName.textContent.trim());

        }
    });

    // 手机
    const mobiles = detailLayer.querySelectorAll('.layer_otherContentphone');
    mobiles.forEach(mobile => {
        const style = window.getComputedStyle(mobile);
        if (style.display !== 'none') info.contacts.mobiles.push(mobile.textContent.trim());
    });

    // 传真
    const faxes = detailLayer.querySelectorAll('.layer_line .layer_otherContent:not(.layer_otherContentphone)');
    faxes.forEach(fax => {
        const style = window.getComputedStyle(fax);
        if (style.display !== 'none' && fax.parentElement.querySelector('.layer_otherTitle_fax')) {
            info.contacts.faxes.push(fax.textContent.trim());
        }
    });

    // 获取办公地点
    const location = detailLayer.querySelector('.company_address');
    if (location) info.location = location.textContent.trim();

    // 详细地址
    const addressElements = detailLayer.querySelectorAll('.layer_line');
    addressElements.forEach(element => {
        const titleEl = element.querySelector('.layer_otherTitle');
        const contentEls = element.querySelectorAll('.layer_otherContent');
        if (titleEl && titleEl.textContent.trim() === '地址：') {
            contentEls.forEach(contentEl => {
                const style = window.getComputedStyle(contentEl);
                if (style.display !== 'none') {
                    info.addresses.push(contentEl.textContent.trim());
                }
            });
        }
    });

    // 获取经营品牌信息
    const brandLists = detailLayer.querySelectorAll('.layer_brandList');
    brandLists.forEach(brand => {
        const brandName = brand.querySelector('.brandName')?.textContent.trim();
        const percentage = brand.querySelector('.num')?.textContent.trim();
        if (brandName && percentage) {
            info.brands.push({
                name: brandName,
                percentage: percentage
            });
        }
    });

    return info;
}

// 处理供应信息
window.processResultSupply = function (batchSize = 50) {
    return new Promise((resolve) => {
        try {
            const results = [];
            const stairTrElements = document.getElementsByClassName("stair_tr");

            if (stairTrElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '未找到供应商信息'
                });
                return;
            }

            const elements = Array.from(stairTrElements);
            const totalElements = elements.length;
            let processedCount = 0;

            async function processBatch() {
                const end = Math.min(processedCount + batchSize, totalElements);

                for (let i = processedCount; i < end; i++) {
                    const stairTr = elements[i];
                    const elementData = {
                        company: null,
                        visibleLinks: [],
                        companyName: [],
                        companyTag: [],
                        materialId: [],
                        qqAccount: []
                    };

                    // 获取供应信息
                    const supplyElement = stairTr.querySelector(".result_supply");
                    if (supplyElement) {
                        elementData.company = supplyElement;
                        const supplyLinks = Array.from(supplyElement.querySelectorAll("a:not(.detailLayer a)"));
                        supplyLinks.forEach(async (link) => {
                            if (link.offsetParent !== null) {
                                // 获取公司信息
                                const detailLayer = supplyElement.querySelector('.detailLayer');
                                elementData.companyInfo = getCompanyInfo(detailLayer);

                                elementData.visibleLinks.push(link);
                                const content = link.textContent.trim();
                                if (content) elementData.companyName.push(content);

                                const className = link.className;
                                const title = link.getAttribute("title");
                                if (className && title) elementData.companyTag.push(className);
                            }
                        });
                    }

                    // 获取物料编号
                    const resultIdElement = stairTr.querySelector(".result_id");
                    if (resultIdElement) {
                        const productNumbers =
                            resultIdElement.querySelectorAll(".product_number");
                        productNumbers.forEach((product) => {
                            const materialIdText = product.textContent.trim();
                            if (materialIdText) elementData.materialId.push(materialIdText);
                        });
                    }

                    // 获取询价信息中的QQ账号
                    const askPriceElement = stairTr.querySelector(".result_askPrice");
                    if (askPriceElement) {
                        const askPriceLinks = askPriceElement.querySelectorAll("a");
                        askPriceLinks.forEach((link) => {
                            if (link.offsetParent !== null) {
                                const myTitle = link.getAttribute("mytitle");
                                if (myTitle) elementData.qqAccount.push(myTitle)
                            }
                        });
                    }

                    results.push(elementData);
                }

                processedCount = end;

                if (processedCount < totalElements) {
                    requestAnimationFrame(processBatch);
                } else {
                    resolve({
                        success: true,
                        data: results.filter(item => item.companyName.length > 0 && item.qqAccount.length > 0),
                        error: null,
                        getAllCompanyNames: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.companyName),
                                []
                            );
                        },
                        getAllCompanyTag: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.companyTag),
                                []
                            );
                        },
                        getAllQQAccounts: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.qqAccount),
                                []
                            );
                        },
                        getAllMaterialIds: function () {
                            return this.data.reduce(
                                (acc, curr) => acc.concat(curr.materialId),
                                []
                            );
                        }
                    });
                }
            }

            requestAnimationFrame(processBatch);
        } catch (error) {
            resolve({
                success: false,
                data: [],
                error: error.message
            });
        }
    });
};


