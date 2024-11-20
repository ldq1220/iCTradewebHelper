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

// 根据标签优先级对供应商进行排序
function sortSuppliersByTagPriority(supplierStore) {
    const priorityMap = {
        'yuanchang': 1,
        'daili': 2,
        'iccp': 3,
        'sscp': 4,
        'redvip': 5,
        'stock': 6,
        'icon500': 7
    };

    supplierStore.sort((a, b) => {
        const aPriority = Math.min(...a.companyTag.map(tag => priorityMap[tag] || Infinity));
        const bPriority = Math.min(...b.companyTag.map(tag => priorityMap[tag] || Infinity));
        return aPriority - bPriority;
    });
}

// 总结供应商信息 ==> 排序&过滤&去重&截取
function summarizeSuppliers(supplierStore, inquiry_supplier_number) {
    // 先排序
    sortSuppliersByTagPriority(supplierStore);

    // 过滤无效数据并去重
    const seenCompanies = new Set();
    let storage = supplierStore
        .filter(item => item.companyName.length > 0 && item.qqAccount.length > 0)
        .filter(item => {
            // 获取第一个公司名作为唯一标识
            const companyName = item.companyName[0];
            // 如果这个公司名已经出现过，返回false过滤掉
            if (seenCompanies.has(companyName)) {
                return false;
            }
            // 否则添加到Set中并保留这条数据
            seenCompanies.add(companyName);
            return true;
        });

    // 返回指定数量的供应商
    return storage.slice(0, inquiry_supplier_number);
}

// 处理供应信息
window.getSuppliersProcess = function (inquiry_supplier_number = 10, batchSize = 50) {
    return new Promise((resolve) => {
        try {
            const supplierStore = [];
            const stairTrElements = document.getElementsByClassName("stair_tr");

            if (stairTrElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '当前物料编码，未找到供应商信息。'
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
                        companyInfo: {},
                        materialId: [],
                        qqAccount: []
                    };

                    // 获取供应信息
                    const supplyElement = stairTr.querySelector(".result_supply");
                    if (supplyElement) {
                        elementData.company = supplyElement;
                        const supplyLinks = Array.from(supplyElement.querySelectorAll("a:not(.detailLayer a):not(.result_icons a)"));

                        supplyLinks.forEach(async (link) => {
                            if (link.offsetParent !== null) {
                                // 获取公司信息
                                const detailLayer = supplyElement.querySelector('.detailLayer');
                                elementData.companyInfo = getCompanyInfo(detailLayer);

                                elementData.visibleLinks.push(link);
                                const content = link.textContent.trim();
                                if (content) elementData.companyName.push(content);

                                // 获取 result_icons 下的所有 a 标签
                                const iconLinks = supplyElement.querySelectorAll('.result_icons a');
                                iconLinks.forEach(link => {
                                    const className = link.className;
                                    if (className) elementData.companyTag.push(className);
                                });
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

                    supplierStore.push(elementData);
                }

                processedCount = end;

                if (processedCount < totalElements) {
                    requestAnimationFrame(processBatch);
                } else {
                    let supplierStoreuppliers = summarizeSuppliers(supplierStore, inquiry_supplier_number)
                    resolve({
                        success: true,
                        data: supplierStoreuppliers,
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


