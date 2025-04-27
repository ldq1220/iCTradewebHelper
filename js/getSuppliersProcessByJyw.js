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
            const className = tag?.className;
            const title = tag.getAttribute('title');
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
    // sortSuppliersByTagPriority(supplierStore);

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
    const result = storage.slice(0, inquiry_supplier_number).map(item => ({ ...item, companyName: item.companyName[0] }));
    return result;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 处理供应信息
window.getSuppliersProcessByJyw = function () {
    const inquiry_supplier_number = 50;
    const batchSize = 50;

    return new Promise((resolve) => {
        try {
            const supplierStore = [];
            const stairTrElements = document.getElementsByClassName('stair_tr');

            if (stairTrElements.length === 0) {
                resolve({
                    success: false,
                    data: [],
                    error: '当前物料编码，在【交易网】未找到供应商信息。'
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
                        materialTags: [],
                        brand: null,
                        batchId: null,
                        totalNumber: null,
                        packaging: null,
                        storehouse: null,
                        desc: null,
                        qqAccount: [],
                        source: 'jyw',
                        materialDate: ''
                    };

                    // 获取供应信息
                    const supplyElement = stairTr.querySelector('.result_supply');
                    if (supplyElement) {
                        elementData.company = supplyElement;
                        const supplyLinks = Array.from(supplyElement.querySelectorAll('a:not(.detailLayer a):not(.result_icons a)'));

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
                                    const className = link?.className;
                                    if (className) elementData.companyTag.push(className);
                                });
                            }
                        });
                    }

                    // 获取物料编号
                    const resultIdElement = stairTr.querySelector('.result_id');
                    if (resultIdElement) {
                        // 获取物料编号
                        const productNumbers =
                            resultIdElement.querySelectorAll('.product_number');
                        productNumbers.forEach((product) => {
                            const materialIdText = product.textContent.trim();
                            if (materialIdText) elementData.materialId.push(materialIdText);
                        });
                        // 物料标签
                        const materialTags = resultIdElement.querySelectorAll('a');
                        materialTags.forEach(tag => {
                            const tagClassName = tag.querySelector('span')?.className;
                            if (tagClassName) elementData.materialTags.push(tagClassName);
                        });
                    }

                    // 获取厂商
                    const brandElement = stairTr.querySelector('div.result_factory')
                    if (brandElement) {
                        const brandText = brandElement.textContent.trim();
                        if (brandText) elementData.brand = brandText;
                    }

                    // 获取批号
                    const resultBatchIdElement = stairTr.querySelector('.result_batchNumber');
                    if (resultBatchIdElement) {
                        const batchIdText = resultBatchIdElement.textContent.trim();
                        if (batchIdText) elementData.batchId = batchIdText;
                    }

                    // 获取数量
                    const totalNumberElements = stairTr.querySelectorAll('.result_totalNumber');
                    if (totalNumberElements) {
                        totalNumberElements.forEach((element) => {
                            const display = !(getComputedStyle(element).display.includes('none'));
                            if (display) {
                                const totalNumberText = element.textContent.trim();
                                if (totalNumberText) elementData.totalNumber = totalNumberText;
                            }
                        })
                    }

                    // 获取封装
                    const packagingElement = stairTr.querySelector('.result_pakaging');
                    if (packagingElement) {
                        const packagingText = packagingElement.textContent.trim();
                        if (packagingText) elementData.packaging = packagingText;
                    }

                    // 获取库位
                    const kwPlaceElement = stairTr.querySelector('.result_kwplace');
                    if (kwPlaceElement) {
                        const kwElement = kwPlaceElement.querySelector('.kw_list');
                        if (kwElement) {
                            const kwText = kwElement.textContent.trim();
                            if (kwText) elementData.storehouse = kwText;
                        }
                    }

                    // 获取说明
                    const explainElement = stairTr.querySelector('.result_explain');
                    if (explainElement) {
                        const explainText = explainElement.textContent.trim();
                        if (explainText) elementData.desc = explainText;
                    }

                    // 获取询价信息中的QQ账号
                    const askPriceElement = stairTr.querySelector('.result_askPrice');
                    if (askPriceElement) {
                        const askPriceLinks = askPriceElement.querySelectorAll('a');
                        askPriceLinks.forEach((link) => {
                            if (link.offsetParent !== null) {
                                const myTitle = link.getAttribute('mytitle');
                                if (myTitle) elementData.qqAccount.push(myTitle)
                            }
                        });
                    }

                    // 获取物料日期
                    const materialDateElement = stairTr.querySelector('.result_date');
                    if (materialDateElement) {
                        const materialDateText = materialDateElement.textContent.trim();
                        if (materialDateText) elementData.materialDate = materialDateText;
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

// 搜索物料
window.searchMaterial = async function (code) {
    let success = true
    try {
        const searchTriggerDom = document.querySelector('.fake-input') || document.querySelector('.textEllipsis')
        if (searchTriggerDom) {
            searchTriggerDom.click()
        }
        await sleep(2000)

        // 尝试获取Vue组件实例并更新其数据
        const inputDom = document.querySelector('.uni-input-input')
        if (inputDom) {
            // 方法1: 设置值并触发事件
            inputDom.value = code

            // 使用更强力的事件触发方式
            inputDom.dispatchEvent(new Event('input', { bubbles: true, composed: true }))
            inputDom.dispatchEvent(new Event('change', { bubbles: true, composed: true }))

            // 方法2: 尝试直接访问Vue组件实例
            // 遍历父元素，寻找可能存在的__vue__属性
            let element = inputDom;
            while (element && !element.__vue__) {
                element = element.parentElement;
            }

            // 如果找到了Vue实例，直接设置其值
            if (element && element.__vue__) {
                // 可能需要根据实际组件结构调整
                if (element.__vue__.value !== undefined) {
                    element.__vue__.value = code;
                }
                // 或者触发其input方法
                if (typeof element.__vue__.onInput === 'function') {
                    element.__vue__.onInput({ detail: { value: code } });
                }
            }
        }

        await sleep(2000)

        const searchButtonDom = document.querySelector('.sea-btn')
        if (searchButtonDom) {
            // 尝试直接调用搜索方法，而不是点击按钮
            if (window.__uniapp__ && typeof window.__uniapp__.search === 'function') {
                window.__uniapp__.search(code);
            } else {
                // 如果不能直接调用方法，则模拟点击
                searchButtonDom.click()
            }
        }
    } catch (error) {
        console.error('searchMaterial error', error)
        success = false
    }

    return success
}

// 获取页面供应商 资质等级 物料标签
window.getSuppliersOrderInfo = async function () {
    const searcListAll = document.querySelectorAll('.searcList')
    const suppliersOrderInfo = []

    for (const searcList of searcListAll) {

        const suppliersOrderInfoItem = {
            companyName: '',
            companyTag: [],
            materialTags: []
        }

        const gysDom = searcList.querySelector('.gys')
        // 名称
        const comName = gysDom.querySelector('.comName')
        if (comName) {
            suppliersOrderInfoItem.companyName = comName.textContent.trim()
        }
        // 资质等级
        const idTrBottom = gysDom.querySelector('.idTrBottom')
        const rzIconAll = idTrBottom.querySelectorAll('.rzIcon')
        if (rzIconAll) {
            for (const rzIcon of rzIconAll) {
                const className = rzIcon.className
                const lastClassName = className.split(' ').pop()

                const tidyClassName = {
                    'icon-ic500': 'icon500',
                    'icon-sscp': 'sscp',
                    'icon-iccp': 'iccp',
                    'icon-stock': 'stock',
                    'icon-hckc': 'icon_hckc',
                    'icon-hcjg': 'icon_hcjg',
                    'icon-redVip': 'redvip',
                    'icon-daili': 'daili',
                    'icon-yc': 'yuanchang',
                    'icon-a-2024': 'year_icon',
                    'icon-jiangbei': 'brandStar_icon',
                    'icon-rzpg': 'renzheng_icon'
                }
                suppliersOrderInfoItem.companyTag.push(tidyClassName[lastClassName] || lastClassName)
            }
        }


        // 物料标签
        const xhDom = searcList.querySelector('.xh')
        if (xhDom) {
            const materialRzIcon = xhDom.querySelector('.rzIcon')
            if (materialRzIcon) {
                const materialRzIconClassName = materialRzIcon.className
                const materialRzIconClassNameLast = materialRzIconClassName.split(' ').pop()
                const tidyClassName = {
                    'icon-xhpm': 'icon_xianHuo',
                    'icon-tj': 'icon_tuiJian',
                    'icon-yx': 'icon_youXian',
                    'icon-rm': 'icon_reMai',
                    'icon-dhpm': 'icon_dingHuo'
                }
                suppliersOrderInfoItem.materialTags.push(tidyClassName[materialRzIconClassNameLast] || materialRzIconClassNameLast)
            }
        }

        suppliersOrderInfo.push(suppliersOrderInfoItem)
    }

    return suppliersOrderInfo
}

// 校验账号是否没封禁
window.checkAccountIsBlocked = async function (account) {
    const bodyDom = document.querySelector('body')
    const bodyDomText = bodyDom.textContent
    const blocked = bodyDomText.includes('禁止访问, 请联系客服')
    return blocked
}


window.checkYiDdun = async function () {
    let hasYidun = false
    const bodyDom = document.querySelector('.yidun_popup')

    // 添加检查，确保bodyDom存在
    if (bodyDom) {
        const displayProperty = getComputedStyle(bodyDom).display.includes('block')
        hasYidun = displayProperty
    }

    return hasYidun
}


